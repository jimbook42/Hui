# Hui

Privacy-first PWA for recurring groups and gatherings. The app proposes, coordinates, and remembers; the group decides.

## Development status

**Phase 0 — Foundation** is complete for the initial scaffold and workflow docs. Application features (auth, groups, events) have not started. See [ROADMAP.md](./ROADMAP.md).

## Prerequisites

- Node.js 20+
- npm

## Install

```bash
npm install
```

Copy environment template and set Supabase URL + publishable key from the project Connect panel:

```bash
cp .env.example .env.local
```

Required variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Validation

```bash
npm run build
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

E2E tests start the dev server via Playwright; first run may require `npx playwright install chromium`.

## Project docs

| Document | Purpose |
| --- | --- |
| [ROADMAP.md](./ROADMAP.md) | Phases, current ticket, progress |
| [WORKLOG.md](./WORKLOG.md) | Completed ticket log |
| [DECISIONS.md](./DECISIONS.md) | Decisions agents must not reverse |
| [TODO.md](./TODO.md) | Unresolved implementation questions |
| [docs/PRODUCT.md](./docs/PRODUCT.md) | Concise product reference |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Stack and layering |
| [docs/DATA_MODEL.md](./docs/DATA_MODEL.md) | Conceptual data model |

## Stack

Next.js, TypeScript, Tailwind CSS, Supabase (planned), Vitest, Playwright.
