# ShiftSwap — Frontend

A Vue 3 single-page application for **ShiftSwap**: a multi-tenant SaaS for shift scheduling and swap management. This repository contains the frontend UI only; the API backend lives in [`shiftswap-api`](../shiftswap-api).

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Vue 3 (Composition API, `<script setup>`) |
| Language | TypeScript |
| Build | Vite 8 |
| Styles | Tailwind CSS 4 |
| Type checking | `vue-tsc` |

---

## Project Structure

```
shiftswap-frontend/
├── src/
│   ├── api/           # Typed REST API clients (auth, shifts, swaps, timeOff, locations, staff)
│   ├── layouts/       # AppLayout with collapsible Kanagawa Dragon Sumi sidebar & top bar
│   ├── router/        # Vue Router with navigation guards and role-based redirects
│   ├── stores/        # Pinia state stores (auth, undo store with countdown grace window)
│   ├── types/         # TypeScript API contracts and payload definitions
│   ├── views/         # Route views (Dashboard, Schedule, Swaps, TimeOff, Team, Settings, etc.)
│   ├── App.vue        # Global shell and UndoToastNotification provider
│   ├── main.ts        # Entry point configuring Pinia and Vue Router
│   └── style.css      # Tailwind CSS 4 theme & Kanagawa Shift Atelier tokens
├── DESIGN.md          # Comprehensive Kanagawa design system specification
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## Design System

The application implements the **Kanagawa Shift Atelier** operational design system:
- **Palette**: Lotus Parchment canvas (`#F2EFE9`), Dragon Sumi ink sidebar (`#16181D`), Wave Indigo accent (`#2D4F67`), Carp Gold (`#C0A36E`), and Spring Moss (`#76946A`).
- **Typography**: Plus Jakarta Sans for UI headers/body, and Space Mono / IBM Plex Mono for tabular shift times and swap boarding pass codes (`#SW-1`).
- See [`DESIGN.md`](./DESIGN.md) for the design tokens, component anatomy, and accessibility patterns.

---

## Features

- **Executive & Staff Dashboard** — 3-second counter brief, interactive schedule tape, week/month calendar modes, and live peer swap marketplace.
- **Schedule Management** — Interactive week grid with live conflict detection, multi-location selector, drag/drop creation, and staff assignment.
- **Peer Shift Swap Marketplace & Claims** — Two-stub boarding passes, single-claim lock, manager approval gate, and staff claim cancellation (`withdraw`) with 4-second undo grace window.
- **Time-Off & Leave Management** — Request filing, balance checks, calendar blocking, and conflict audit during schedule drafting.
- **4-Second Undo System** — Non-blocking optimistic UI with countdown timers for critical actions (swap cancellation, approval, claim withdrawal).
- **Executive Command & Payroll Tape** — Biometric punch audit, overtime tracking, stipend ledger, and multi-location labor distribution.
- **Multi-Tenant Authentication** — Sanctum Bearer token session, reactive business switching, invitation acceptance flow, and ownership transfer.

---

## Roles

The system enforces three roles per business (defined in the API spec):

| Role | Capabilities |
|---|---|
| `owner` | Full access — manage staff, roles, locations, and settings |
| `manager` | Create/edit shifts, approve swaps and time-off requests |
| `staff` | View own schedule, offer/request shift swaps, submit time-off |

---

## API Integration (upcoming)

All API calls will use the base URL configured via an environment variable:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Key endpoints (see [`shiftswap-api/docs/SPEC.md`](../shiftswap-api/docs/SPEC.md) for the full contract):

```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/user

GET  /api/shifts
POST /api/shifts

GET  /api/shift-swaps
POST /api/shift-swaps/{id}/request
POST /api/shift-swaps/{id}/approve
POST /api/shift-swaps/{id}/reject

GET  /api/time-off
POST /api/time-off
```

---

## Contributing

1. Follow existing Composition API conventions (`<script setup lang="ts">`).
2. Keep business logic out of templates — use `computed` and composables.
3. Run `npm run check` before pushing.
4. Component extraction from `App.vue` should track the API integration milestones.
