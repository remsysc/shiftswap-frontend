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
│   ├── main.ts        # App entry point
│   ├── App.vue        # Root component (currently a monolithic prototype)
│   └── style.css      # Global styles
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

> **Note:** The current `App.vue` is a high-fidelity UI prototype with static/mock data. API integration with the backend is the next phase of development.

---

## Related Repository

| Repo | Description |
|---|---|
| [`shiftswap-api`](../shiftswap-api) | Laravel 13 REST API backend. Handles auth (Sanctum Bearer tokens), business tenancy, shifts, swap marketplace, time-off, and notifications. |

The frontend communicates with the API over `Authorization: Bearer <token>` headers. See [`shiftswap-api/docs/SPEC.md`](../shiftswap-api/docs/SPEC.md) for the full API contract.

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- npm ≥ 10

### Install & run

```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:5173` by default.

### Build for production

```bash
npm run build
```

Output goes to `dist/`.

### Type checking

```bash
npm run check        # alias for vue-tsc --noEmit
npm run types:check  # same
```

---

## Features (current prototype)

The UI prototype covers the core manager/owner experience:

- **Dashboard** — summary stats (scheduled hours, pending requests), weekly schedule calendar, recent activity feed
- **Week view** — scrollable time grid with colour-coded shift blocks per day
- **List view** — compact shift list (toggle from week view)
- **Create shift modal** — pick date, start/end time, title, and location
- **Notifications panel** — dropdown with unread swap and time-off alerts
- **Sidebar navigation** — Dashboard, Schedule, Shift swaps (3), Time off (2), Team, Locations, Settings
- **Mobile-responsive** — collapsible sidebar with overlay for narrow screens

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
