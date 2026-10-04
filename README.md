# CarbonWise

**Track smarter. Live greener.**

A motion-aware energy management dashboard for university hostel management.
CarbonWise monitors occupancy per room, flags rooms that are drawing power with
nobody in them, and switches authorised devices off automatically.

---

## Running it

No build step, no dependencies, no network calls (web fonts aside).

```
# simplest: open the file directly
start index.html          # Windows
open index.html           # macOS

# or serve it, which is closer to a real deployment
npx serve .
python -m http.server 8000
```

Everything is plain ES5-compatible JavaScript loaded with classic `<script>`
tags, so it runs straight off `file://` as well as from a server.

### Walking the flow

1. **Get Started** on the landing page.
2. Sign up, or use **Continue with Google** to create a pre-verified demo
   account in one tap.
3. Email verification. No mail server is attached, so the screen offers a
   **Mark as verified** link to continue.
4. Onboarding: building name, room count, devices to monitor.
5. The dashboard, with a live simulation running every 3 seconds.

State lives in `localStorage` under `carbonwise.v1`. **Settings → Data → Reset
everything** clears it and returns you to the landing page.

---

## What is in the box

| Screen | Path | What it does |
|---|---|---|
| Landing | `#/` | Hero, features, how-it-works, live status grid |
| Sign up / Log in | `#/signup`, `#/login` | Validated forms, Google option, password reveal |
| Verification | `#/verify` | Open / resend / change email |
| Onboarding | `#/onboarding` | Four steps, then the building is seeded |
| Dashboard | `#/dashboard` | Overview tiles, energy + carbon charts, room status, device activity, live event feed |
| Rooms | `#/rooms` | Search, status filters, block filter, sort, room cards, detail drawer |
| Energy Usage | `#/energy` | Consumption, carbon, device split, peak-hours heat-map, top consumers |
| Reports | `#/reports` | Four report types, preview, CSV export, print |
| Quick Device Control | `#/control` | Master switches, bulk actions, per-room switchboard |
| Settings | `#/settings` | Building, automation rules, notifications, tariff, theme, data |
| *(every page)* | — | Light / Dark / System switcher — sidebar footer on app pages, header on public pages |
| Profile | `#/profile` | Account, security, impact, action history |
| Manual Override | `#/override` | Hold automation per room, with expiry and history |

---

## How it decides a room is wasting energy

Three states, derived in `js/store.js`:

- **Occupied** — motion seen recently.
- **Alert** — devices are ON, and no motion for longer than the idle threshold
  (default 30 minutes, configurable in Settings).
- **Normal** — everything else.

A room under a **manual override** never raises an alert: its devices are on
deliberately, which is the entire point of the override. Its consumption is also
excluded from the "wasted" figure.

When a room goes into alert, `js/sim.js` switches off whichever devices you have
authorised under Settings → Automation, logs the action, and starts crediting the
energy that device would otherwise have burned to **Carbon Saved**.

---

## Architecture

```
index.html              script tags, in load order
assets/logo.svg         the mark, themed via CSS variables
styles/
  tokens.css            every colour, radius, shadow and type token (+ dark mode)
  base.css              reset, typography, utilities, motion, print
  components.css        buttons, fields, cards, badges, modal, drawer, toasts
  layout.css            app shell, sidebar, grids, auth and onboarding shells
  pages.css             landing, charts, room cards, settings rows
js/
  util.js               DOM helpers, formatters, the icon set, CSV, escaping
  store.js              state, persistence, seeding, derived selectors
  sim.js                the simulation loop + every series the charts read
  charts.js             SVG line / column / sparkline / share-bar / heat-map
  ui.js                 toasts, modal, drawer, theme, shared builders
  views/*.js            one file per screen
  app.js                router, route guards, shell, live refresh
```

### Replacing the simulation with real hardware

`js/sim.js` is the only file that invents data. It does two jobs:

1. `tick()` — stands in for polling sensors and smart plugs.
2. `series()` / `summary()` / `heatmap()` / `topRooms()` — derive everything the
   charts and tiles read.

