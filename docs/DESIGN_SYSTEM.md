# Hui visual design system (HUI-026U)

HUI-026U establishes the shared visual foundation for **HUI-026C** (dashboard), **HUI-026D** (event management), **HUI-026E** (contributions), and later V1 surfaces. It does not change product semantics.

## Principles

- Warm, calm, mobile-first coordination — not a generic SaaS dashboard or social feed.
- **The group decides:** consensus and attendance are visible; private notes and reasons never leak into visuals or labels.
- Lifecycle-aware hierarchy: primary task first, management and history secondary.
- Preserve HUI-026P performance: Suspense, `loading.tsx`, optimistic attendance, no new heavy client bundles.

## Tokens

Defined in `src/app/globals.css` as CSS variables and mapped into Tailwind via `@theme inline`.

| Token family | Purpose |
| --- | --- |
| `background`, `surface`, `surface-elevated` | Page and card layers |
| `primary`, `secondary`, `muted` | Actions and subtle fills |
| `foreground`, `muted-foreground`, `border` | Text and dividers |
| `success`, `warning`, `destructive`, `info` | Feedback (use sparingly) |
| `attendance-*` | Gathering ring states (never colour-only — see below) |
| `radius-hui-*`, `--shadow-*`, `--motion-*` | Shape, elevation, motion |

Typography utility classes: `hui-type-display`, `hui-type-page-title`, `hui-type-section`, `hui-type-body`, `hui-type-supporting`, `hui-type-label`.

Interaction: `hui-focus-ring` for keyboard focus; `prefers-reduced-motion` respected globally.

## Core components (`src/components/hui/`)

| Component | Role |
| --- | --- |
| `HuiButton` | Primary actions |
| `HuiSurface` | Bordered surfaces (replaces ad-hoc card stacks) |
| `SectionHeader` | Section titles + supporting copy |
| `EventStatusPill` / `StatusPill` | Lifecycle labels without banner noise |
| `AttendanceDot` | Single-member attendance state |
| `GatheringVisual` | Members around a central gathering |
| `AttendanceLegend` | Non-colour-only key for attendance shapes |
| `EventHero` | Event summary hierarchy (what / when / who / where) |
| `EventLocationPanel` | Static map-style **event location** context (no tracking) |
| `EmptyState` | Calm empty surfaces |
| `MobileNav` | Mobile bottom navigation (desktop keeps header links) |

Domain helpers: `gathering-layout.ts`, `attendance-visual.ts` (Vitest covered).

## Gathering visual

- Members are placed on a stable ellipse (`layoutGatheringRing`); more than 12 members show `+N more`.
- States map to roster data: `yes` → can come, `maybe` → could make it work (if enabled), `no` → can't come, `null` → no answer yet.
- Differentiation: solid + inner dot (yes), dashed ring (maybe), faded × (no), dotted outline (pending).
- Accessible list in `.sr-only`; per-dot `aria-label` uses display name + state only — **no private notes**.

## Map / location

`EventLocationPanel` is decorative topography plus pin — it reinforces **where the gathering is**, not live maps or member geography. No new map provider or dependency.

## Reference material (HUI-026U.2)

See `docs/reference/REFERENCE_INDEX.md` for paths. The first 026U pass did **not** have these files; 026U.2 aligned tokens and components to them.

| Area | Reference | 026U.1 | 026U.2 adaptation |
| --- | --- | --- | --- |
| Gathering | Logo ring + map avatar rings | Ellipse + generic hub | `HuiGatheringMark` hub, outer ring, initials on dots |
| Attendance | Photo piles + RSVP pills | State rings | Initials in dots; Hui labels (not “RSVP’d”) |
| Location | Illustrated map + sheet | Simple topo SVG | Richer illustrated `EventLocationPanel` (still static) |
| Event hierarchy | Date blob + card | Text-first hero | `EventDateBadge` + gathering block above metadata |
| Navigation | 5-tab bar incl. Messages | 4-tab product nav | Kept 4 destinations; reference styling only |
| Typography / colour | Forest green + cream | Terracotta primary | Forest green primary, parchment background |
| Surfaces | Soft cards, large radius | Modest radius | `rounded-hui-xl`, softer elevation |

Features shown in references but **not** in Hui (Messages tab, live map, distance, profile photos as attendance) were **not** built.

## Accessibility

- Minimum touch targets on primary flows (`min-h-11` on touch buttons).
- Focus rings on interactive controls.
- Attendance never relies on colour alone.
- Location panel duplicates address text below the visual.

## Future tickets

- **026C:** Event-oriented dashboard using these primitives.
- **026D:** Dedicated manage surface styling.
- **026E:** Contribution flow visual pass.
- Host/dietary/group admin pages: partial token adoption only in 026U; full migration deferred.

## Redesign update (HUI-026U full rewrite)

- **Palette:** light `#F7F4EE` canvas / `#1A4331` forest primary / `#7DA1B5` blue / `#D8BCA8` clay; dark is a deep green family (`#0D1612`, `#15221C`, `#1E2E26`), not neutral grey. Theme = `data-theme` on `<html>`, device-local preference in `localStorage["hui-theme"]` (system | light | dark), applied by an inline head script.
- **Geometry:** `hui-shape-*` organic radii (~32px, asymmetric), tint blobs, `color-mix()` tints, no thin borders or dividers. Component classes (`hui-btn`, `hui-input`, `hui-card-section` …) live in `@layer components` so Tailwind utilities can override them.
- **Primitives (`src/components/hui/`):** HuiSurface, HuiButton, EventCard, EventHero, GatheringVisual, AttendanceDot, AttendanceChoice, LocationPanel (static seeded SVG map), SectionHeader, EmptyState, AvatarStack, BottomNavigation, StatusPill, DisclosureCard.
- **Information architecture:** bottom nav Home, Hui (`/events`), Groups, Alerts (`/notifications`), You (`/profile`). `/events` and `/events/new` (group picker) are new. Event detail answers what/when/where/my status/who/attention first; everything else sits behind "Details" disclosures (legacy sections are embedded via `.hui-embedded`).
- **Motion:** CSS only (`hui-rise`, `hui-pop`, `hui-breathe`), all disabled under `prefers-reduced-motion`.
- **Tailwind scanning** is limited to `src/` (`@import "tailwindcss" source("../")`) — scanning repo-root temp/binary files corrupts the CSS.
- **Deferred:** live system-theme change without reload, map tiles / geocoding (intentionally none), refreshing the stale legacy e2e specs.
