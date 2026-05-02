# Notification System Design

---

## Stage 1

### Core Actions the Notification Platform Must Support

1. Fetch all notifications for a logged-in student
2. Fetch unread notifications only
3. Mark a notification as read
4. Mark all notifications as read
5. Get notification count (total / unread)
6. Receive real-time notifications (via WebSocket / SSE)

---

### REST API Design

#### 1. Get All Notifications for a Student

```
GET /api/v1/students/{studentId}/notifications
```

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Query Parameters:**
| Param  | Type   | Description                         |
|--------|--------|-------------------------------------|
| page   | int    | Page number (default: 1)            |
| limit  | int    | Results per page (default: 20)      |
| type   | string | Filter: `Placement`, `Event`, `Result` |
| isRead | bool   | Filter by read status               |

**Response (200 OK):**
```json
{
  "studentId": "stu-001",
  "notifications": [
    {
      "id": "d146095a-0d86-4a34-9e69-3900a14576bc",
      "type": "Result",
      "message": "mid-sem",
      "timestamp": "2026-04-22 17:51:30",
      "isRead": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 120,
    "totalPages": 6
  }
}
```

---

#### 2. Get Unread Notification Count

```
GET /api/v1/students/{studentId}/notifications/count
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "studentId": "stu-001",
  "unreadCount": 12
}
```

---

#### 3. Mark a Single Notification as Read

```
PATCH /api/v1/students/{studentId}/notifications/{notificationId}/read
```

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "id": "d146095a-0d86-4a34-9e69-3900a14576bc",
  "isRead": true,
  "updatedAt": "2026-04-22 17:55:00"
}
```

---

#### 4. Mark All Notifications as Read

```
PATCH /api/v1/students/{studentId}/notifications/read-all
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "studentId": "stu-001",
  "updatedCount": 12,
  "message": "All notifications marked as read"
}
```

---

#### 5. Create a Notification (Internal / HR use)

```
POST /api/v1/notifications
```

**Headers:**
```
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "type": "Placement",
  "message": "CSX Corporation hiring",
  "recipientIds": ["stu-001", "stu-002"],
  "broadcastAll": false
}
```

**Response (201 Created):**
```json
{
  "notificationId": "b283218f-ea5a-4b7c-93a9-1f2f240d64b0",
  "message": "Notification queued successfully",
  "recipientCount": 2
}
```

---

### Real-Time Notification Mechanism

**Chosen approach: WebSocket (Socket.IO)**

WebSockets maintain a persistent bidirectional connection between client and server, enabling the server to push notifications instantly when they are created — without polling.

```
Client                          Server
  |                               |
  |-- WS Connect (with JWT) ----> |
  |                               |
  |<-- Event: notification_new -- |  (on new notification)
  |                               |
  |-- ACK: mark_read -----------> |
```

**Implementation sketch:**
```typescript
// Server (Node.js / Socket.IO)
io.on("connection", (socket) => {
  const studentId = socket.handshake.auth.studentId;
  socket.join(`student_${studentId}`);
});

