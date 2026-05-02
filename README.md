# Logging Middleware

A reusable TypeScript logging package that sends structured log entries to the evaluation service.

## Function Signature

```typescript
Log(stack, level, package, message)
```

### Parameters

| Param | Type | Allowed Values |
|-------|------|----------------|
| `stack` | `Stack` | `"backend"` \| `"frontend"` |
| `level` | `Level` | `"debug"` \| `"info"` \| `"warn"` \| `"error"` \| `"fatal"` |
| `package` | `Package` | See below |
| `message` | `string` | Descriptive log message |

### Package Values

- **Backend only**: `cache`, `controller`, `cron_job`, `db`, `domain`, `handler`, `repository`, `route`, `service`
- **Frontend only**: `api`, `component`, `hook`, `page`, `state`, `style`
- **Both**: `auth`, `config`, `middleware`, `utils`

## Setup

```bash
npm install
npm test      # runs smoke tests against the evaluation service
npm run build # compiles to dist/
```

## Usage

```typescript
import { initLogger, Log } from './src';

// Initialise once with your Bearer token
initLogger({ authToken: 'YOUR_BEARER_TOKEN' });

// Use anywhere in your codebase
await Log('backend', 'info', 'service', 'Vehicle scheduler service started');
await Log('backend', 'error', 'handler', 'Received string, expected bool');
await Log('backend', 'fatal', 'db', 'Critical database connection failure.');
await Log('frontend', 'debug', 'component', 'NotificationList rendered with 20 items');
```

## Author

Archit Gupta — RA2311003010891
