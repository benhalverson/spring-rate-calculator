# D1 + Hono Backend Migration Design

**Status:** Draft  
**Created:** 2026-02-16  
**Owner:** Backend Architecture Team

## Executive Summary

This document outlines a technical design for migrating the Spring Rate Calculator from local-only persistence (IndexedDB via Dexie) to a cloud-backed system using Cloudflare D1 (SQLite) and Hono (lightweight web framework). The design preserves the existing offline-first user experience while enabling cloud sync, cross-device access, and future collaboration features.

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Goals and Non-Goals](#goals-and-non-goals)
3. [API Contract Design](#api-contract-design)
4. [D1 Schema Design](#d1-schema-design)
5. [Offline-First Sync Strategy](#offline-first-sync-strategy)
6. [Security and Authentication](#security-and-authentication)
7. [Migration Plan](#migration-plan)
8. [Risk Assessment](#risk-assessment)
9. [Success Metrics](#success-metrics)

---

## Current State Analysis

### Technology Stack
- **Frontend:** React 19 + TypeScript + Vite
- **Storage:** Dexie (IndexedDB wrapper) - local only
- **Hosting:** Cloudflare Workers (static assets)
- **Deployment:** Wrangler + GitHub Actions CI/CD

### Current Data Model

```typescript
interface SpringCalcRecord {
  id: string;              // UUID
  createdAt: number;       // Epoch milliseconds
  manufacturer: string;
  partNumber: string;
  purchaseUrl?: string;
  notes?: string;
  units: "mm" | "in";
  d: number;               // Wire diameter
  D: number;               // Coil outer diameter
  n: number;               // Active coils
  Davg: number;            // Derived: D - d
  k: number;               // Calculated spring rate
}
```

### Current Storage Operations

The existing `src/lib/db.ts` provides:
- `addCalculation(record)` - Upsert (Dexie `put`)
- `listCalculations()` - Fetch all, sorted by `createdAt DESC`
- `deleteCalculation(id)` - Single delete
- `bulkDeleteCalculations(ids[])` - Multiple delete
- `clearCalculations()` - Delete all

### Current Indexes (Dexie v2)
```javascript
calculations: "id, createdAt, manufacturer, partNumber, [manufacturer+partNumber]"
```

### Key Observations

1. **No user authentication:** Current app is anonymous and device-local
2. **No conflict resolution:** Single-device usage means no sync conflicts
3. **PWA-ready:** Service worker and manifest already configured
4. **100% offline capable:** All features work without network
5. **Simple CRUD operations:** No complex queries or aggregations
6. **Immutable records:** Records are created and deleted, not updated (uses `put` for upsert but UI doesn't expose editing)

---

## Goals and Non-Goals

### Goals

✅ **Cloud persistence** - Enable cross-device access to saved calculations  
✅ **Offline-first UX** - Maintain current offline capabilities  
✅ **Non-breaking frontend changes** - Preserve existing public API of `src/lib/db.ts`  
✅ **Auth-ready architecture** - Design to support future user accounts  
✅ **Conflict-free sync** - Last-write-wins with tombstones for deletes  
✅ **Search/filter API** - Support filtering by manufacturer, part number, date range  

### Non-Goals

❌ Real-time collaboration (future consideration)  
❌ User authentication implementation (spike defines approach, not implementation)  
❌ Advanced query capabilities (full-text search, analytics)  
❌ Data export/import features (can be added later)  
❌ Multi-tenancy or organization accounts  

---

## API Contract Design

### Base URL Structure

```
https://spring-rate-calculator.benhalverson.workers.dev/api/v1
```

All API routes will be prefixed with `/api/v1` to enable versioning.

### REST Endpoints

#### 1. Create Calculation

```http
POST /api/v1/calculations
Content-Type: application/json
Authorization: Bearer <token> (optional for anonymous)

Request Body:
{
  "id": "uuid-v4",
  "createdAt": 1739665672000,
  "manufacturer": "Eibach",
  "partNumber": "ERS 8.00.225",
  "purchaseUrl": "https://example.com/spring",
  "notes": "Front left spring",
  "units": "mm",
  "d": 12.7,
  "D": 63.5,
  "n": 7,
  "Davg": 50.8,
  "k": 18.5
}

Response: 201 Created
{
  "success": true,
  "data": { ...record }
}

Errors:
400 Bad Request - Invalid input
401 Unauthorized - Auth required (future)
409 Conflict - ID already exists (rare)
```

#### 2. List Calculations

```http
GET /api/v1/calculations?
  manufacturer=<string>&
  partNumber=<string>&
  units=<mm|in>&
  fromDate=<timestamp>&
  toDate=<timestamp>&
  limit=<number>&
  offset=<number>&
  orderBy=<createdAt|k>&
  orderDirection=<asc|desc>

Authorization: Bearer <token> (optional)

Response: 200 OK
{
  "success": true,
  "data": [
    { ...record1 },
    { ...record2 }
  ],
  "pagination": {
    "total": 42,
    "limit": 100,
    "offset": 0,
    "hasMore": false
  }
}

Default behavior (no query params):
- Returns all calculations for user/anonymous
- Sorted by createdAt DESC
- Limit 100 (same as current IndexedDB behavior)
```

#### 3. Get Single Calculation

```http
GET /api/v1/calculations/:id
Authorization: Bearer <token> (optional)

Response: 200 OK
{
  "success": true,
  "data": { ...record }
}

Errors:
404 Not Found - Calculation doesn't exist
401 Unauthorized - No access to this calculation
```

#### 4. Update Calculation

```http
PUT /api/v1/calculations/:id
Content-Type: application/json
Authorization: Bearer <token> (optional)

Request Body:
{
  "manufacturer": "Updated Manufacturer",
  "notes": "Updated notes",
  // Only include fields to update
}

Response: 200 OK
{
  "success": true,
  "data": { ...updated record }
}

Notes:
- Partial updates allowed
- Cannot update id, createdAt, calculated fields (Davg, k)
- Updates must recalculate Davg/k if d/D/n change
```

#### 5. Delete Calculation

```http
DELETE /api/v1/calculations/:id
Authorization: Bearer <token> (optional)

Response: 204 No Content

Errors:
404 Not Found - Already deleted or doesn't exist
401 Unauthorized - No access
```

#### 6. Bulk Delete Calculations

```http
POST /api/v1/calculations/bulk-delete
Content-Type: application/json
Authorization: Bearer <token> (optional)

Request Body:
{
  "ids": ["uuid1", "uuid2", "uuid3"]
}

Response: 200 OK
{
  "success": true,
  "deleted": 3,
  "failed": []
}

Notes:
- Returns count of successful deletes
- Ignores non-existent IDs (idempotent)
- Max 100 IDs per request
```

#### 7. Clear All Calculations

```http
DELETE /api/v1/calculations
Authorization: Bearer <token> (optional)

Response: 200 OK
{
  "success": true,
  "deleted": 15
}

Notes:
- Deletes all calculations for the user/anonymous session
- Returns count of deleted records
```

#### 8. Sync Endpoint (Offline-First)

```http
POST /api/v1/sync
Content-Type: application/json
Authorization: Bearer <token> (optional)

Request Body:
{
  "lastSyncTimestamp": 1739665000000,
  "changes": {
    "created": [
      { ...new record },
      { ...new record }
    ],
    "updated": [
      { id: "uuid", ...fields }
    ],
    "deleted": [
      "uuid1", "uuid2"
    ]
  }
}

Response: 200 OK
{
  "success": true,
  "syncTimestamp": 1739665672000,
  "changes": {
    "created": [...server records created since lastSyncTimestamp],
    "updated": [...server records updated since lastSyncTimestamp],
    "deleted": [...ids of deleted records]
  },
  "conflicts": [
    {
      "id": "uuid",
      "clientVersion": { ...local record },
      "serverVersion": { ...server record },
      "resolution": "server-wins" // or "client-wins" based on strategy
    }
  ]
}

Notes:
- Atomic sync transaction
- Last-write-wins conflict resolution
- Returns server state since client's last sync
```

---

## D1 Schema Design

### Database: `spring-rate-calculator.db`

#### Table: `calculations`

```sql
CREATE TABLE calculations (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER DEFAULT NULL,
  
  -- User association (nullable for anonymous)
  user_id TEXT DEFAULT NULL,
  session_id TEXT DEFAULT NULL,
  
  -- Spring identification
  manufacturer TEXT NOT NULL,
  part_number TEXT NOT NULL,
  purchase_url TEXT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  
  -- Spring dimensions and calculation
  units TEXT NOT NULL CHECK(units IN ('mm', 'in')),
  d REAL NOT NULL,
  D REAL NOT NULL,
  n REAL NOT NULL,
  davg REAL NOT NULL,
  k REAL NOT NULL,
  
  -- Sync metadata
  sync_version INTEGER NOT NULL DEFAULT 1,
  device_id TEXT DEFAULT NULL
);

-- Indexes for performance
CREATE INDEX idx_calculations_created_at ON calculations(created_at DESC);
CREATE INDEX idx_calculations_user_session ON calculations(user_id, session_id);
CREATE INDEX idx_calculations_manufacturer_part ON calculations(manufacturer, part_number);
CREATE INDEX idx_calculations_deleted_at ON calculations(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_calculations_updated_at ON calculations(updated_at);

-- Composite index for efficient sync queries
CREATE INDEX idx_calculations_sync ON calculations(user_id, session_id, updated_at, deleted_at);
```

#### Soft Delete Strategy

Records are **not** hard-deleted immediately. Instead:
1. Set `deleted_at` timestamp
2. Sync clients receive deletion notifications
3. Background job purges old tombstones after 90 days

Benefits:
- Enables reliable sync of deletions
- Allows "undo" functionality (future)
- Prevents sync conflicts with offline clients

#### Table: `sync_metadata` (Optional)

```sql
CREATE TABLE sync_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT DEFAULT NULL,
  session_id TEXT DEFAULT NULL,
  device_id TEXT NOT NULL,
  last_sync_at INTEGER NOT NULL,
  sync_type TEXT NOT NULL CHECK(sync_type IN ('full', 'incremental')),
  records_synced INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_sync_metadata_user_device ON sync_metadata(user_id, device_id);
CREATE INDEX idx_sync_metadata_session_device ON sync_metadata(session_id, device_id);
```

Purpose:
- Track sync history per device
- Debug sync issues
- Analytics on sync patterns

---

## Offline-First Sync Strategy

### Architecture Overview

```
┌─────────────────────┐
│   React Frontend    │
│  (Same Public API)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Storage Adapter    │
│  (Dual-Mode Logic)  │
└─────┬───────────┬───┘
      │           │
      ▼           ▼
┌──────────┐  ┌────────────┐
│ Dexie/   │  │ Hono API   │
│ IndexedDB│  │ (REST)     │
└──────────┘  └─────┬──────┘
                    │
                    ▼
              ┌──────────┐
              │ D1 (SQL) │
              └──────────┘
```

### Sync Modes

#### Mode 1: Offline-Only (Current Behavior)
- All operations use IndexedDB
- No network calls
- No sync metadata tracked
- Default for unauthenticated users

#### Mode 2: Online-First
- Primary writes go to server
- IndexedDB acts as cache
- Sync on reconnection if write fails
- Best for desktop/reliable connections

#### Mode 3: Offline-First (Recommended)
- All writes go to IndexedDB immediately
- Background sync pushes changes to server
- Pull changes from server periodically
- Conflict resolution with last-write-wins

### Sync Implementation Strategy

#### Client-Side Changes

```typescript
// New: src/lib/sync.ts

interface SyncState {
  lastSyncTimestamp: number;
  pendingChanges: {
    created: string[];    // IDs of local-only records
    updated: string[];    // IDs of modified records
    deleted: string[];    // IDs awaiting server deletion
  };
  isSyncing: boolean;
}

class SyncManager {
  async sync(userId?: string, sessionId?: string): Promise<SyncResult>;
  async pushChanges(): Promise<void>;
  async pullChanges(): Promise<void>;
  async resolveConflicts(conflicts: Conflict[]): Promise<void>;
}
```

#### Sync Workflow

1. **On App Load (Online)**
   - Check if `lastSyncTimestamp` exists in localStorage
   - If yes, call `/api/v1/sync` with timestamp
   - Merge server changes into IndexedDB
   - Resolve conflicts (last-write-wins)

2. **On User Action (Create/Update/Delete)**
   - Write to IndexedDB immediately (instant UI update)
   - Queue change in `pendingChanges` metadata
   - Trigger background sync if online

3. **Background Sync (Every 30s or on visibility change)**
   - Push `pendingChanges` to server
   - Pull updates since `lastSyncTimestamp`
   - Update `lastSyncTimestamp` on success
   - Clear synced items from `pendingChanges`

4. **Reconnection After Offline**
   - Trigger immediate sync
   - Show sync status indicator
   - Handle bulk conflict resolution

### Conflict Resolution: Last-Write-Wins

```typescript
interface Conflict {
  id: string;
  clientVersion: SpringCalcRecord & { updated_at: number };
  serverVersion: SpringCalcRecord & { updated_at: number };
}

function resolveConflict(conflict: Conflict): SpringCalcRecord {
  // Simple: Choose record with latest updated_at
  if (conflict.clientVersion.updated_at > conflict.serverVersion.updated_at) {
    return conflict.clientVersion;
  }
  return conflict.serverVersion;
}
```

**Alternative:** User-prompted conflict resolution (future enhancement)

### Data Consistency Guarantees

1. **Idempotency:** All API endpoints are idempotent (safe to retry)
2. **Atomic Sync:** Sync endpoint uses D1 transactions
3. **Eventual Consistency:** All devices converge to same state after sync
4. **No Data Loss:** Local IndexedDB is source of truth until confirmed synced

---

## Security and Authentication

### Phase 1: Anonymous Users (MVP)

**Approach:** Session-based identification without accounts

- Generate UUID `session_id` on first visit (stored in localStorage)
- All API calls include `session_id` in header or cookie
- Server associates calculations with `session_id`
- No email, password, or OAuth required

**Pros:**
- Zero friction onboarding
- Works immediately offline
- No GDPR/privacy concerns (anonymous data)

**Cons:**
- Data lost if localStorage cleared
- No cross-device sync
- No account recovery

**Implementation:**
```typescript
// Client: Generate and persist session ID
const sessionId = localStorage.getItem('sessionId') || crypto.randomUUID();
localStorage.setItem('sessionId', sessionId);

// Send with every request
headers: {
  'X-Session-ID': sessionId
}
```

### Phase 2: Optional User Accounts

**Approach:** Email + magic link authentication (passwordless)

- Users can optionally "claim" their anonymous session
- Send magic link to email → authenticates → associates session with user ID
- Enables cross-device sync with user account
- Allows migration from anonymous to authenticated without data loss

**Technology Options:**

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **Cloudflare Access** | Native CF integration, free tier, JWT | Requires domain config, enterprise-focused | ✅ Good fit |
| **Auth0** | Full-featured, great DX | Costs $ above free tier | ❌ Overkill |
| **WorkerAuth** | Open-source, D1-based | Maintain yourself | ⚠️ Consider |
| **Custom JWT** | Full control, no deps | Implement security yourself | ❌ Not recommended |
| **Clerk** | Modern, React-first | Costs $, external dependency | ⚠️ Consider |

**Recommended:** Start with **Cloudflare Access** (Zero Trust) or **custom magic links** with D1 session storage.

### Phase 3: API Security (Production)

#### Rate Limiting
```typescript
// Cloudflare Worker rate limiting
const rateLimiter = {
  limit: 100,        // requests
  window: 60 * 1000, // per 60 seconds
};

// Use CF rate limiting API or Redis-based
if (await isRateLimited(sessionId)) {
  return new Response('Rate limit exceeded', { status: 429 });
}
```

#### Input Validation
```typescript
// Use Zod or similar for request validation
import { z } from 'zod';

const CalculationSchema = z.object({
  id: z.string().uuid(),
  manufacturer: z.string().min(1).max(255),
  partNumber: z.string().min(1).max(255),
  d: z.number().positive(),
  D: z.number().positive(),
  n: z.number().positive(),
  // ...
});
```

#### CORS Configuration
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://spring-rate-calculator.benhalverson.workers.dev',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-ID',
  'Access-Control-Max-Age': '86400',
};
```

#### Content Security Policy
```typescript
const cspHeader = 
  "default-src 'self'; " +
  "connect-src 'self' https://*.benhalverson.workers.dev; " +
  "script-src 'self' 'unsafe-inline'; " +
  "style-src 'self' 'unsafe-inline';";
```

---

## Migration Plan

### Phase 0: Preparation (Week 1)

- [ ] Spike approval and feedback incorporation
- [ ] Create feature branch: `feature/d1-hono-backend`
- [ ] Set up D1 database in Cloudflare dashboard
- [ ] Initialize Hono project structure in `/api` directory

### Phase 1: Backend Implementation (Weeks 2-3)

- [ ] Implement Hono API routes (CRUD endpoints)
- [ ] Create D1 schema migration scripts
- [ ] Add Zod request validation
- [ ] Implement basic error handling
- [ ] Add session-based identification
- [ ] Write integration tests for API endpoints
- [ ] Deploy staging environment

### Phase 2: Storage Adapter (Week 4)

- [ ] Create `src/lib/storage-adapter.ts` with dual-mode logic
- [ ] Implement feature flag to toggle online/offline mode
- [ ] Add sync manager (`src/lib/sync.ts`)
- [ ] Update `src/lib/db.ts` to use adapter
- [ ] Ensure existing tests pass with offline mode
- [ ] Add new tests for sync scenarios

### Phase 3: Sync Implementation (Week 5)

- [ ] Implement `/api/v1/sync` endpoint
- [ ] Add background sync logic in frontend
- [ ] Implement conflict resolution (last-write-wins)
- [ ] Add sync status UI indicator
- [ ] Handle offline/online transitions
- [ ] Test with multiple devices

### Phase 4: Testing & Refinement (Week 6)

- [ ] End-to-end testing (offline → online → sync)
- [ ] Performance testing (large datasets)
- [ ] Error scenario testing (network failures, conflicts)
- [ ] Security audit (input validation, rate limiting)
- [ ] Documentation updates

### Phase 5: Gradual Rollout (Week 7+)

- [ ] Deploy to production with feature flag disabled
- [ ] Enable for 10% of users (A/B test)
- [ ] Monitor error rates and performance
- [ ] Gradually increase to 50%, then 100%
- [ ] Remove feature flag after stabilization

### Rollback Plan

If issues arise:
1. Disable feature flag (instant rollback to local-only)
2. All data remains in IndexedDB (no data loss)
3. Fix issues in staging
4. Re-enable after validation

---

## Risk Assessment

### Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| D1 performance issues with large datasets | High | Low | Implement pagination, indexing strategy, test with 10k+ records |
| Sync conflicts causing data loss | Critical | Medium | Comprehensive testing, conflict resolution UI, server-side audit log |
| IndexedDB quota exceeded on devices | Medium | Low | Monitor storage usage, add cleanup for old records |
| Network latency degrading UX | Medium | Medium | Optimistic UI updates, retry logic, offline indicators |
| Cloudflare Workers cold start latency | Low | Medium | Keep-alive requests, accept 100-200ms p99 latency |

### Migration Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Breaking changes to `db.ts` API | Critical | Low | Maintain 100% API compatibility, extensive testing |
| Data loss during migration | Critical | Very Low | IndexedDB remains source of truth, no destructive changes |
| Users confused by sync behavior | Medium | Medium | Clear UI indicators, documentation, onboarding |

### Security Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Unauthorized access to calculations | Medium | Low | Session validation, rate limiting, input sanitization |
| SQL injection in D1 queries | Critical | Very Low | Use parameterized queries (D1 best practice) |
| XSS through user-generated notes | High | Low | Sanitize all user inputs, CSP headers |

---

## Success Metrics

### Technical Metrics

- **API Latency:** p50 < 100ms, p99 < 500ms
- **Sync Success Rate:** > 99.9%
- **Offline Capability:** 100% feature parity with current app
- **Database Size:** Support up to 10,000 calculations per user
- **Test Coverage:** Maintain current coverage (>80%)

### User Metrics

- **Data Loss Rate:** 0% (critical)
- **Sync Errors:** < 0.1% of sync attempts
- **Time to First Sync:** < 3 seconds after app load
- **Cross-Device Adoption:** Track % of users with >1 device (future)

### Business Metrics

- **Zero Downtime:** Migration doesn't interrupt service
- **Cost:** D1 free tier sufficient for first 1,000 users
- **Development Time:** 6-7 weeks to production

---

## Open Questions for Review

1. **Conflict Resolution:** Is last-write-wins acceptable, or do we need user-prompted resolution?
2. **Data Retention:** Should we purge old calculations after X months for anonymous users?
3. **Export/Import:** Should we add data export before enabling cloud sync (user safety)?
4. **Multi-Device:** Should we show device identifiers in UI for debugging?
5. **Billing:** At what user scale do we need to revisit D1 costs?

---

## Appendix A: Hono Project Structure

```
/api
├── src/
│   ├── index.ts              # Hono app entry point
│   ├── routes/
│   │   ├── calculations.ts   # CRUD routes
│   │   └── sync.ts           # Sync endpoint
│   ├── middleware/
│   │   ├── auth.ts           # Session validation
│   │   ├── cors.ts           # CORS headers
│   │   ├── errors.ts         # Error handling
│   │   └── rateLimit.ts      # Rate limiting
│   ├── db/
│   │   ├── schema.sql        # D1 schema definition
│   │   ├── migrations/       # Migration scripts
│   │   └── queries.ts        # Type-safe query builders
│   ├── lib/
│   │   ├── validation.ts     # Zod schemas
│   │   └── utils.ts          # Helpers
│   └── types/
│       └── api.ts            # Shared types with frontend
├── tests/
│   ├── calculations.test.ts
│   └── sync.test.ts
├── wrangler.toml             # Cloudflare config
├── package.json
└── tsconfig.json
```

### Minimal `wrangler.toml` Addition

```toml
[[d1_databases]]
binding = "DB"
database_name = "spring-rate-calculator"
database_id = "<generated-id>"
```

---

## Appendix B: Frontend Storage Adapter Example

```typescript
// src/lib/storage-adapter.ts

interface StorageBackend {
  addCalculation(record: SpringCalcRecord): Promise<void>;
  listCalculations(): Promise<SpringCalcRecord[]>;
  deleteCalculation(id: string): Promise<void>;
  bulkDeleteCalculations(ids: string[]): Promise<void>;
  clearCalculations(): Promise<void>;
}

class IndexedDBBackend implements StorageBackend {
  // Current Dexie implementation
}

class HybridBackend implements StorageBackend {
  private local: IndexedDBBackend;
  private syncManager: SyncManager;

  async addCalculation(record: SpringCalcRecord): Promise<void> {
    // Write to IndexedDB immediately
    await this.local.addCalculation(record);
    
    // Queue for sync
    this.syncManager.queueChange('created', record.id);
    
    // Background sync
    this.syncManager.scheduleSyncIfOnline();
  }

  // ... implement other methods similarly
}

// Feature flag
const useHybridBackend = 
  import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true';

export const storage: StorageBackend = useHybridBackend
  ? new HybridBackend()
  : new IndexedDBBackend();
```

---

## Conclusion

This design provides a clear path to migrate the Spring Rate Calculator to a cloud-backed architecture while preserving its offline-first strengths. The phased approach minimizes risk, the storage adapter pattern avoids breaking changes, and the sync strategy ensures data consistency across devices.

**Next Steps:**
1. Review and approve this design document
2. Assign implementation team
3. Begin Phase 0 (preparation) tasks

**Questions or feedback?** Please comment on the GitHub issue or reach out to the backend architecture team.