// Emit when a new notification is created
io.to(`student_${studentId}`).emit("notification_new", notification);
```

**Why WebSocket over SSE or Polling?**
| Strategy   | Bidirectional | Real-time | Scalability | Complexity |
|-----------|--------------|-----------|-------------|------------|
| Polling   | No           | Poor      | High load   | Low        |
| SSE       | No           | Good      | Medium      | Low        |
| WebSocket | Yes          | Excellent | Medium-High | Medium     |

WebSocket wins because it supports bidirectional events (e.g. marking read from client), has low latency, and Socket.IO gracefully falls back to long-polling if needed.

---

## Stage 2

### Database Choice: PostgreSQL (Relational)

**Why PostgreSQL?**
- Notifications have a **clear relational structure** — students, notifications, read-status — making relational DB a natural fit
- ACID compliance ensures consistency when marking notifications as read
- Supports **JSONB** for flexible metadata without losing query power
- Excellent index support (B-Tree, partial indexes) for high-read workloads
- Mature ecosystem; scales vertically well and supports read replicas

---

### Schema

```sql
-- Students table (reference, assumed managed by auth service)
CREATE TABLE students (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(255) NOT NULL UNIQUE,
  name        VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- notification_type ENUM
CREATE TYPE notification_type AS ENUM ('Event', 'Result', 'Placement');

-- Notifications table
CREATE TABLE notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type              notification_type NOT NULL,
  message           TEXT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table: which student received which notification
CREATE TABLE student_notifications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  notification_id  UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  is_read          BOOLEAN NOT NULL DEFAULT FALSE,
  read_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, notification_id)
);
```

---

### Scalability Problems as Data Grows

| Problem | Description |
|---------|-------------|
| **Full table scans** | `SELECT * WHERE studentId = X AND isRead = false` scans millions of rows |
| **Bulk insert bottleneck** | Sending to 50K students = 50K INSERTs (slow, lock contention) |
| **Read-all overhead** | `UPDATE ... WHERE studentId = X AND isRead = false` touches many rows |
| **Storage bloat** | 50K students × 5M notifications = 250B rows in `student_notifications` |
| **WebSocket fan-out** | Broadcasting to 50K active sockets simultaneously saturates memory |

**Solutions:**
- **Indexes** on `(student_id, is_read)` and `(student_id, created_at DESC)` — reduces scan cost drastically
- **Bulk inserts** via `INSERT INTO ... SELECT` or batch workers instead of row-by-row
- **Read replicas** for SELECT-heavy workloads
- **Partitioning** `student_notifications` by `student_id` range or hash
- **Message queues** (Redis / RabbitMQ) for async fan-out delivery
- **Cache layer** (Redis) for unread counts and recent notifications

---

### Queries Based on Stage 1 APIs

**1. Get all notifications for a student (paginated)**
```sql
SELECT n.id, n.type, n.message, n.created_at, sn.is_read
FROM student_notifications sn
JOIN notifications n ON sn.notification_id = n.id
WHERE sn.student_id = $1
ORDER BY n.created_at DESC
LIMIT $2 OFFSET $3;
```

**2. Get unread count**
```sql
SELECT COUNT(*) AS unread_count
FROM student_notifications
WHERE student_id = $1 AND is_read = FALSE;
```

**3. Mark single notification as read**
```sql
UPDATE student_notifications
SET is_read = TRUE, read_at = NOW()
WHERE student_id = $1 AND notification_id = $2;
```

**4. Mark all as read**
```sql
UPDATE student_notifications
SET is_read = TRUE, read_at = NOW()
WHERE student_id = $1 AND is_read = FALSE;
```

**5. Get placement notifications in last 7 days**
```sql
SELECT n.id, n.type, n.message, n.created_at, sn.student_id
FROM student_notifications sn
JOIN notifications n ON sn.notification_id = n.id
WHERE n.type = 'Placement'
  AND n.created_at >= NOW() - INTERVAL '7 days';
```

---

## Stage 3

### Evaluating the Slow Query

**Original query:**
```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

**Is this query accurate?**

Mostly yes — it correctly fetches unread notifications for a student ordered by recency. However, based on the normalised schema designed in Stage 2, `studentID` and `isRead` belong in a `student_notifications` junction table, not directly in `notifications`. The query structure would therefore need to be adapted.

**Why is it slow?**

With 50,000 students and 5,000,000 notifications, the table is large. Without an index on `(studentID, isRead)`, PostgreSQL performs a **sequential scan** across millions of rows to find the matching subset, then sorts them — O(n log n). This is extremely expensive.

**Estimated computation cost without indexes:**
- Sequential scan: ~5M row reads per query
- Sort on `createdAt DESC`: O(n log n) on the result set
- At peak (many concurrent students refreshing): this multiplies, causing I/O bottleneck

---

### What Changes Are Needed?

**1. Add a composite index:**
```sql
CREATE INDEX idx_notifications_student_read
ON notifications (studentID, isRead, createdAt DESC);
```

This converts the query from a full scan to an **index range scan** — O(log n + k) where k is the result set size.

**2. Use a partial index (more efficient):**
```sql
CREATE INDEX idx_notifications_unread
ON notifications (studentID, createdAt DESC)
WHERE isRead = false;
```

This index only stores unread rows, making it smaller and faster for the most common query pattern.

