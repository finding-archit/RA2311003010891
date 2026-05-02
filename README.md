# Logging Middleware

A reusable TypeScript logging package that sends structured log entries to the evaluation service.

## Function Signature

```typescript
Log(stack, level, package, message)
```

### Parameters

| Param | Type | Allowed Values |
|-------|------|----------------|
| `stack` | `Stack` | `"backend"` |
| `level` | `Level` | `"debug"` \| `"info"` \| `"warn"` \| `"error"` \| `"fatal"` |
| `package` | `Package` | `cache`, `controller`, `cron_job`, `db`, `domain`, `handler`, `repository`, `route`, `service`, `auth`, `config`, `middleware`, `utils` |
| `message` | `string` | Descriptive log message (max 48 chars) |

## Setup

```bash
npm install
npm test
```

## Usage

```typescript
import { initLogger, Log } from './src';

initLogger({ authToken: 'YOUR_BEARER_TOKEN' });

await Log('backend', 'info', 'service', 'Service started');
await Log('backend', 'error', 'handler', 'Received string, expected bool');
await Log('backend', 'fatal', 'db', 'DB connection failure');
```

## Author

Archit Gupta — RA2311003010891
