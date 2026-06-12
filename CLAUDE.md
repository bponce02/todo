# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A personal task/list management backend, exposed as a **JSON API only**. There are intentionally no Django views, templates, or forms — anything UI-shaped goes in a separate React client that talks to this API. If you find yourself reaching for `render()`, `TemplateView`, `ModelForm`, or `django-htmx`, you're on the wrong track.

## Stack

- Django 6 with `django-ninja` for the HTTP layer
- `django-ninja-jwt` (built on `ninja-extra`) for JWT auth
- `pytest` + `pytest-django` for tests
- SQLite (default `db.sqlite3` in `src/`)
- Python 3.14, `uv` for dependency + env management, `just` for command shortcuts

## First-time setup

From a fresh clone:

```sh
uv sync                         # install Python deps
just npm-install                # install frontend deps (one-time)
just migrate                    # apply Django migrations
just createsuperuser            # JWT user (for /api/token/pair)
just radicale-adduser           # Radicale user (entry in radicale.htpasswd) — separate auth DB
export RADICALE_USERNAME=<u>    # must match what radicale-adduser created
export RADICALE_PASSWORD=<p>
just dev                        # Django + Radicale + Vite together; visit http://localhost:8000
```

Without the `RADICALE_*` env vars, Django runs fine but the CalDAV bridge is dormant. That's by design — it's also why CI/tests can run without Radicale present.

For a production-style run: `just build` (builds the frontend + collectstatic), then run Django with `DEBUG=False`. No Vite process is needed; django-vite reads `frontend/dist/.vite/manifest.json`.

## Common commands

All commands go through `just` (see `justfile`):

- `just` — list available recipes
- `just runserver` — start Django dev server
- `just test` — run the full pytest suite
- `just test -k auth` — pass args through to pytest (filter by keyword, single test, etc.)
- `just migrate` / `just makemigrations`
- `just createsuperuser` — used to make real users; there's no register endpoint yet

Project layout uses a `src/` directory, so `manage.py` lives at `src/manage.py`. `pytest` is configured (in `pyproject.toml`) with `pythonpath = ["src"]` so imports like `from core.models import Task` work from anywhere.

## API surface

Everything is mounted at `/api/`:

- **Auth** (from `NinjaJWTDefaultController`): `POST /api/token/pair`, `POST /api/token/refresh`, `POST /api/token/verify`
- **Lists**: `GET/POST /api/lists`, `GET/PATCH/DELETE /api/lists/{id}`
- **Tasks**: `GET/POST /api/tasks`, `GET/PATCH/DELETE /api/tasks/{id}`. `GET /api/tasks` accepts `?list_id=` and `?completed=` query filters.
- **Events**: `GET/POST /api/events`, `GET/PATCH/DELETE /api/events/{id}`. `GET /api/events` accepts `?list_id=` plus `?start=&end=` datetime filters with **overlap semantics** (`event.end >= start AND event.start <= end`) so week/month views catch events spanning the window edge; results are ordered by `start`. Create/patch reject `end < start` with a 422 (`_check_event_times`).
- Interactive docs at `/api/docs`, OpenAPI JSON at `/api/openapi.json`

Every business route requires `Authorization: Bearer <access_token>`. The single shared `auth = JWTAuth()` instance in `core/api.py` is passed as `auth=auth` to each route — keep that pattern when adding new endpoints, don't accidentally leave a route public.

## Code architecture

There's one Django app (`core`) and the project package (`personal_management`). The whole API lives in **`src/core/api.py`** as a flat module of function-based Ninja routes — schemas (`*In` / `*Patch` / `*Out`) sit alongside the routes that use them. The API instance is a `NinjaExtraAPI` (not plain `NinjaAPI`) because JWT registration needs `ninja-extra`'s controller mechanism:

```python
api = NinjaExtraAPI()
api.register_controllers(NinjaJWTDefaultController)
```

`personal_management/urls.py` just mounts `api.urls` under `/api/` and exposes Django admin. There is no `core/urls.py` and there should not be one.

