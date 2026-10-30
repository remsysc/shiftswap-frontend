# ShiftSwap — Design System & UI/UX Architecture (`DESIGN.md`)

> **Status:** Canonical Design Baseline | **Version:** 3.0 (Kanagawa Shift Atelier) | **Date:** October 30, 2026
> **Stitch Baseline:** Project `projects/16183390087044765770` · Design System `assets/b6e4fc865d414065a4245999ed44c5d0` (*Kanagawa Shift Atelier*) · Screen `5f56aa5749c1434f8dd1ce44970a557e` (*ShiftSwap — Modern Kanagawa Command Dashboard (Fixed)*)
> **Aligned Contract:** [`shiftswap-api/docs/SPEC.md`](../shiftswap-api/docs/SPEC.md) (v1.7) & [`shiftswap-api/docs/ShiftSwap-PRD.md`](../shiftswap-api/docs/ShiftSwap-PRD.md) (v1.5)
> **Primary Audience:** SME Business Owners first (cafes, clinics, retail stores, salons; 5–30 staff, 1–3 locations), followed by Store Operations Managers and Hourly/Shift Staff.

---

## 1. Brand Manifesto: **"Kanagawa Shift Atelier"**

### 1.1 Aesthetic Philosophy

**Kanagawa Shift Atelier** translates the timeless balance, deliberate craft, and organic composure of Japanese *ukiyo-e* woodblock prints into a high-utility, modern operational workspace for SME shift scheduling and shift swaps. The interface evokes the calm structure of an architectural atelier: **tactile like fibrous washi paper, structured like wooden joinery, and paced with unhurried clarity**.

To an SME owner opening ShiftSwap at 7:00 AM, the emotional response is centered on **quiet relief, composure under pressure, and tactile certainty**—standing completely apart from the cold, sterile corporate blue/indigo bloat of Deputy, Homebase, When I Work, and 7shifts.

| Dimension | Generic Competitors (Deputy / Homebase / SaaS Boilerplate) | ShiftSwap (**Kanagawa Shift Atelier**) |
| :--- | :--- | :--- |
| **Canvas & Atmosphere** | Cold sterile grey (`#F7F8FC`) & clinical glare | **Lotus Parchment (`#F2EFE9`)** with subtle topographic dot grid & ukiyo-e dashed wave contour art |
| **Structural Control Rail** | Washed-out slate navbars | **Dragon Sumi Ink (`#16181D`)** collapsible sidebar (`260px` ↔ `72px`) with layered indigo/aqua wave SVG |
| **Primary Action Accent** | Boilerplate Indigo (`#4F46E5`) or Corporate Blue (`#0052CC`) | **Wave Indigo (`#2D4F67`)** paired with **Carp Gold (`#C0A36E`)** & **Spring Moss (`#76946A`)** |
| **Time, IDs & Metrics** | Proportional sans-serif that jitters in columns | **`Space Mono` (`tabular-nums`)** for every ticket ID (`#SW-8841`), shift window (`07:00 – 15:30`), and hour tally |
| **Swap Representation** | Generic table rows with cryptic status text | **Perforated Two-Stub "Swap Boarding Pass" Tickets** with `#F2EFE9` edge notches & Conflict Verification |
| **Owner First Impression** | Disconnected stat boxes & 14-item menus | **Compact Counter Brief (`93% Covered`) + Balanced 2-Column Live Schedule Tape & Boarding Pass Queue** |

---

## 2. Core UX Laws (SME Owner First)

1. **The 3-Second Morning Counter Brief (Owner First):**
   At the top of the workspace, the **Counter Brief** answers the SME owner's three morning questions in a single glance:
   - **Coverage Ratio Pill:** `✓ 93% Covered` in Spring Moss (`#76946A` on `#EAF0E8`).
   - **3 Connected KPI Tiles:** `14 Shifts` (`112.0h scheduled` · `+4h`), `2 Swaps` (`Awaiting Sign-Off` · pulsing Carp Gold indicator), and `1 Review` (`Time-Off conflict`).