**3. Avoid SELECT *:**
```sql
SELECT id, type, message, createdAt
FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

Fetching only needed columns reduces I/O and network transfer.

---

### Should You Add Indexes on Every Column?

**No.** Adding indexes on every column is counterproductive:

| Issue | Explanation |
|-------|-------------|
| **Write slowdown** | Every INSERT / UPDATE must update ALL indexes — 50K notifications × many indexes = severe write overhead |
| **Storage bloat** | Each index consumes disk space proportional to table size |
| **Query planner confusion** | Too many indexes can cause the query planner to make suboptimal choices |
| **Maintenance cost** | More indexes = more VACUUM/ANALYZE overhead |

**Rule of thumb:** Index columns that appear in `WHERE`, `ORDER BY`, or `JOIN` clauses of frequent, slow queries — nothing more.

---

### Query: Students Who Received Placement Notifications in Last 7 Days

```sql
SELECT DISTINCT sn.student_id
FROM student_notifications sn
JOIN notifications n ON sn.notification_id = n.id
WHERE n.type = 'Placement'
  AND n.created_at >= NOW() - INTERVAL '7 days';
```

**Supporting index:**
```sql
CREATE INDEX idx_notifications_type_created
ON notifications (type, created_at DESC);
```

This allows PostgreSQL to use an index-only scan on `notifications` filtered by type and date, then join efficiently.

---

## Stage 4

### Problem

Notifications are fetched fresh from the DB on every page load for every student. With 50,000 students, this causes:
- High concurrent DB connection pressure
- Repeated identical queries (same student reloads multiple times)
- Slow page loads during peak hours (placement season, result days)

---

### Recommended Solution: Multi-Layer Caching Strategy

#### Layer 1 — Redis Cache (Primary)

Cache each student's recent notifications and unread count in Redis:

```
Key:   notifications:{studentId}:recent     → JSON array of last N notifications
TTL:   60 seconds (tunable)

Key:   notifications:{studentId}:unread_count → integer
TTL:   30 seconds
```

**Cache invalidation strategy:**
- On `mark_read` or new notification → `DEL notifications:{studentId}:*`
- On bulk send → broadcast invalidation for all affected students

**Tradeoff:**
| Pro | Con |
|-----|-----|
| Sub-millisecond reads | Stale data for TTL window |
| Reduces DB load by 90%+ | Extra infra (Redis cluster) |
| Easy to scale horizontally | Cache stampede risk on cold start |

**Cache stampede mitigation:** Use a **mutex lock** (Redis `SET NX`) so only one request rebuilds the cache when it expires.

#### Layer 2 — HTTP Cache Headers

For the notification list endpoint, return:
```
Cache-Control: private, max-age=30
ETag: "<hash-of-response>"
```

On re-request, the API consumer sends `If-None-Match` — server returns `304 Not Modified` if nothing changed, saving bandwidth and DB hits.

**Tradeoff:** Only effective for repeated requests from the same caller; not shared across users.

#### Layer 3 — DB Read Replicas

Route all `SELECT` queries to a PostgreSQL read replica. Writes (mark-read, inserts) go to the primary.

**Tradeoff:**
| Pro | Con |
|-----|-----|
| Scales read throughput linearly | Replication lag (eventual consistency) |
| Primary is protected from read load | Added operational complexity |

#### Layer 4 — Denormalized Unread Count Column

Store an `unread_count` integer directly on the `students` table, updated atomically:

```sql
UPDATE students SET unread_count = unread_count - 1
WHERE id = $studentId;
```

This allows the badge count to be served instantly without a COUNT query.

**Tradeoff:** Must keep in sync carefully (risk of drift); adds write complexity.

---

### Recommended Combination

1. **Redis** for notification list + count (primary cache)
2. **Read replica** to protect primary DB
3. **ETag-based HTTP caching** on the API
4. **Denormalized unread_count** for the badge only

---

## Stage 5

### Shortcomings of the Original `notify_all` Implementation

```
function notify_all(student_ids: array, message: string):
    for student_id in student_ids:
        send_email(student_id, message)   # calls Email API
        save_to_db(student_id, message)   # DB insert
        push_to_app(student_id, message)  # real-time push
