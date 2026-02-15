# AGENTS.md — Spring Rate Calculator (React + Vite + Cloudflare) — Offline-First PWA + IndexedDB + Spring Animations

## Objective
Build an **offline-first PWA** that calculates spring rate **k** from user inputs and can **save results to IndexedDB**, with a **springy animation/visualization** that responds to different values.

## Inputs (user-entered)
The user must fill in:
- **d**: wire diameter (little d)
- **D**: coil outer diameter (OD) (big D)
- **n**: number of active coils (N / active coils)

## Formula (implemented)
- **k = (G · d^4) / (8 · n · Davg^3)**
- Spring steel shear modulus assumption:
  - **G = 79,000 N/mm²** when units are `mm`
  - **G = 11,500,000 psi** when units are `in`

### Davg (derived)
User provides **OD (D)**. Derive:
- **Davg = D − d**

UI must display Davg explicitly as: `Davg = D − d`.

## Units
This calculator is **unit-consistent** with a fixed spring-steel modulus assumption applied per selected unit system.
- Provide a **units selector**: `mm` / `in`
- Units toggle affects **labels only** (no automatic conversion required)
- Display note: “Use consistent units for d and D.”

## Validation Rules
Block calculation and saving (show inline errors) if any are true:
- d <= 0
- D <= 0
- n <= 0
- Davg = (D − d) <= 0  (i.e., D must be greater than d)

Additional save-time validation:
- Manufacturer is required
- Part number is required
- Purchase URL must be a valid URL when provided

Optional warning (non-blocking):
- n is not an integer → “Active coils is typically an integer.”

## Core UX Requirements (UI Structure)
Single-page layout with three sections:
1) **Calculator**
2) **Spring Visualizer**
3) **Saved Results (IndexedDB)**

### Top App Bar (sticky)
- App title: “Spring Rate”
- **Online/Offline** status pill using `navigator.onLine`
- Units segmented toggle: `mm | in`
- Optional “Install” button (only when available)
- Theme toggle: dark/light
- iOS Safari install guidance text (Share → Add to Home Screen)

### Calculator Card
- Inputs: d, D (OD), n (decimals allowed)
- Source details: manufacturer (required), part number (required), purchase URL (optional), notes (optional)
- Derived row: `Davg = D − d = ...`
- Result panel: `k = ...` (only when valid; otherwise show “—”)
- Buttons: **Save** (disabled unless valid), **Reset**

### Saved Results Card
- List saved calculations (newest first)
- Item shows:
  - timestamp
  - units
  - d, D, n
  - Davg
  - k
- Actions per item: **Load** (optional), **Delete**
- Global action: **Clear all** (with inline confirm)

### Offline Indicator
- Text badge/pill: “Online” / “Offline (working locally)”
- Must not block Save/History when offline

## Implementation Plan

### 1) Pure math + validation (no React)
Create: `src/lib/springRate.ts`

Exports:
- `computeDavg(D: number, d: number): number`
- `computeK(d: number, n: number, Davg: number): number`
- `computePhysicalK(G: number, d: number, n: number, Davg: number): number`
- `getSpringSteelShearModulus(units: "mm" | "in"): number`
- `validateInputs(d: number, D: number, n: number): { ok: boolean; errors: Record<string,string>; warnings: Record<string,string> }`

Notes:
- Unit-agnostic
- Do not compute k when invalid

### 2) IndexedDB wrapper
Create: `src/lib/db.ts`

Dependency used:
- `Dexie`

DB:
- Name: `spring-rate-db`
- Store: `calculations`
- Key: `id`
- Index: `createdAt`

Record shape:
- `id: string` (uuid)
- `createdAt: number` (epoch ms)
- `units: "mm" | "in"`
- `d: number`
- `D: number`
- `n: number`
- `Davg: number`
- `k: number`

Exports:
- `addCalculation(record): Promise<void>`
- `listCalculations(): Promise<SpringCalcRecord[]>` (sorted `createdAt` desc)
- `deleteCalculation(id: string): Promise<void>`
- `clearCalculations(): Promise<void>`

### 3) PWA setup (offline-first)
Add `vite-plugin-pwa` and configure in `vite.config.ts`:

