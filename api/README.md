# Spring Rate Calculator API

Hono-based backend service for Spring Rate Calculator with Cloudflare Worker runtime.

## Structure

```
/api
├── src/
│   ├── index.ts              # Hono app entry point
│   ├── routes/               # API route handlers
│   ├── middleware/           # Custom middleware (auth, cors, etc.)
│   ├── db/                   # D1 database schema and queries
│   ├── lib/                  # Utilities and helpers
│   └── types/                # TypeScript types
├── tests/                    # Test files
├── wrangler.toml             # Cloudflare config
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Development

### Prerequisites

- Node.js 20+
- pnpm 10+

### Install dependencies

From the `/api` directory:

```bash
pnpm install
```

### Run local dev server

```bash
pnpm dev
```

The API will be available at `http://localhost:8787`

### Test endpoints

Health check:
```bash
curl http://localhost:8787/api/v1/health
```

### Run tests

```bash
pnpm test
```

Watch mode:
```bash
pnpm test:watch
```

### Lint and format

```bash
pnpm lint
pnpm format
```

## API Endpoints

### Health Check
- **GET** `/api/v1/health`
- Returns service status and version

Response:
```json
{
  "status": "ok",
  "timestamp": 1739665672000,
  "service": "spring-rate-calculator-api",
  "version": "1.0.0"
}
```

## Deployment

Deploy to Cloudflare Workers:

```bash
wrangler deploy
```

## Future Endpoints

See [Design Document](../docs/d1-hono-migration-design.md) for planned API contract.