Models (`core/models.py`):
- `List` has `title` and `view` (a `TextChoices`: `LIST` or `CALENDAR`). The API doesn't switch behavior on `view`, but the sync layer does: calendar-view lists get a VEVENT collection eagerly on creation.
- `Task` has a `ForeignKey` to `List` with `related_name="tasks"` and `on_delete=CASCADE`. Deleting a list deletes its tasks.
- `Event` has `title`, `description`, `start`/`end` (DateTimeFields, stored UTC), `all_day`, and a `ForeignKey` to `List` with `related_name="events"` and `on_delete=CASCADE`. `end` is **required** and, for all-day events, **inclusive** (a single-day all-day event has `start.date() == end.date()`); the CalDAV layer converts to/from RFC 5545's exclusive DTEND.

## Testing conventions

Tests live in `src/core/tests/` as a package. `conftest.py` provides the fixtures you almost always want:

- `user` — a created Django user (`alice` / `pw-12345`)
- `access_token` — fresh JWT for that user, obtained by actually hitting `/api/token/pair` (not by minting a token directly — this is intentional, so the auth flow is exercised in every test)
- `auth_client` — a `django.test.Client` with `HTTP_AUTHORIZATION="Bearer …"` already set; use this for any test that needs to hit a protected route
- `some_list` — a pre-created `List` for relationship tests

Use `auth_client` for protected routes, the bare `client` fixture only when you specifically want to test the unauthenticated case. Tests are marked `pytestmark = pytest.mark.django_db` at the module level.

## CalDAV / Radicale (phone sync)

A separate **Radicale** CalDAV server runs alongside Django and the phone talks to it. Django bridges its `Task` / `List` data into Radicale over HTTP using the `caldav` client library — the two processes share nothing else.

### Running it

- **Config**: `radicale.conf` at repo root. Listens on `0.0.0.0:5232`, htpasswd auth, filesystem storage.
- **Credentials**: `radicale.htpasswd` (bcrypt hashes). **Gitignored.** Create users with `just radicale-adduser` (prompts, or honors `RADICALE_USER` / `RADICALE_PASSWORD` env vars for scripting).
- **Storage**: `radicale_data/` (gitignored). Each Radicale user gets `collection-root/<user>/`; each calendar is a subdirectory of `.ics` files.
- **Run it**: `just radicale` (alone) or `just dev` (Django + Radicale in parallel).