Requirements:
- `registerType: "autoUpdate"`
- Workbox precache for app shell (default precache)
- SPA fallback to `/index.html`
- Manifest:
  - `name`, `short_name`
  - `start_url: "/"`
  - `display: "standalone"`
  - `theme_color`, `background_color`
  - icons: at least 192x192 and 512x512

Assets:
- `public/manifest.webmanifest` (or plugin-generated)
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`

Offline acceptance:
- After first load, subsequent loads offline must render the calculator and history.

### 4) Main Calculator UI
Create: `src/components/SpringRateCalculator.tsx`

State (strings for better input UX):
- `d: string`, `D: string`, `n: string`
- `units: "mm" | "in"`
- `errors`, `warnings`
- `history: SpringCalcRecord[]`
- `isOffline: boolean`

Derived:
- parse to numbers safely
- `Davg = D - d` (when parseable)
- `k = (G * d^4) / (8 * n * Davg^3)` (only when valid)

Lifecycle:
- On mount: `listCalculations()` → set history
- Listen for `online` / `offline` events → set isOffline

Actions:
- Save:
  - validate
  - compute Davg + k
  - create record (uuid + createdAt)
  - add to IndexedDB
  - update history (optimistic insert or re-fetch)
- Delete:
  - deleteCalculation → refresh history
- Clear all:
  - clearCalculations → set history []
- Reset:
  - clear inputs + errors/warnings

### 5) Spring Visualization + Animations (Required)
Goal: show a spring animation that looks/feels different for different k values.
- Low k → bouncy + more deflection
- High k → stiff + less deflection

Dependency:
- `framer-motion`

Create: `src/components/SpringViz.tsx`

Props:
- `k?: number`
- `d?: number`
- `D?: number`
- `n?: number`
- `units: "mm" | "in"`

Rendering approach:
- Render an **SVG spring coil** path (sine-wave coil) inside a group.
- Animate via transforms (`scaleY`) rather than regenerating geometry every frame.
- Use `vector-effect="non-scaling-stroke"`.

Animation behaviors:
1) **Auto “tap”** when valid k changes:
   - compress then release (“boing”)
   - anchored at top (`transformOrigin: "50% 0%"`)
2) **Interactive Load slider** (0–100%):
   - continuous compression
   - slider changes `scaleY` based on load and k mapping

Mapping k → “feel”:
- Use log normalization to keep it stable:
  - `kSafe = max(k, 1e-12)`
  - `kLog = log10(kSafe)`
  - clamp: `kLogMin = -6`, `kLogMax = 6`
  - `kNorm = clamp((kLog - kLogMin) / (kLogMax - kLogMin), 0, 1)`

Map to framer-motion spring params:
- `stiffness = lerp(80, 600, kNorm)`
- `damping   = lerp(10, 40, kNorm)`
- `maxCompression = lerp(0.35, 0.08, kNorm)`

Performance rules:
- Do not rebuild SVG path every animation frame.
- Clamp visible coil count: `turns = clamp(round(n), 4, 12)`.

Placement:
- SpringViz card sits under/next to calculator results (responsive).

### 6) UI Design Requirements (Layout)
Desktop:
- Two-column top: Calculator (left) + Spring Visualizer (right)
- Full-width bottom: Saved list

Mobile:
- Single column stack: Calculator → Visualizer → Saved list

Microinteractions:
- Result panel pop-in when valid
- Field shake on invalid save attempt
- Toast on save/delete/clear

## Cloudflare Deployment Notes
- Build output: `dist/`
- Deploy as static site
- Ensure service worker/manifest are served correctly (plugin defaults are OK)

## Definition of Done (Acceptance Criteria)
PWA:
- Installable
- Works offline after first load
- Auto-update enabled

Calculator:
- Correct k computation using implemented formula with spring-steel `G`
- Davg shown explicitly
- Validation blocks invalid values
- Save disabled when invalid

IndexedDB:
- Save persists across reloads
- History works offline
- Delete and clear all work

Animations:
- Spring “boing” on valid k change
- Load slider compresses spring
- Low k compresses more and bounces longer than high k