2. **The Business Owns the Official Schedule:**
   Staff may offer or claim shifts, but an assignment changes **only after Owner/Manager sign-off**. In the **Live Schedule Tape**, a shift with a pending swap (`#SW-8842`) displays `Camille R. ➔ Mark B. · Pending Sign-Off` with a prominent `[Review Pass ↗]` CTA, keeping the official schedule transparent until approved.
3. **Conflict-Audited Before Sign-Off:**
   Every Swap Boarding Pass displays its verification pill (`Verified · 0 overlap`) and post-swap weekly hour tally (`Post: 38.0h/wk · Under 40h cap`) directly inside the right stub so the owner never approves a double-booking (`FR-21`, `FR-28`).
4. **Collapsible High-Density Ergonomics (`Ctrl/⌘ + B`):**
   The Dragon Sumi sidebar smoothly collapses between **Expanded (`260px`)** and **Icon Rail (`72px`)**, persisting the owner's preference in `localStorage` (`shiftswap_sidebar_collapsed`).
5. **Status is Always Text + Icon + Pigment + Border Geometry:**
   Never rely on color alone. Every shift card and swap pass combines a **6px (`w-1.5`) left pigment ribbon**, a **Material Symbol icon**, and a **monospace status capsule** (`On Floor`, `Swap In Progress`, `Upcoming`, `Verified`).

---

## 3. Foundations & Design Tokens (Kanagawa Palette)

### 3.1 Color Tokens

All tokens below are extracted directly from the **Kanagawa Shift Atelier** Stitch baseline (`5f56aa5749c1434f8dd1ce44970a557e`):

#### Surface & Structural Hierarchy

| Role | Token Name | Hex | Usage |
| :--- | :--- | :--- | :--- |
| **Bedrock Canvas (Level 0)** | `canvas` | `#F2EFE9` | Lotus Parchment main page background; also used for ticket perforation notches |
| **Recessed Well (Level 0 Inset)**| `surface-well` | `#FAF8F5` | Inner KPI tiles, ticket headers/footers, segmented filter tracks, modal wells |
| **Sunken Washi** | `surface-sunken` | `#E8E5DD` | Inactive tracks, table headers, disabled controls |
| **Card Surface (Level 1)** | `surface-card` | `#FFFFFF` | Primary cards, shift blocks, swap boarding passes, modals |
| **Dragon Sumi Sidebar** | `dragon-sumi` | `#16181D` | Left executive navigation rail & dark toast banners |
| **Dragon Sumi Elevated** | `dragon-elevated`| `#1E2127` | Active workspace card & hover state inside the Dragon Sumi sidebar (`border-[#2B2F38]`) |
| **Rice Paper Border** | `border-rice` | `#DCD7CE` | Primary 1px structural border on cards, inputs, headers, and perforated dividers |
| **Subtle Rice Border** | `border-rice-subtle` | `#E7E3DC` | Hairline internal card dividers |

#### Traditional Pigment Accents & Semantic States

| Pigment Role | Token Name | Primary Hex | Wash / Tint Fill | Border Token | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Wave Indigo (Primary)** | `primary` | `#2D4F67` (Hover `#1F384C`) | `#E6ECF0` (`wave-wash`) | `#C5D4DF` / `#BACEDD` | Primary buttons (`+ Shift`, `✓ Approve`, `Review Pass`), active sidebar tab, active filter pills, ticket codes |
| **Wave Slate (Exchange)** | `wave-slate` | `#4E6E82` | `#E6ECF0` | `#CBD5DC` | Left 6px accent bar on shifts with an active swap in progress |
| **Spring Moss (Confirmed)** | `moss` | `#76946A` | `#EAF0E8` (`moss-wash`) | `#C9DBC2` (`moss-border`) | `On Floor` / `Active` shift rail, `93% Covered` badge, `Verified` conflict shield, online workspace pulse |
| **Carp Gold (Provisional)** | `carp-gold` | `#C0A36E` (Bright `#DCA561`) | `#FAF3E8` (`carp-gold-wash`) | `#ECDDBF` (`carp-gold-border`)| `Pending Sign-Off` indicators, unread notification dot, sidebar pending swap counter badge (`2`) |
| **Maple Coral (Conflict)** | `maple-coral` | `#C34043` | `#FCECEC` (`maple-wash`) | `#F3C5C6` | Time-off overlap alerts, urgent filter dot, decline hover state, destructive actions |