To go live, swap `tick()` for a fetch against your sensor API that writes into
the same `state.rooms[]` shape, and point `series()` at your historian. No view
file needs to change.

---

## Design notes

### Colour

The palette comes from the CarbonWise mark: the blue of the power ring and the
jade of the leaf, on a warm cream page rather than harsh white. Text is dark
charcoal-navy (`#16233B`), never pure black.

Chart series colours are not hand-picked. They were validated with a
colour-vision and contrast checker against the real surfaces the charts render
on, in both themes:

| Series | Light | Dark |
|---|---|---|
| AC / energy | `#2F6FED` | `#4D8AF4` |
| Fan / carbon | `#10A277` | `#19A87C` |
| Lights | `#EDA100` | `#C98500` |

All pairs clear the colour-blind separation and normal-vision floors in both
modes. A fourth categorical hue failed those floors, so **device series are
capped at three** and any overflow would fold into a neutral "Other" rather than
generating a new hue.

Status colours are a separate, fixed scale (`#0CA30C` good, `#FAB219` warning,
`#D03B3B` critical) and always ship with an icon **and** a text label, so state
is never carried by colour alone.

Dark mode is a selected set of steps validated against the dark surface, not an
inverted copy of the light theme.

### Theme switching

A theme switcher is present on **every** screen, in two shapes:

- **Segmented** (System / Light / Dark) in the sidebar footer on all app pages,
  and again with text labels under Settings → Appearance.
- **Compact** (a single sun/moon button) in the mobile top bar, the landing nav,
  the sign-up / log-in / verification header, and the onboarding header.

Both shapes are the same component. Adding one to a new page is a single marker:

```html
<span data-theme-slot="seg"></span>       <!-- System / Light / Dark -->
<span data-theme-slot="compact"></span>   <!-- one-tap light <-> dark -->
<span data-theme-slot="labels"></span>    <!-- segmented, with text -->
```

`UI.mountThemeSwitchers()` fills every marker after each render, and all of them
route through `UI.setTheme()`, so the choice persists and every switcher on the
page stays in step. **System** follows the device setting and keeps following it
when the OS flips.

### Charts

Hand-rolled SVG, no chart library. The rules held to:

- One y-scale per plot. Energy and carbon are **separate charts**, never a
  dual-axis plot, because the alignment of two scales invents a correlation.
- Comparisons are like-for-like. "Today" is compared against yesterday *cut to
  the same hour*; the weekly and monthly views exclude the in-progress day from
  both sides. Otherwise every dashboard would report a dramatic drop in
  consumption each morning.
- 2px lines, area fills at 10% opacity, 4px rounded tops on stacked columns with
  a 2px surface gap between segments, solid hairline gridlines.
- Axis ticks always land on round numbers.
- A legend whenever there are two or more series; direct labels only at the
  endpoint, never a number on every point.
- Every chart has a **Table** view, and keyboard arrow keys move the crosshair
  and read out the same values as hover, so no value is hover-gated.

### Accessibility

Visible focus rings throughout, a skip link, `aria-current` on the active nav
item, labelled form fields with inline errors, focus trapping and Escape in
modals and the drawer, `prefers-reduced-motion` honoured, and status conveyed by
icon + label rather than colour.

---

## Prototype limitations

Worth being explicit about, since this is a front-end build:

- **There is no backend.** Accounts, buildings and reports live in `localStorage`
  in one browser. Nothing syncs between devices.
- **Passwords are not securely stored.** The prototype hashes the typed password
  with a trivial non-cryptographic function purely to keep plain text out of
  `localStorage`. Any real deployment needs server-side auth.
- **Google sign-in is simulated.** It creates a local demo account; no OAuth
  happens.
- **No email is sent.** Verification and reset flows are UI only.
- **Sensor data is simulated** by `js/sim.js`, as described above.

Browser support: current Chrome, Edge, Firefox and Safari.
