# Hui

Privacy-first PWA for recurring groups and gatherings. The app proposes, coordinates, and remembers; the group decides.

## Development status

**Phase 0 — Foundation** includes the app scaffold and the Supabase schema in `supabase/migrations`. Auth and product UI have not started. See [ROADMAP.md](./ROADMAP.md).

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

Run the same core checks locally (matches the main CI job except E2E):

```bash
npm run validate
```

End-to-end tests (also run in CI after Playwright browser install):

```bash
npm run test:e2e
```

First E2E run locally may require `npx playwright install chromium`.

### Continuous integration

GitHub Actions runs on pushes and pull requests to `main` (see [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)): lint, typecheck, unit tests, production build, and Playwright E2E.

## Project docs

| Document | Purpose |
| --- | --- |
| [ROADMAP.md](./ROADMAP.md) | Phases, current ticket, progress |
| [WORKLOG.md](./WORKLOG.md) | Completed ticket log |
| [DECISIONS.md](./DECISIONS.md) | Decisions agents must not reverse |
| [TODO.md](./TODO.md) | Unresolved implementation questions |
| [docs/PRODUCT.md](./docs/PRODUCT.md) | Concise product reference |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Stack and layering |
| [docs/DATA_MODEL.md](./docs/DATA_MODEL.md) | Implemented data model |

## Stack

Next.js, TypeScript, Tailwind CSS, Supabase, Vitest, Playwright.