#### Ink & Typography Tokens

| Role | Token Name | Hex | Contrast on `#FFFFFF` | Contrast on `#F2EFE9` | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Sumi Ink (Text Primary)** | `sumi-ink` | `#1F1F28` | `16.4:1` (AAA) | `14.2:1` (AAA) | Primary headings, staff names, shift hours, metric numerals |
| **River Pebble (Secondary)** | `pebble` | `#5A5D64` | `6.6:1` (AA) | `5.7:1` (AA) | Supporting metadata, branch labels, inactive filter buttons, helper copy |
| **Pebble Light (Muted)** | `pebble-light` | `#8A8D93` | — | — | Decorative separators (`·`), sidebar muted captions (`#C8C6C1` for nav links on `#16181D`) |

---

### 3.2 Typography & Iconography

Loaded via Google Fonts:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
    href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap"
    rel="stylesheet"
/>
<link
    href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
    rel="stylesheet"
/>
```

1. **Headlines, Human Labels, Badges & UI Body — `Plus Jakarta Sans` (`--font-headline`, `--font-body`):**
   - Geometric clarity and humanist warmth with `font-variant-numeric: tabular-nums` enabled globally on `body`.
   - Used for all human words: staff names, station roles (`Barista Lead`), branch names (`Makati`), status pills (`On Floor`, `Swap In Progress`, `Verified`), subtitles (`Awaiting Sign-Off`), and CTAs.
   - Weights: `400` (body), `500` (nav links), `600` (sub-headers/buttons), `700` (card titles, badges & names), `800` (KPI metrics `14 Shifts`, `2 Swaps`).
2. **Ticket Codes, 24h Timestamps & Numeric Durations Only — `IBM Plex Mono` (`--font-mono`, `.font-mono-num`):**
   - Applied with `font-variant-numeric: tabular-nums` and `font-feature-settings: 'tnum' on, 'zero' on`.
   - Reserved **strictly** for ticket IDs (`#SW-8841`), 24h shift windows (`07:00 – 15:30`), numeric durations (`8.0h`, `112.0h`), weekly hour caps (`38.0h/wk`, `40.0h`), percentages (`93%`), and live clock numerals (`10:42 AM PHT`). Never apply `.font-mono-num` to prose, subtitles, or word labels.
3. **Icons — `Material Symbols Outlined`:**
   - Used consistently across navigation (`dashboard`, `calendar_view_week`, `swap_horizontal_circle`, `group`, `event_busy`, `tune`), boarding passes (`flight_takeoff`, `flight_land`, `verified_user`, `lock`), and shift cards (`storefront`, `schedule`, `sync`, `visibility`).

---

### 3.3 Ready-to-Use Tailwind CSS v4 `@theme` Configuration (`src/style.css`)

```css
@import 'tailwindcss';

@theme inline {
    --font-sans: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
    --font-headline: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
    --font-body: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
    --font-mono: 'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace;

    --color-primary: #2d4f67;
    --color-primary-hover: #1f384c;
    --color-primary-container: #2d4f67;
    --color-on-primary: #ffffff;
    --color-primary-light: #e3e8ec;

    --color-sumi-ink: #1f1f28;
    --color-pebble: #5a5d64;
    --color-pebble-light: #8a8d93;

    --color-canvas: #f2efe9;
    --color-surface-well: #faf8f5;
    --color-surface-sunken: #e8e5dd;
    --color-surface-card: #ffffff;
    --color-dragon-sumi: #16181d;
    --color-dragon-elevated: #1e2127;

    --color-border-rice: #dcd7ce;
    --color-border-rice-subtle: #e7e3dc;

    --color-moss: #76946a;
    --color-moss-wash: #eaf0e8;
    --color-moss-border: #c9dbc2;

    --color-carp-gold: #c0a36e;
    --color-carp-gold-bright: #dca561;
    --color-carp-gold-wash: #faf3e8;
    --color-carp-gold-border: #ecddbf;

    --color-maple-coral: #c34043;
    --color-maple-wash: #fcecec;

    --color-wave-slate: #4e6e82;
    --color-wave-wash: #e6ecf0;
}

html {
    background-color: #f2efe9;
    color: #1f1f28;
    font-family: var(--font-body);
    -webkit-font-smoothing: antialiased;
}

.font-mono-num {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-feature-settings: 'tnum' on, 'zero' on;
    letter-spacing: -0.01em;
}

.perforated-border {
    background-image: repeating-linear-gradient(
        to bottom,
        #dcd7ce 0,
        #dcd7ce 6px,
        transparent 6px,
        transparent 12px
    );
}

.ticket-notch-top {
    position: absolute;
    top: -9px;
    left: 50%;
    transform: translateX(-50%);
    width: 18px;
    height: 18px;
    border-radius: 9999px;
    background-color: #f2efe9;
    box-shadow: inset 0 -1px 2px rgba(0, 0, 0, 0.06);
}

.ticket-notch-bottom {
    position: absolute;
    bottom: -9px;
    left: 50%;
    transform: translateX(-50%);
    width: 18px;
    height: 18px;
    border-radius: 9999px;
    background-color: #f2efe9;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.06);
}
```

