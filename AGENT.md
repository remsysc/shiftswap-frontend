# Agent Guidance

## Project overview

ShiftSwap Frontend is a Vue 3 single-page application for shift scheduling and shift-swap management. This repository contains the frontend only; the Laravel API is maintained in the sibling `shiftswap-api` repository.

The current application is a high-fidelity UI prototype. Most state and mock data live in `src/App.vue`; API integration, routing, authentication, and broader component extraction are future work.

## Technology and conventions

- Vue 3 with the Composition API and `<script setup lang="ts">`.
- TypeScript in strict mode.
- Vite for development and production builds.
- Tailwind CSS 4 for styling.
- Use the existing npm dependencies and patterns before introducing new packages.
- Prefer descriptive names, focused functions, computed values, and composables over business logic embedded in templates.
- Preserve the existing four-space TypeScript/Vue indentation style.

## Repository structure

- `src/main.ts` — application entry point.
- `src/App.vue` — current root UI and prototype state.
- `src/style.css` — global styles and Tailwind setup.
- `vite.config.ts` — Vite, Vue, Tailwind, host, and port configuration.
- `dist/` — generated production output; do not edit by hand.

When extracting components from `App.vue`, keep presentation separate from scheduling, filtering, and API/domain logic. Prefer incremental extraction that preserves existing behavior rather than rewriting the prototype wholesale.

## Development commands

Run these from the repository root:

```bash
npm install
npm run dev
npm run check       # vue-tsc --noEmit
npm run build       # vite build
```

Run `npm run check` and `npm run build` after meaningful code changes. There is currently no dedicated test script, so manually verify affected interactions in the development server when UI behavior changes.

## API integration

The backend API is the sibling repository `../shiftswap-api`. Consult its `docs/SPEC.md` before implementing API calls, request/response types, authentication, or role-based behavior.

Use `VITE_API_BASE_URL` for the API base URL; do not hardcode environment-specific URLs. API requests must use the documented `Authorization: Bearer <token>` convention once authentication is implemented. Never commit tokens, credentials, or other secrets.

Respect the backend roles:

- `owner` — full business administration.
- `manager` — shifts, swaps, and time-off approvals.
- `staff` — own schedule, swaps, and time-off requests.

Validate external API data at the boundary and present useful loading, empty, and error states. Keep API concerns out of reusable presentational components where practical.

## UI and product behavior

- Preserve responsive behavior, including the mobile sidebar and overlay.
- Keep schedule views consistent with the existing week/list model and filtering controls.
- Use stable IDs and typed domain objects for shifts, users, swaps, and time-off records.
- Do not replace mock data with guessed API behavior; implement against the backend contract.
- Maintain accessible labels, keyboard interaction, visible focus states, and semantic controls when modifying the UI.

## Change and validation policy

- Read the relevant source and documentation before editing.
- Make the smallest focused change needed for the task.
- Do not modify generated `dist/` output or unrelated files.
- Avoid adding dependencies unless the existing stack cannot support the requirement.
- Update or add tests when a test setup is introduced or when behavior can be covered by existing tooling.
- Before finishing, run the narrowest relevant checks, then `npm run check` and `npm run build` when feasible.
- Report any validation command that could not be run and why.