```

**Problems:**

| Issue | Explanation |
|-------|-------------|
| **Sequential loop** | Processes 50K students one-by-one — extremely slow (minutes/hours) |
| **Tight coupling** | Email, DB, and push happen together; if one fails, all subsequent are skipped |
| **No error recovery** | If `send_email` fails at student 200, the remaining 49,800 are never processed |
| **No retry logic** | Transient failures (network blip, API rate limit) permanently skip students |
| **No idempotency** | Re-running risks duplicate notifications |
| **DB write bottleneck** | 50K individual INSERTs in a loop causes lock contention |
| **Push fan-out in-process** | 50K WebSocket pushes from a single process saturates memory and CPU |

---

### What Happens When `send_email` Fails at Student 200?

Students 201–50,000 **never get the email**. The system has no record of the failure scope, no retry, and no way to resume.

---

### Should DB save and Email happen together?

**No.** They are independent concerns with different failure modes:

- `save_to_db` must **always** succeed (source of truth)
- `send_email` may fail due to external provider issues — it should be retried asynchronously
- `push_to_app` is best-effort (user may be offline) — fire-and-forget with delivery tracking

Coupling them means a transient email API outage prevents thousands of students from even having their notification saved to DB.

---

### Redesigned Implementation

**Architecture: Message Queue + Worker Pool**

```
HR clicks "Notify All"
        │
        ▼
[API Server]
  - Saves notification to DB once (not per student)
  - Publishes one event to Message Queue (Redis Streams / RabbitMQ)
        │
        ▼
[Fan-out Worker]  ← consumes queue event
  - Reads all 50K student IDs in batches of 500
  - For each batch, publishes individual jobs to two separate queues:
      • email_queue
      • push_queue
        │              │
        ▼              ▼
[Email Workers]   [Push Workers]
  - Pull from email_queue
  - Call Email API with retry (exponential backoff, max 3 attempts)
  - Mark delivery status in DB
  |
  - Pull from push_queue
  - Emit WebSocket event to student room
  - Best-effort; log failures
```

**Revised Pseudocode:**

```typescript
// API handler — O(1), returns immediately
async function notify_all(student_ids: string[], message: string): Promise<void> {
  // 1. Save notification once to DB
  const notificationId = await save_notification_to_db(message);

  // 2. Save delivery records for all students (bulk insert)
  await bulk_insert_student_notifications(student_ids, notificationId);

  // 3. Publish one fan-out job to the queue
  await message_queue.publish("notification_fanout", {
    notificationId,
    message,
    studentIds: student_ids,
  });

  // Returns immediately — O(1) response to HR
}

// Fan-out worker (separate process)
message_queue.subscribe("notification_fanout", async (job) => {
  const { notificationId, message, studentIds } = job;
  const batches = chunk(studentIds, 500); // split into batches of 500

  for (const batch of batches) {
    for (const studentId of batch) {
      // Enqueue email and push independently
      await email_queue.publish({ studentId, message, notificationId });
      await push_queue.publish({ studentId, notificationId });
    }
  }
});

// Email worker (multiple instances for parallelism)
email_queue.subscribe(async ({ studentId, message, notificationId }) => {
  await retry(
    () => send_email(studentId, message),
    { maxAttempts: 3, backoff: "exponential" }
  );
  await mark_email_delivered(notificationId, studentId);
});

// Push worker
push_queue.subscribe(async ({ studentId, notificationId }) => {
  push_to_app(studentId, notificationId); // fire-and-forget
});
```

**Key improvements:**
- **Decoupled**: Email, DB, and push fail independently without blocking each other
- **Resumable**: Queue workers retry failed jobs automatically
- **Fast**: HR gets an immediate response; delivery happens asynchronously
- **Reliable**: DB is written first; email is a downstream effect
- **Scalable**: Spin up more email/push workers during peak load
- **Auditable**: Delivery status tracked per student in DB

---

## Stage 6

### Priority Inbox — Approach

**Goal:** Always show the top-N most important unread notifications, ranked by a combination of:
1. **Type weight** (Placement > Result > Event)
2. **Recency** (newer notifications rank higher within the same type)

**Scoring formula:**

```
score = typeWeight + recencyScore

typeWeight:
  Placement → 300
  Result    → 200
  Event     → 100

recencyScore = 1 / (1 + hoursOld)   (normalised to [0, 1])
```

The recency score decays towards 0 as the notification ages, so a fresh Event can outrank a very old Placement, but a recent Placement always dominates.

**Maintaining top-10 efficiently as new notifications arrive:**

Use a **min-heap of size N**: when a new notification arrives, compute its score. If it's greater than the heap's minimum, push it in and pop the minimum. This is O(log N) per insertion — constant-time maintenance regardless of total notification count.

See `notification_app_be/priority_inbox.ts` for the full implementation.