---

## 4. Signature Architectural Components (Kanagawa Baseline)

### 4.1 Collapsible Dragon Sumi Executive Sidebar (`#app-sidebar`)

- **Dimensions & State:** Fixed left rail, `w-[260px]` when expanded, `w-[72px]` when `body.sidebar-collapsed` is active. Toggled via the top-right `first_page` button or keyboard shortcut `Ctrl/⌘ + B` (stored in `localStorage.getItem('shiftswap_sidebar_collapsed')`).
- **Surface & Decorative Ukiyo-e Wave:** Background `#16181D` with `#24272E` border and a non-interactive bottom SVG wave (`260×220` viewBox) layering `#132838` → `#2D4F67` and `#3C5A58` → `#5A7E7D` gradients with `#BACEDD` dashed crest strokes.
- **Header Block:**
  - `SS` monogram badge (`w-10 h-10 rounded-lg bg-[#2D4F67] border border-[#3E6583] text-white font-extrabold`).
  - Title `ShiftSwap` + role chip (`OWNER` / `MANAGER` / `STAFF` in `bg-[#2D4F67]/60 text-[#BACEDD] font-mono-num text-[10px]`) + subtitle `Shopfloor Atelier`.
- **Tenant Workspace Box (`bg-[#1E2127] border border-[#2B2F38] rounded-lg p-2.5`):**
  - Eyebrow `TENANT WORKSPACE` with pulsing Spring Moss dot (`#76946A`).
  - Business Name (`Harbor Artisanal Coffee`) and branch/timezone meta (`storefront` `2 Branches · Asia/Manila (PHT)`).
- **Navigation Items:**
  1. `Command Brief` (`/dashboard` — icon `dashboard`)
  2. `Roster & Time-Tape` (`/schedule` — icon `calendar_view_week`)
  3. `Swap Boarding Passes` (`/swaps` — icon `swap_horizontal_circle` + Carp Gold `#C0A36E` pill badge for pending count)
  4. `Staff Roster` (`/team` — icon `group` + monospace member count)
  5. `Time-Off Requests` (`/time-off` — icon `event_busy` + Carp Gold alert dot when pending)
  6. `Shopfloor Settings` (`/settings` — icon `tune`)
- **Bottom Utility Dock:**
  - `[⚡ Quick Post Shift]` button (`bg-[#1E2127] hover:bg-[#252932] border border-[#2F343E]`)
  - `Location Branch` (`/locations` — icon `storefront`) & Sign Out / Account actions.

---

### 4.2 Top Context Header (`#app-header`) & Background Wave Canvas (`#app-bg-wave`)

- **Sticky Header (`h-16 bg-[#F2EFE9]/95 backdrop-blur-md border-b border-[#DCD7CE]`):**
  - **Left:** Branch Location `<select>` pill (`location_on` icon in `#2D4F67`, white surface, `#DCD7CE` border) + vertical divider + live `Asia/Manila` date/time display (`● Saturday, Jun 14 · 10:42 AM PHT`).
  - **Right:** Broadcast icon button (`sensors`), primary **`[+ Shift]`** button (`bg-[#2D4F67] hover:bg-[#1F384C] text-white`), Notification bell (`notifications` with `#C0A36E` unread pip), Audit history icon, and User Avatar + Name (`Rem A.`).
