# Spring Rate Calculator

Offline-first spring rate calculator for RC/coil spring setup work.

Live URL: https://spring-rate-calculator.benhalverson.workers.dev

The app lets you enter spring geometry and computes spring rate using the physical coil spring equation with a spring-steel shear modulus assumption:

- $D_{avg} = D - d$
- $k = \dfrac{G \cdot d^4}{8 \cdot n \cdot D_{avg}^3}$

## What the app does

- Calculates spring rate from:
  - wire diameter `d`
  - coil outer diameter `D`
  - active coils `n`
- Supports unit labels (`mm` / `in`) and applies the corresponding spring-steel `G` value.
- Validates inputs and blocks invalid saves.
- Includes an animated spring visualizer that changes feel with `k`.
- Saves calculations locally in IndexedDB (works offline).
- Provides sortable saved history with load/delete/clear actions.
- Includes PWA support (service worker + manifest) and install prompt handling.

## Tech stack

- React + TypeScript + Vite
- Tailwind CSS
- Dexie (IndexedDB wrapper)
- Framer Motion
- Vitest + Testing Library
- Biome (lint/format)
- Cloudflare Vite plugin + Wrangler (deployment)

## Clone and run locally

### Prerequisites

- Node.js 20+
- pnpm 10+

### 1) Clone

```bash
git clone <your-repo-url>
cd spring-rate-calculator
```

### 2) Install dependencies

```bash
pnpm install
```

### 3) Build assets (required for Wrangler local serve)

```bash
pnpm build
```

### 4) Start local dev with Wrangler

```bash
pnpm dev
```

Then open the local URL printed by Wrangler (usually `http://localhost:8787`).

API health endpoint:

- `GET /api/v1/health`

## Useful scripts

- `pnpm dev` — run local Worker dev server via Wrangler
- `pnpm dev:vite` — run Vite dev server only (frontend only)
- `pnpm build` — type-check + production build
- `pnpm preview` — preview production build locally
- `pnpm lint` — run Biome checks
- `pnpm format` — format source with Biome
- `pnpm test` — run test suite
- `pnpm test --coverage` — run tests with coverage
- `pnpm deploy` — build and deploy with Wrangler

## Deployment

This repo is configured for Cloudflare Workers deployment via Wrangler.

Before first deploy, authenticate Wrangler:

```bash
pnpm wrangler login
```

Then deploy:

```bash
pnpm deploy
```

## CI/CD (GitHub Actions)

This repo includes a CI workflow:

- [.github/workflows/ci.yml](.github/workflows/ci.yml)
  - Runs on PRs to `main` and pushes to `main`
  - Executes: lint, test with coverage, build

Deployment is handled by Cloudflare dashboard Git integration (auto-deploy on `main`).

### Recommended branch protection

For `main`, require the `CI` workflow check to pass before merging.

## Architecture & Design

For detailed technical design documentation, see:

- [D1 + Hono Backend Migration Design](docs/d1-hono-migration-design.md) - Technical spike for migrating from local-only storage to cloud-backed persistence with offline-first sync

## Testing Library Peer Dependencies

This project explicitly includes `@testing-library/dom` in `devDependencies` to ensure stable and deterministic test environments. While both `@testing-library/react` and `@testing-library/user-event` declare it as a peer dependency, we include it explicitly for the following reasons:

1. **Stability**: Guarantees a specific version across all environments (local dev, CI, and other contributors' machines).
2. **Determinism**: Prevents scenarios where peer dependency resolution could change with package manager updates or different install contexts.
3. **Clarity**: Makes the complete dependency graph explicit and visible in `package.json`.

When updating Testing Library packages, verify that the explicit `@testing-library/dom` version satisfies the peer dependency requirements of both `@testing-library/react` and `@testing-library/user-event`. Use `pnpm list @testing-library/dom --depth=1` to check the dependency tree.
