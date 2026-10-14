# Releasing Hui

## Version number

The app version lives in **`package.json`** (`version` field). The UI footer and support copy read it from there — do not hard-code versions elsewhere.

**Current line:** `0.17.0` — pre-beta: the core coordination loop is largely in place (propose → respond → confirm → recurring cycle, notifications, profile), but we have not declared a public beta yet. `0.9.x` signals “almost beta” without implying production GA.

**Previous release:** `0.16.2` — pre-beta: the core coordination loop is largely in place (propose → respond → confirm → recurring cycle, notifications, profile), but we have not declared a public beta yet. `0.9.x` signals “almost beta” without implying production GA.

## When to bump

Bump the version **in the same ticket/PR** that ships the release (or the last PR before deploy), then deploy from that commit.

| Change | Bump |
|--------|------|
| Bug fix, copy, small UX patch | **Patch** — e.g. `0.9.0` → `0.9.1` |
| New feature or user-visible capability | **Minor** — e.g. `0.9.1` → `0.10.0` |

Reset patch to `0` when you increment minor. Reserve **major** (`1.0.0`) for a declared beta/GA milestone.

## Deploy label

Production builds expose a short git SHA via `NEXT_PUBLIC_HUI_BUILD_SHA` / Vercel (`buildStamp()`). The footer shows `Hui vX.Y.Z · <sha>` so QA can match a screen to a deployment.