- **Kanagawa Background Wave Art (`#app-bg-wave`):**
  - Fixed behind `<main>` (`-z-10 pointer-events-none`), rendering a subtle `28×28px` dot grid (`#2D4F67` at `7%` opacity) and flowing dashed ukiyo-e contour curves in Wave Indigo, Spring Moss, and Carp Gold gradients.

---

### 4.3 Section A: Compact "Counter Brief" (`#morning-brief-section`)

A single crisp white container (`bg-white border border-[#DCD7CE] rounded-xl p-4 shadow-sm`) divided into:

1. **Top Bar:**
   - Left: `wb_sunny` icon badge (`bg-[#E6ECF0] border-[#C5D4DF] text-[#2D4F67]`) + **`Counter Brief`** title + Spring Moss pill **`✓ 93% Covered`** (`bg-[#EAF0E8] text-[#76946A] border-[#C9DBC2]`).
   - Right: `[↓ Export]` and `[🖨️ Print View]` utility buttons.
2. **3-Column KPI Strip (`grid-cols-1 md:grid-cols-3 gap-3 pt-3`):**
   - **Tile 1 (Scheduled Shifts):** `bg-[#FAF8F5] border-[#DCD7CE]` · Icon `calendar_today` · **`14 Shifts`** (`112.0h scheduled`) · right badge `+4h` (`bg-[#E6ECF0] text-[#2D4F67]`).
   - **Tile 2 (Pending Swaps):** `bg-[#FAF8F5] border-[#2D4F67]/40` · Icon `swap_horiz` (`bg-[#E6ECF0] text-[#2D4F67]`) · **`2 Swaps`** in `#2D4F67` (`Awaiting Sign-Off`) · pulsing Carp Gold dot (`#C0A36E`).
   - **Tile 3 (Pending Time-Off Reviews):** `bg-[#FAF8F5] border-[#DCD7CE]` · Icon `person_off` · **`1 Review`** (`Mateo Cruz conflict`) · Carp Gold dot (`#C0A36E`).

---

### 4.4 Section B (Left Column): Live Schedule Tape Cards

Located in the left half of the balanced 2-column grid (`grid-cols-1 lg:grid-cols-2 gap-6`):

- **Section Header Card:**
  - Icon `calendar_today` + Title **`Live Schedule Tape`** + pill `Today · Jun 14` (`bg-[#EAF0E8] text-[#76946A]`) + subtitle `Harbor Artisanal Coffee · 4 Active Stations`.
  - Right segmented branch filter (`bg-[#FAF8F5] border-[#DCD7CE] p-1 rounded-lg`): Active button in `bg-[#2D4F67] text-white` (`All (4)` | `Makati (2)` | `BGC (2)`).
- **Three Card State Variants:**
  1. **Active / On-Floor Shift Card (Spring Moss `#76946A` `w-1.5` left rail):**
     - Avatar with bottom-right pulsing green online pip, staff name (`Maria Santos`), role pill (`Barista Lead` in `bg-[#FAF8F5] border-[#DCD7CE] font-mono-num text-[10px]`), branch (`storefront Makati`), and time (`07:00 – 15:30 (In Progress)`).
     - Right status badge: `● On Floor` (`bg-[#EAF0E8] text-[#76946A] border-[#C9DBC2]`) + `more_vert` options trigger.
  2. **Swap-In-Progress Shift Card (Wave Slate `#4E6E82` `w-1.5` left rail):**
     - Top meta row: Ticket chip (`sync #SW-8842` in `bg-[#E6ECF0] text-[#2D4F67]`) + `● Swap In Progress` pill + branch `BGC Roastery` + `0h Overlap` badge (`bg-[#EAF0E8] text-[#76946A]`).
     - Bottom participant row: Dual avatars (`[1] ➔ [2]`), `Camille R. ➔ Mark B.`, shift window `14:00 – 22:00 · Pending Sign-Off` (in `#C0A36E`), and primary Wave Indigo CTA **`[👁️ Review Pass ↗]`**.
  3. **Upcoming / Overnight Shift Card (Pebble `#8A8D93` `w-1.5` left rail):**
     - Avatar, staff name (`Leo David`), role pill (`Closing Specialist`), branch + overnight window (`22:00 – 06:00 · 8.0h`), and right status pill `🕒 Upcoming`.

