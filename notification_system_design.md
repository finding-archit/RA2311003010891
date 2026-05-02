# Notification System Design

## Stage 1: Core REST API & WebSockets
- **Endpoints:** `GET /notifications` (fetch), `PATCH /notifications/:id/read` (mark read).
- **Real-Time:** WebSockets (Socket.IO) for bidirectional low-latency push notifications.

## Stage 2: Database Schema (PostgreSQL)
- **Tables:** `students`, `notifications`, `student_notifications` (junction table for tracking `is_read` status).
- **Scaling:** Partitioning, Indexes on `(student_id, is_read)`, and Redis caching.

## Stage 3: Query Optimization
- **Original Query:** Slow due to O(n) sequential scans on 5M+ rows.
- **Fix:** Add index `CREATE INDEX idx_unread ON notifications(studentID, createdAt DESC) WHERE isRead=false;`
- **Recent Placements Query:** `SELECT student_id FROM student_notifications sn JOIN notifications n ON sn.notification_id = n.id WHERE n.type='Placement' AND n.created_at >= NOW() - INTERVAL '7 days';`

## Stage 4: Performance (Read-heavy)
- **Solution:** Multi-layer cache. Redis for recent notifications/unread counts + HTTP ETag caching to prevent redundant DB hits. 

## Stage 5: Reliability (`notify_all`)
- **Flaws:** Synchronous sequential loop; DB/Email/Push coupled together means a single email failure blocks the rest. 
- **Fix:** Event-driven architecture. Save to DB once, publish job to RabbitMQ/Redis Streams, and use async worker pools to dispatch emails with automatic retries.

## Stage 6: Priority Inbox
- **Logic:** Ranks by `Score = Weight(Placement:300, Result:200, Event:100) + (1 / (1 + ageInHours))`. 
- **Efficiency:** Uses a Min-Heap of size 10 to maintain the top notifications in O(log N) time as new data streams in.

***
**Author:** Archit Gupta - RA2311003010891