iOS setup: Settings → Calendar → Accounts → Add Account → Other → Add CalDAV Account. Use `<lan-ip>:5232` (host's LAN IP) with the radicale username/password. iOS warns about no HTTPS; accept for LAN dev. Reminders picks up VTODO calendars automatically.

### How the Django ↔ Radicale bridge works

Configured via env vars read in `settings.py`:
- `RADICALE_URL` (default `http://localhost:5232`)
- `RADICALE_USERNAME` / `RADICALE_PASSWORD` — **must match an entry in `radicale.htpasswd`.** This is a separate auth path from Django's JWT users; the two user databases are unrelated.

**If `RADICALE_USERNAME`/`PASSWORD` are unset, the entire bridge no-ops silently.** This is why `pytest` keeps passing without Radicale running and why production-style envs can disable sync just by not setting the vars.

All sync logic lives in `core/radicale_sync.py`. The four entry points:

| Trigger | Direction | What happens |
|---|---|---|
| `post_save` on `List` (created) | Django → Radicale | `MKCALENDAR` with `VTODO` support; stores the calendar URL on `list.remote_url`. If `view=calendar`, also creates the separate VEVENT collection (below) eagerly. |
| `post_save` on `Task` | Django → Radicale | Upserts a VTODO; stores `remote_uid` + `remote_etag` on the row |
| `post_delete` on `Task` | Django → Radicale | Deletes the matching VTODO |
| `post_save` on `Event` | Django → Radicale | Upserts a VEVENT into the list's **event collection** (`cal_id list-<id>-events`, created lazily if missing; URL stored on `list.remote_event_url`); stores `remote_uid` + `remote_etag` |
| `post_delete` on `Event` | Django → Radicale | Deletes the matching VEVENT |
| `POST /api/caldav/pull` | Radicale → Django | Walks every linked calendar (both VTODO and VEVENT collections), creates/updates/deletes Tasks and Events. Last-write-wins. |

**VEVENTs live in separate Radicale collections from VTODOs on purpose.** Apple clients mishandle mixed collections — iOS surfaces a collection in either Calendar *or* Reminders, not both. So each list can have two collections: `list-<id>` (VTODO → Reminders) and `list-<id>-events` (VEVENT → Calendar), both with the list title as display name. The event collection is created eagerly for `view=calendar` lists (so phone-created events can pull down) and lazily on first event push for any other list (so plain task lists don't clutter iOS Calendar with empty calendars).

There is **no automatic poll** from Radicale → Django — the phone's edits only land when something calls `/api/caldav/pull`. Either trigger it from the React client periodically, or wire a Radicale storage hook later.

Signals are loaded via `core/apps.py:CoreConfig.ready()` (which is why `INSTALLED_APPS` references `core.apps.CoreConfig` explicitly, not just `core`). All sync calls are wrapped in `try/except` with `log.warning` — Radicale being down never breaks a Django write.

Field mapping (Task ↔ VTODO):
- `title` ↔ `SUMMARY`
- `description` ↔ `DESCRIPTION`
- `completed` ↔ `STATUS` (`COMPLETED` vs `NEEDS-ACTION`)
- `due_date` ↔ `DUE;VALUE=DATE`
- `remote_uid` is the VTODO `UID` — never change it after first sync, that's the join key

Field mapping (Event ↔ VEVENT):
- `title` ↔ `SUMMARY`, `description` ↔ `DESCRIPTION`
- Timed events: `start`/`end` ↔ `DTSTART`/`DTEND` as UTC datetimes (`…Z`)
- All-day events: `DTSTART;VALUE=DATE` / `DTEND;VALUE=DATE` — **DTEND is exclusive per RFC 5545 while the DB `end` is inclusive**, so `_build_vevent` adds one day on the way out and `_parse_vevent` subtracts one on the way in
- `_parse_vevent` detects all-day by the DTSTART value being a date (not datetime); naive/floating times are assumed UTC; a missing DTEND becomes `end = start`
- `DTSTAMP` is emitted on push (RFC-required for VEVENT; iOS is picky)
- `remote_uid` is the VEVENT `UID` — same join-key rule as tasks
- Unlike the Task mapping, the Event round-trip **is covered by tests** (`test_events.py` runs `_build_vevent` → `icalendar` parse → `_parse_vevent` without needing Radicale)

`pull()` does *not* create new `List`s from Radicale calendars it doesn't recognize — only Tasks/Events within already-linked calendars are synced down. If you want a calendar created on the phone to materialize as a Django `List`, that's a follow-up.

### Adding a new field that should sync

If you add a field to `Task` or `Event` that should round-trip through CalDAV (say `priority`), you need to touch *both* directions:

1. `_build_vtodo` / `_build_vevent` in `radicale_sync.py` — write the right iCalendar property (`PRIORITY:5`)
2. `_parse_vtodo` / `_parse_vevent` in `radicale_sync.py` — read it back
3. Add the field to the relevant `*In` / `*Patch` / `*Out` schemas in `api.py`
4. Migration as usual

Forgetting (2) silently makes pull-from-phone clobber the field to its default on every pull. For Tasks there's no test that would catch this (the VTODO layer is untested); for Events, extend the round-trip tests in `test_events.py` — they parse `_build_vevent` output with `icalendar` and assert every field survives, no Radicale needed.

## Frontend (React client)

The UI lives in **`frontend/`** — a standalone npm/Vite project, *not* managed by `uv` or `just`. Run all frontend commands from inside `frontend/`.

### Stack

- React 19 + TypeScript, bundled with **Vite 8** — pure SPA, no SSR
- **TanStack Router** for file-based routing (the `tanstackRouter` Vite plugin regenerates `src/routeTree.gen.ts`). The entry is `src/main.tsx`; there is no `index.html` in `frontend/` — Django serves the HTML shell via a template (`src/templates/index.html`) and **django-vite** injects the script/link tags.
- **TanStack Query** (`@tanstack/react-query`) for all server state
- **TanStack Form** + **Zod** (v4) for form state and validation
- **shadcn/ui** on **Tailwind CSS v4** — components are **vendored** into `src/components/ui/` via the shadcn CLI (`npx shadcn@latest add <name>`), configured by `components.json`. Underneath: `radix-ui` primitives, `vaul` (bottom drawer), `sonner` (toasts), `react-day-picker` v9 (date picker), `class-variance-authority`/`clsx`/`tailwind-merge` (`cn()` in `src/lib/utils.ts`). Theme variables live in `src/styles.css` (`:root` / `.dark` + `@theme inline`).
- **@dnd-kit/core** + **@dnd-kit/utilities** — drag-and-drop for the calendar week grid only
- **@internationalized/date** — locale-aware week-start math for the calendar
- **lucide-react** for icons

### Commands (run from `frontend/`)

- `npm run dev` — Vite dev server on **`:3000`** (module server + HMR; visit Django on `:8000`, not Vite directly)
- `npm run build` — writes `frontend/dist/` with a hashed bundle and `.vite/manifest.json` for django-vite to read in prod
- `npm run preview`
- `npm run test` — vitest
- `npm run lint` (eslint), `npm run format` (prettier + `eslint --fix`), `npm run check` (prettier check)

Path aliases `#/*` and `@/*` both map to `./src/*`. `src/routeTree.gen.ts` is **generated** by the router plugin — never hand-edit it.

### Serving topology (Django serves the shell, Vite serves modules)

The browser **always loads `:8000` (Django)**. Django renders `src/templates/index.html`, which uses **django-vite** template tags (`{% vite_hmr_client %}` + `{% vite_asset 'src/main.tsx' %}`) to inject the right `<script>` / `<link>` tags:

- **Dev** (`DJANGO_VITE.default.dev_mode = DEBUG`): tags point at `http://localhost:3000/...` so the browser fetches ES modules + the HMR websocket directly from Vite. Vite is just a module server — visiting `:3000` standalone won't work (no `index.html` entry).
- **Prod** (`dev_mode = False`): tags read `frontend/dist/.vite/manifest.json` and emit hashed URLs under `/static/assets/...`. Django (via `STATICFILES_DIRS = [frontend/dist]`) serves them.

Because everything is same-origin on `:8000`, **there is no CORS, no Vite `/api` proxy, and no preflight**. `API_BASE` in `src/lib/api.ts` defaults to `''` (relative) — `fetch('/api/...')` hits Django directly. Set `VITE_API_URL` only if you're pointing the client at a separately-hosted backend (which *would* need CORS).

**Do not add a server.** All API access is **client-side** via TanStack Query + `apiFetch`. There is no SSR; the app is a pure SPA.

### File layout (`frontend/src/`)

- `main.tsx` — SPA entry. Creates the TanStack Router, wraps `<RouterProvider>` in `QueryClientProvider` (one client per app instance via `useState`) plus sonner's `<Toaster position="top-center" />`, mounts into `#root`. Imports `styles.css` as a side effect.
- `routes/__root.tsx` — minimal: just `createRootRoute({ component: () => <Outlet /> })`. The HTML shell lives in Django (`src/templates/index.html`), which includes the blocking inline script that restores the `light`/`dark` class from `localStorage` before paint (prevents flash).
- `routes/index.tsx` — welcome page (redirects to `/tasks` if already authed)
- `routes/login.tsx` — username/password sign-in (shadcn Card + Label/Input)
- `routes/_authenticated.tsx` — layout-route guard + shell. Desktop: 3-column grid header (`logo | centered tabs | settings`). Mobile: floating bottom tab bar (`position: fixed`). Redirects to `/login` when not authenticated (runs client-only — early-returns on the server). Contains `PrimaryTabs` — active tab is derived from pathname; returns `undefined` (not a default tab) on non-tab routes like `/settings` so nothing is highlighted.
- `routes/_authenticated/tasks.tsx` — renders `<TasksView />` (all tasks across lists)
- `routes/_authenticated/lists.index.tsx` (`/lists`) — the lists management view (`<ListsView />`)
- `routes/_authenticated/lists.$listId.tsx` (`/lists/$listId`) — a single list's detail; renders `<TasksView listId={…} />` pre-filtered to that list. The **Lists** tab stays active because the pathname still starts with `/lists`. (There is no `lists.tsx` layout file — the flat `lists.index` + `lists.$listId` files are siblings.)
- `routes/_authenticated/calendar.tsx` — renders `<CalendarView />`, the drag-and-drop week grid (see below)
- `routes/_authenticated/settings.tsx` — theme toggle (dark/light), CalDAV connection instructions, sign-out
- `lib/auth.ts` — token store (cookies), `lib/api.ts` — API client, `lib/auth-hooks.ts` — TanStack Query auth hooks
- `lib/queries.ts` — all TanStack Query hooks (`useTasks`, `useLists`, `useCreateTask`, bulk task hooks, plus `useEvents(rangeStart, rangeEnd)`, `useCreateEvent`, `useUpdateEvent`, `useDeleteEvent`)
- `lib/tasks-api.ts` — raw fetch functions for tasks and lists (`tasksApi`, `listsApi`); exports `jsonOrThrow`/`okOrThrow` for other api modules
- `lib/events-api.ts` — raw fetch functions for events (`eventsApi`). The interface is named **`CalendarEvent`** (not `Event` — that clashes with the DOM type); `start`/`end` are full ISO datetimes, unlike Task's date-only `due_date`
- `lib/schemas.ts` — Zod form schemas (`taskFormSchema`, `listFormSchema`, `eventFormSchema`) + `firstError()` helper for TanStack Form errors
- `lib/utils.ts` — shadcn's `cn()` (clsx + tailwind-merge)
- `components/ui/` — **vendored shadcn components** (button, dialog, drawer, select, calendar, sonner, …). Managed by the shadcn CLI; excluded from eslint (see `eslint.config.js` ignores); avoid hand-editing beyond what the CLI wrote
- `components/common/` — `Fab`, `ConfirmDialog` (AlertDialog-based), `DueDatePicker` (date-only, Popover + react-day-picker Calendar)
- `components/tasks/` — `TasksView`, `TaskCard`, `TaskDetailDialog` (Dialog), `TaskFormDrawer` (vaul bottom Drawer, create/edit)
- `components/lists/` — `ListsView`, `ListCard`, `CreateListDialog` (Dialog), `ListSettingsDialog` (rename + delete)
- `components/calendar/` — the week-grid calendar (see "Calendar view" below): `CalendarView`, `WeekGrid`, `EventFormDrawer`, `EventDetailDialog`, `calendar-utils.ts`

### Auth flow (client side)

- **Login**: `useLogin()` (a TanStack Query `useMutation` in `lib/auth-hooks.ts`) calls `POST /api/token/pair`, stores the returned `{access, refresh, username}`, and navigates to `/tasks`. `useLogout()` clears cookies + query cache and returns to `/`.
- **Token storage**: tokens live in **cookies** (`SameSite=Strict`, `Secure` on HTTPS) via `lib/auth.ts`. `isAuthenticated()` keys off the **refresh** token (the access token is short-lived). ⚠️ These are **JS-readable cookies, not `httpOnly`** — the API returns tokens in the response body, so the client must read them; true `httpOnly` would require a backend `Set-Cookie` change. No more XSS-safe than localStorage.
- **Authenticated requests**: use `apiFetch(path, init)` from `lib/api.ts`. It attaches `Authorization: Bearer <access>` and, on a `401`, transparently refreshes once via `POST /api/token/refresh` and retries — clearing the session if refresh fails. Build new data hooks (lists/tasks) on top of `apiFetch` + TanStack Query.

### Data layer, forms & domain rules

- **Four-file data layer**: `lib/tasks-api.ts` + `lib/events-api.ts` (typed api objects over `apiFetch`; `jsonOrThrow`/`okOrThrow` raise `ApiError` carrying the server `detail`), `lib/queries.ts` (all Query hooks + the `queryKeys` map), `lib/schemas.ts` (Zod). Every mutation invalidates the matching query keys on success; deleting a list invalidates lists **and** tasks (cascade); event mutations invalidate `queryKeys.events` (and `lists` on create, because of auto-create).
- **Forms use TanStack Form + Zod.** Pass the schema as `validators: { onChange: schema }` (Zod v4 is a Standard Schema, which TanStack Form v1 accepts directly). Use a plain `<form>`; annotate `defaultValues` with the schema's inferred type (`const defaults: TaskFormValues = {…}`) so optional fields stay optional — use a typed variable, **not an `as` cast** (eslint's `--fix` strips "unnecessary" assertions and then `tsc` breaks). Show messages with `<p className="text-sm text-destructive">{firstError(field.state.meta.errors)}</p>`. Mutations report via sonner's `toast.success`/`toast.error` (`<Toaster />` mounted in `main.tsx`); query load failures render an inline `Alert variant="destructive"` with a Retry button.
- **`due_date` is date-only.** The OpenAPI field is `format: date` (backend `DUE;VALUE=DATE`) — there is intentionally **no time picker**; an ISO datetime would fail validation. `DueDatePicker` maps a `YYYY-MM-DD` string ↔ a local `Date` for react-day-picker (string split, not `new Date(str)`, to avoid UTC day-shift).
- **Event `start`/`end` are full ISO datetimes** (UTC on the wire). Timed events compose local date+time inputs → `toISOString()`; all-day events send `<date>T00:00:00Z` with the date components carrying the meaning and `end` inclusive.
- **A task/event must always belong to a list.** `useCreateTask` auto-creates a default `"My Tasks"` list when no `list_id` is passed; `useCreateEvent` prefers an existing `view === 'calendar'` list, else auto-creates `"My Calendar"` (view=calendar). Don't add a separate guard that blocks creation when the list dropdown is empty.

### Component conventions (important)

- **shadcn/ui components only** (vendored under `components/ui/`), **lucide-react for all icons**. No other component/icon libraries. Need a new primitive? `npx shadcn@latest add <name>` from `frontend/` rather than hand-rolling or importing another library.
- Button: `variant` is `default`/`secondary`/`destructive`/`ghost`/`outline`/`link`; `size` includes `icon`, `icon-sm`, `icon-lg` for icon-only. Standard DOM props (`onClick`, `disabled`) — no `onPress`/`isDisabled`/`isPending`; pending = `disabled` + a `<Spinner />` child.
- Dark mode: shadcn styles key off the `.dark` class on `<html>` via `@custom-variant dark` in `styles.css`. The theme toggle (`useTheme` in `settings.tsx`) and the inline pre-paint script in Django's `src/templates/index.html` both manage that same class — keep them in sync.
- Tailwind color/typography utilities (`text-muted-foreground`, `text-2xl font-semibold`, …) are the normal way to style text — there is no Typography component.
- **Max-width pattern**: authenticated pages use `max-w-5xl mx-auto` (applied in `_authenticated.tsx`'s `<main>` wrapper — individual page components don't need to repeat it). Public pages (`/`, `/login`) center their own content.

### Overlay & toolbar patterns

- **Controlled overlays** (`Dialog`, `Drawer`, `AlertDialog`): drive them via `open`/`onOpenChange` with no trigger child. Mount inner forms with `{isOpen && <…/>}` plus a `key` so state resets between create/edit. Render a `ConfirmDialog` (AlertDialog) as a **sibling** of a Dialog, never nested inside it. `ConfirmDialog` deliberately uses a plain destructive `Button` (not `AlertDialogAction`, which auto-closes) so the caller can close on success only.
- **Responsive toolbars** (`TasksView`, `ListsView`): full labeled controls at `md`+ (`hidden shrink-0 … md:flex`), icon-only controls below (`flex shrink-0 … md:hidden`). To stop the row from overflowing horizontally, the search wrapper is `min-w-0 flex-1` (and its `Input` `min-w-0`) so it shrinks while the control group stays `shrink-0`.
- **Icon-only `Select` triggers** (mobile filters): `<SelectTrigger className="size-10 justify-center rounded-full p-0 [&>svg:last-child]:hidden">` with a `size-5` lucide icon as the only child — the `[&>svg:last-child]:hidden` suppresses the built-in chevron so two icons don't cram into the 40px trigger; there's no `SelectValue` (the icon is the face).

### Calendar view (`components/calendar/`)

A Google-Calendar-style week grid, adapted from the ui.corr.sh "availability" component (a shadcn registry item) to dated events:

- **`CalendarView`** — owns week state (locale-aware week start via `@internationalized/date`'s `startOfWeek`), fetches `useEvents` for the visible week window, owns drawer/detail dialog state, and converts grid gestures into PATCHes (`handleMove` shifts whole events by minutes — all-day events move in whole days via UTC date math; `handleResize` patches one boundary).
- **`WeekGrid`** — layout + interactions. Day headers (today highlighted), an **all-day strip** (Badge chips, only rendered when an all-day event is visible), and a scrollable 24h grid (`HOUR_HEIGHT` px/hour, auto-scrolled to 07:00). Interactions: **drag on empty column space** sketches a range and opens the create drawer pre-filled (a plain click = 1h slot); **dnd-kit drag** moves event blocks across days/times (PointerSensor with `distance: 5` so plain clicks open the detail dialog instead); **top/bottom edge resize** via pointer capture with local preview, committing on release. All snapping is 15-minute (`SNAP_MINUTES`).
- **`calendar-utils.ts`** — grid geometry constants, local-date helpers (`localDateKey` — never `toISOString().slice` for local days), multi-day events are clipped into per-day segments (`timedSegmentsForDay`), and overlapping segments share column width via greedy lane assignment (`layoutSegments`) — overlap is allowed, unlike the availability reference.
- All-day events are date-only: their day is read from the ISO string's date part (`allDayDateKey`), never via local timezone conversion.

### Key frontend components

- **`TasksView`** (`components/tasks/TasksView.tsx`) — the main task list. Handles filtering (search, status, list), select mode (bulk complete/duplicate/delete), and the detail/edit/create dialogs. Also owns the `canvas-confetti` celebration — fires from top-center of screen when a task is marked complete. Used by both the `/tasks` route (all tasks) and potentially embedded in a list detail view.
- **`TaskCard`** (`components/tasks/TaskCard.tsx`) — uniform-height card (one title line truncated, one description line truncated). In select mode the entire card is clickable (outer `role="button"` wrapper); the checkbox and complete button use `stopPropagation` to avoid double-firing. Complete button is wrapped in a `stopPropagation` div so clicking it doesn't open the detail dialog.
- **`useTheme`** (inline hook in `settings.tsx`) — reads/writes `localStorage` key `'theme'` and toggles the `light`/`dark` class on `document.documentElement`. Mirrors the inline script in Django's `src/templates/index.html` that restores the class on first paint.

### Confetti (task completion celebration)

Uses **`canvas-confetti`** (not `react-rewards`, which remains in `package.json` but is no longer used). `canvas-confetti` renders on a `position: fixed` full-viewport canvas appended to `document.body`, so it overlays everything regardless of stacking contexts. Called directly (not as a React hook) from `handleToggleComplete` in `TasksView` when `!task.completed`. Origin is `{ x: 0.5, y: 0 }` (top-center, falls downward).

## Things to know before changing auth

- Routes are protected per-decorator via `auth=auth`. There is no global middleware enforcement, so a forgotten `auth=` argument silently makes a route public. New routes should always include it unless they're explicitly meant to be unauthenticated (and there should be a very good reason for that).
- There's no register endpoint. New users come from `just createsuperuser` or the Django admin. If/when you add a register endpoint, it's the one route that needs to stay unauthenticated.
- Token lifetimes are `ninja-jwt` defaults (5 min access, 1 day refresh). Override via a `SIMPLE_JWT` dict in settings if needed.
- **CORS is not configured** — Django serves the HTML shell *and* the API on the same origin, so the browser never makes a cross-origin request to the API. If you ever host the React app on a separate domain (and point `VITE_API_URL` at Django), you'll need to add `django-cors-headers` back and allowlist that origin.

## Gotchas worth knowing about

A few decisions in this repo that look weird without context:

- **Two parallel user databases.** Django auth users (used for JWT / admin) and Radicale htpasswd users are unrelated systems. There's no plan to unify them — Radicale needs its own auth and it would be more work than it's worth to bridge them for a local-only deployment.
- **`remote_*` fields are nullable on purpose.** `List.remote_url`, `List.remote_event_url`, and the `remote_uid`/`remote_etag` pairs on `Task` and `Event` are all nullable because rows must be creatable when sync is disabled (tests do this constantly). Don't make them required.
- **VEVENTs deliberately live in separate Radicale collections from VTODOs** (`list-<id>-events` vs `list-<id>`) because Apple clients mishandle mixed collections. Don't "simplify" by merging them.
- **Signals fire on every `Task.save()` / `Event.save()` — bulk ops are NOT covered.** `Model.objects.update(...)` and `bulk_create` skip signals; if you start using them, sync will silently miss those changes. Use `.save()` per instance, or call `radicale_sync.push_task` / `push_event` explicitly.
- **`INSTALLED_APPS` says `core.apps.CoreConfig`, not `core`.** That's deliberate — it's what makes `CoreConfig.ready()` run, which is what loads the signal handlers. Removing the explicit reference silently breaks all CalDAV sync.
- **No global auth middleware.** Routes are protected one decorator at a time via `auth=auth`. There is no safety net — a forgotten `auth=` keyword silently makes the route public.
- **`pytest` runs with `RADICALE_USERNAME` unset.** Sync is a no-op throughout the test suite. If you ever want to test the sync path itself, you'll need to either spin up Radicale as a fixture or mock `caldav.DAVClient` — neither is set up yet.
- **`radicale.htpasswd` and `radicale_data/` are gitignored.** Fresh clones have no users and no data. `just radicale-adduser` creates the first user; Radicale auto-creates the storage dirs on first request.
- **The frontend is a separate npm project under `frontend/`.** It is not part of `uv`/`just`; run `npm` commands from inside `frontend/`. Vite runs on `:3000` and serves only ES modules — the **browser always loads `:8000` (Django)**.
- **`just build` is the production path.** It runs `npm run build` (writes `frontend/dist/` including `.vite/manifest.json`) then `collectstatic`. After that, Django with `DEBUG=False` serves the same SPA at `:8000` without Vite running.
- **Visiting `:3000` directly will 404.** There is no `frontend/index.html` — the Vite entry is `src/main.tsx`. Vite is a module/HMR server only; the HTML shell lives in `src/templates/index.html` and is served by Django.
- **Frontend JWTs are stored in JS-readable cookies, not `httpOnly`.** The API returns tokens in the body, so httpOnly isn't possible without a backend change. Not more XSS-safe than localStorage.
- **`src/components/ui/` is vendored shadcn code.** It's excluded from eslint (see `eslint.config.js`); update it via the shadcn CLI, not by hand. `react-day-picker` is pinned to v9 because the vendored `calendar.tsx` targets the v9 API.