---

### 4.5 Section B (Right Column): Perforated Swap Boarding Passes & Time-Off Alert

- **Section Header Card:**
  - Icon `confirmation_number` + Title **`Swap Boarding Passes`** + pill `● 2 Pending` (`text-[#C0A36E]`) + subtitle `🛡️ Audited Exchange Queue · Sign-Offs`.
  - Right segmented filter: `All (2)` | `Urgent ● (1)` | `Verified`.
- **Perforated Swap Boarding Pass Card (`bg-white border border-[#DCD7CE] rounded-xl shadow-sm`):**
  - **Ticket Top Bar (`bg-[#FAF8F5] px-3.5 py-2 border-b border-[#DCD7CE]`):**
    - Left: Ticket ID `#SW-8841` (`font-mono-num text-xs font-extrabold text-[#2D4F67]`) + `lock` icon (`text-[#76946A]`).
    - Right: `location_on` `Makati`.
  - **Two-Stub Perforated Body (`grid-cols-2 p-3 gap-3 relative`):**
    - Top and bottom semicircular paper notches (`.ticket-notch-top`, `.ticket-notch-bottom` matching `#F2EFE9` canvas) and center vertical `.perforated-border`.
    - **Left Stub (Offering Staff):** `flight_takeoff` icon + reason category icon, avatar + name (`Maria S.`), and recessed time box (`bg-[#FAF8F5] border-[#DCD7CE]` showing `Fri · 14:30–22:30` / `8.0h`).
    - **Right Stub (Claiming Staff):** `flight_land` icon + note/certification icon, avatar + name (`Juan D.`), and Wave Indigo tint box (`bg-[#E6ECF0] border-[#BACEDD]/60` showing `Post: 38.0h/wk` / `Under 40h cap`).
  - **Verification Strip (`mx-3 mb-2`):**
    - Left: `🛡️ Verified` pill (`bg-[#EAF0E8] border-[#C9DBC2] text-[#76946A]`).
    - Right: `0 overlap` (`Space Mono`).
  - **Ticket Footer Action Bar (`bg-[#FAF8F5] px-3 py-2 border-t border-[#DCD7CE]`):**
    - Decline button (`close` icon, hover `text-[#C34043] bg-[#FCECEC]`) + Wave Indigo **`[✓ Approve]`** button (`bg-[#2D4F67] hover:bg-[#1F384C] text-white`).
- **Bottom Compact Time-Off Conflict Card (`#timeoff-conflict-card`):**
  - Maple Coral icon badge (`event_busy` on `bg-[#FCECEC] text-[#C34043] border-[#F3C5C6]`), title **`Time-Off Conflict`**, subtitle `Mateo Cruz · Sat Jun 14`, and pill button **`[🔍 Inspect Request]`** (`bg-[#E6ECF0] text-[#2D4F67] rounded-full`).

---

## 5. Role-Specific Workspace Variations (Owner, Manager, Staff)

All three roles share the **Kanagawa Shift Atelier** shell, tokens, and typography (`Plus Jakarta Sans` + `Space Mono`), adapting the main canvas to each role's permissions in [`SPEC.md`](../shiftswap-api/docs/SPEC.md):

1. **Owner Command Dashboard (`role === 'owner'`, Screen `5f56aa5749c1434f8dd1ce44970a557e`):**
   - Multi-branch selector (`All Locations`), Counter Brief with 3 KPI tiles, Live Schedule Tape, Swap Boarding Passes queue with 1-tap `Approve` / `Decline`, Time-Off Conflict alert bar, and full Team/Role/Ownership Transfer governance.
2. **Store Operations Manager Console (`role === 'manager'`, Screen `743bd3b7228e48e1af9028766a020caf`):**
   - Focused on rapid shift creation (`+ Shift`), overlap-guarded staff assignment (`FR-19`–`FR-21`), Swap Boarding Pass adjudication (`FR-30`, `FR-31`), and Time-Off conflict inspection (`FR-36`–`FR-38`).
3. **Staff Portal & Personal Shift Board (`role === 'staff'`, Screen `813c4ec5a45148c9a9c1bb951764115f`):**
   - Displays the staff member's personal upcoming shifts on the left with a 1-tap `[⇄ Offer Shift for Swap]` action (`FR-24`), and open marketplace Swap Boarding Passes from teammates on the right with a Carp Gold / Wave Indigo `[Claim Shift]` button (`FR-27`).

---

## 6. Page-by-Page Alignment Across All Vue Routes

| Vue Route / View | Kanagawa Shift Atelier Implementation Pattern |
| :--- | :--- |
| **`AppLayout.vue`** | Dragon Sumi (`#16181D`) collapsible sidebar (`260px` / `72px`) with bottom SVG wave art, `Ctrl/⌘ + B` toggle, Lotus Parchment (`#F2EFE9`) sticky header (`h-16`), and background topographic wave SVG (`#app-bg-wave`). |
| **`DashboardView.vue`** | Counter Brief section + 3 KPI tiles (`Scheduled Shifts`, `Swaps Awaiting Sign-Off`, `Time-Off Reviews`) + Balanced 2-Column Grid (**Live Schedule Tape** on left, **Swap Boarding Passes** + **Time-Off Conflict Card** on right). |
| **`ScheduleView.vue`** | Week Time-Grid & Agenda List toggle on `#FFFFFF` cards with `#DCD7CE` borders, branch/staff filters in `#FAF8F5` wells, 6px left pigment rails (`#76946A` assigned, `#C0A36E` open, `#4E6E82` swap pending), and Overlap-Guarded Staff Assignment modal. |
| **`SwapsView.vue`** | Segmented status filter bar (`All`, `Offered`, `Pending Approval`, `Approved`, `Cancelled`) + grid of Perforated **Swap Boarding Pass** cards with `.ticket-notch-top` / `.ticket-notch-bottom` and Swap Approval Confirmation modal. |
| **`TimeOffView.vue`** | Time-Off Request ledger cards + **Time-Off Conflict Inspector Modal** showing overlapping assigned shifts in Maple Coral (`#FCECEC` / `#C34043`) vs. clear dates in Spring Moss (`#EAF0E8` / `#76946A`). |
| **`TeamView.vue`** | Staff Roster directory with `Space Mono` role badges (`OWNER`, `MANAGER`, `STAFF`), Copyable Invitation Token Ticket (`FR-3`), and Ownership Transfer safeguard modal (`SPEC 5.2`). |
| **`LocationsView.vue`** | Multi-branch studio cards (`storefront` icon, branch name, address, shift count) with manager/owner create/edit/delete controls (`FR-16A`). |
| **`SettingsView.vue`** | Workspace Tenant Ledger displaying Business Name, `Asia/Manila (PHT)` timezone boundary rules, Tenant ID in `Space Mono`, and User Account card. |
| **`LoginView` / `RegisterView` / `AcceptInvitationView`** | Two-pane layout: left Dragon Sumi (`#16181D`) showcase panel with layered Kanagawa SVG waves and a live Swap Boarding Pass preview; right Lotus Parchment (`#F2EFE9`) form canvas with `#FFFFFF` card and Wave Indigo (`#2D4F67`) primary CTA. |

---

## 7. Accessibility & Quality Checklist (WCAG 2.2 AA)

- [ ] **Contrast Compliance:** Sumi Ink (`#1F1F28`) on Lotus Parchment (`#F2EFE9`) is `14.2:1`; Wave Indigo (`#2D4F67`) with `#FFFFFF` text is `8.5:1` (AAA).
- [ ] **Tabular Monospace Numerals:** All timestamps, ticket IDs (`#SW-8841`), hours (`112.0h`), and counters use `.font-mono-num` (`Space Mono`, `tnum`).
- [ ] **Keyboard & Collapsible Rail:** Sidebar toggle supports `Ctrl/⌘ + B` and `aria-label`; all modals close on `Escape` and backdrop click.
- [ ] **Non-Color Status Redundancy:** Every status uses a 6px left pigment bar + Material Symbol icon + descriptive monospace pill label.
