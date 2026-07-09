# Workspace — Developer Guide

A Notion-style company **internal tool**: project tracking with flexible
databases, an employee directory with role-based access, daily task assignment
with reports, and a built-in AI assistant ("Zirium AI") powered by DeepSeek.
This document is the single source of truth for new developers — read it before
changing code.

> **Companion docs:** [SETUP.md](SETUP.md) (how to run it) ·
> [AGENTS.md](AGENTS.md) (rules for AI coding assistants).

---

## 1. What this is

| | |
|---|---|
| **Product** | Internal company hub: projects, Notion-like databases, an employee directory, daily tasks + reports, and an AI assistant/agent. |
| **Users** | Members of one company (single-tenant). Google sign-in. Two roles: **admin** and **employee**. |
| **Status** | Phases 0–2 (foundation, projects, database engine) + Employee/Access + Daily Tasks shipped. Automation rules are the planned next build. |

---

## 2. Tech stack

- **Next.js 16.2.9** (App Router, Turbopack) — ⚠️ see the version warning below.
- **React 19** · **TypeScript** (strict) · **Tailwind CSS v4** (config-less,
  CSS variables).
- **Firebase**: **Cloud Firestore** (NoSQL DB), **Firebase Auth** (Google),
  **Firebase Storage** (task-report file uploads). Client SDK only — no server
  admin SDK yet.
- **DeepSeek API** (OpenAI-compatible) for AI, called from a Next.js Route
  Handler so the key stays server-side.

### ⚠️ Next.js 16 is not the Next.js you may know
Breaking changes from earlier versions. **Before writing Next.js code, read the
bundled docs in `node_modules/next/dist/docs/`** (mandated by `AGENTS.md`). Most
relevant:
- `params` / `searchParams` are **Promises** — `use(params)` in client
  components, `await` in server components. Route handlers get a Promise `params`
  too.
- `middleware.ts` → `proxy.ts` (unused here).
- Turbopack is default; `turbopack.root` is pinned in
  [next.config.ts](next.config.ts).

---

## 3. Getting started (quick)

```bash
npm install
cp .env.local.example .env.local   # fill Firebase + DeepSeek values
npm run dev                         # http://localhost:3000
```

Full setup (Firebase project, **publishing security rules**, **enabling
Storage**, emulator option, DeepSeek key) is in [SETUP.md](SETUP.md). Scripts:

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type-check |

**Before committing:** `npx tsc --noEmit` and `npm run lint` must both be clean.

> **When you add a new Firestore collection or change rules**, you must publish
> them (`firebase deploy --only firestore:rules` or paste in the console).
> Adding *fields* to an existing collection (e.g. project `columns`/`rows`) does
> **not** need a rules change.

---

## 4. Project structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout: fonts, <AuthProvider>, full-height body
│   ├── page.tsx                # "/" → redirects to /dashboard or /login
│   ├── login/page.tsx          # Google sign-in
│   ├── api/ai/route.ts         # POST /api/ai — DeepSeek streaming proxy (server-only key)
│   └── (app)/                  # Authenticated area (route group)
│       ├── layout.tsx          # Auth guard + shell (sidebar, topbar, <AiProvider>)
│       ├── dashboard/page.tsx  # Overview (role-filtered project counts + recent)
│       ├── projects/
│       │   ├── page.tsx        # Projects list (role-filtered): Table/Board, quick-add, MARK seed, AI agent
│       │   └── [id]/page.tsx   # Project detail: properties, assignees, Notion table, notes, AI actions
│       ├── tasks/page.tsx      # Tasks: admin assign + employee "My Tasks" + reports
│       ├── team/page.tsx       # Employees directory (admin-only)
│       └── zirium/page.tsx     # Zirium AI — full chat
├── components/
│   ├── AppSidebar.tsx          # Left nav (role-aware) + user/sign-out
│   ├── AppTopbar.tsx           # Breadcrumb + "Ask AI" (⌘K)
│   ├── projectMeta.ts          # Project status/priority display metadata
│   ├── ai/AiProvider.tsx       # Global AI assistant (useAi()): modal, model picker, streaming, ⌘K
│   ├── projects/
│   │   ├── NotionTable.tsx     # ⭐ Database engine: typed columns, column menu, cells, options editor
│   │   ├── ProjectTable.tsx    # Projects list — table view
│   │   ├── ProjectBoard.tsx    # Projects list — board (kanban by project status)
│   │   ├── ProjectDevelopers.tsx # Project-level people assignment (lead + add/remove; editable=admin)
│   │   └── AiProjectAgent.tsx  # "Generate with AI" — brief → full project database
│   └── tasks/
│       └── TaskReportEditor.tsx # Task report editor: text + links + file uploads
└── lib/
    ├── firebase.ts             # Firebase init (build-safe; auth + db + storage; emulator support)
    ├── auth-context.tsx        # ⭐ AuthProvider + useAuth(): user, member, employee, isAdmin
    ├── types.ts                # ⭐ All domain types
    ├── projects.ts             # Firestore CRUD + subscriptions for projects
    ├── developers.ts           # Firestore CRUD + subscription for EMPLOYEES (collection name "developers")
    ├── tasks.ts                # Firestore CRUD + subscriptions for daily tasks
    ├── storage.ts              # uploadTaskFile() — Firebase Storage uploads
    ├── members.ts              # Member/profile subscriptions (legacy, light use)
    ├── db.ts                   # Database helpers: defaultColumns(), STATUS_OPTIONS, migrateTasksToDb()
    ├── ai-models.ts            # AI model catalogue + product→DeepSeek id mapping
    ├── ai-client.ts            # streamCompletion() — consumes /api/ai NDJSON
    ├── ai-agent.ts             # generateProjectPlan() — brief → {title, columns, rows}
    └── seed/markArchitecture.ts # MARK Architecture sample timeline → database
```

Root config: [firebase.json](firebase.json), [firestore.rules](firestore.rules),
[storage.rules](storage.rules), [firestore.indexes.json](firestore.indexes.json),
[.firebaserc](.firebaserc), [next.config.ts](next.config.ts),
[.env.local.example](.env.local.example).

---

## 5. Architecture & data flow

```
Browser (React client components)
   │  Firebase Web SDK: Auth + Firestore (real-time) + Storage
   ▼
Firestore / Storage  ◄── security rules enforce access (the REAL gate)
   ▲
   │  AI features POST to ↓
Next.js Route Handler  /api/ai  ──►  DeepSeek API   (DEEPSEEK_API_KEY, server-only)
```

- **Almost everything is client-side**: data access uses the Firebase Web SDK
  directly from `"use client"` components via the `lib/*.ts` helpers. The only
  backend is the one AI route handler.
- **Real-time by default**: lists use `onSnapshot` and re-render on any change.
- **Auth lives only in the browser** — hence the client-side redirects and the
  defensive `firebase.ts` init (so a server prerender without env still builds).
- **The AI key never reaches the browser** — only `/api/ai` reads it.

---

## 6. Identity, roles & access (read this carefully)

There are **two identity concepts**:

1. **Member** (`members/{uid}`) — the Firebase Auth account that signed in
   (Google). Has a coarse `role` (owner/admin/member). Created automatically on
   first sign-in.
2. **Employee** (`developers/{id}` — collection name kept for backwards-compat;
   the TS type is aliased as `Employee`) — an HR record created by an admin, with
   department, employment type, status, **access level**, etc. **Linked to a
   login by matching `email`.**

### How "who am I + what can I do" is resolved
[auth-context.tsx](src/lib/auth-context.tsx) exposes via `useAuth()`:
`{ user, member, employee, isAdmin, loading, signInWithGoogle, signOut }`.

- `employee` = the employee record whose `email` matches `user.email`.
- On first match, the employee's `uid` is bound (best-effort).
- **`isAdmin` is true if**: member role is owner/admin, **OR** the matched
  employee's `accessLevel === "admin"`, **OR** the user is signed in but **not
  listed** in the employee directory (the owner/setup case).

> 🔑 **Key rule:** only people **explicitly added as employees** get the
> restricted view. Anyone signed in but not in the directory is treated as an
> admin. This is deliberate — it prevents the workspace owner from locking
> themselves out. (An earlier bug used "zero employees" as the only bootstrap and
> *did* lock the owner out; don't reintroduce that.)

### What access actually gates (currently UI-level)
- **Admins**: see/manage everything — Employees directory, all projects, assign
  people to projects, create projects, assign tasks, see all tasks.
- **Employees**: see only **projects they're assigned to** (filtered on the
  Projects list, Dashboard, and guarded on the project detail page), and only
  **their own tasks** ("My Tasks"). They can't open unassigned projects, create
  projects, reassign people, or see the Employees page.

⚠️ **This access control is enforced in the UI, not yet in Firestore rules** —
the rules currently allow any member to read these collections. A determined
employee could query unassigned data via the SDK. **Harden the rules before
putting sensitive HR data in** (see §9).

---

## 7. Data model (Firestore)

| Collection | Doc id | Type | Notes |
|---|---|---|---|
| `users` | `uid` | `UserProfile` | Created on first sign-in. |
| `members` | `uid` | `Member` (role) | Auth membership. First user self-joins as `member`; promote to `owner` by hand once. |
| `teams` | `teamId` | `Team` | Defined, lightly used. |
| `developers` | auto | `Employee` (aka `Developer`) | **Employee directory.** Rich HR fields; linked to login by email. |
| `projects` | auto | `Project` | Carries its own Notion database inline. |
| `tasks` | auto | `DailyTask` | Daily tasks assigned to employees, with a report. |

All shapes live in [types.ts](src/lib/types.ts). Highlights:

### Employee (`developers` collection)
```ts
interface Employee {
  id; name; email;          // email links to the Google login
  role;                     // job title
  department: "web" | "ai" | "app" | "custom";
  employmentType: "full_time" | "part_time" | "contract" | "intern";
  startDate: string | null; // yyyy-mm-dd
  status: "active" | "on_leave" | "terminated";
  accessLevel: "admin" | "employee";
  uid: string | null;       // bound on first matching sign-in
  createdAt;
}
```

### Project (carries an inline database)
```ts
interface Project {
  id, title, description, status, priority, dueDate, order,
  developerIds: string[];   // assigned EMPLOYEES (employee ids; [0] = lead) → drives access
  columns: DbColumn[];      // the table schema
  rows: DbRow[];            // the table data
  tasks?: TaskItem[];       // LEGACY (pre-database) — auto-migrated on open
  createdBy, createdAt, updatedAt,
}

type ColumnType = "text" | "number" | "select" | "multi_select"
                | "status" | "date" | "url" | "email" | "phone" | "checkbox";
interface DbColumn { id; name; type; options?: SelectOption[]; }
interface SelectOption { id; label; color: OptionColor; }  // 8 colors
interface DbRow { id; order; cells: Record<columnId, CellValue>; }
type CellValue = string | number | boolean | string[] | null;  // string[] = multi-select
```

**Why the database is inline:** storing `columns`/`rows` on the project document
keeps everything under the existing `projects` rule (no new rules per feature).
Trade-off: Firestore's **1 MB document limit** (~hundreds of rows/project is
safe). The upgrade for large datasets is a `projects/{id}/rows` subcollection.

### DailyTask (`tasks` collection)
```ts
interface DailyTask {
  id, title, description,
  projectId, projectTitle,  // optional link to a project (denormalized title)
  assigneeId, assigneeName, // the employee (id + denormalized name)
  date,                     // yyyy-mm-dd
  status: "todo" | "in_progress" | "done",
  report: { text: string; links: string[]; files: { name; url }[] },
  createdBy, createdAt, updatedAt,
}
```
Employee task queries use an equality filter (`where assigneeId == id`) and sort
client-side — **no composite index needed**.

### Legacy migration
Early projects stored a fixed `tasks: TaskItem[]`. On open, the project detail
page detects `rows.length === 0 && tasks.length > 0` and converts via
`migrateTasksToDb()` ([db.ts](src/lib/db.ts)) — once, ref-guarded.

---

## 8. Feature walkthrough

- **Auth/roles** — [auth-context.tsx](src/lib/auth-context.tsx) (§6).
- **Shell** — [(app)/layout.tsx](src/app/(app)/layout.tsx) guards the route group
  + sidebar/topbar + `<AiProvider>`. Sidebar nav is role-filtered (Employees is
  admin-only).
- **Dashboard** — live status counts + recent projects, **filtered by role**.
- **Projects list** — Table/Board, role-filtered; admins also get quick-add,
  **+ MARK Architecture sample**, and **Generate with AI**.
- **Project detail** — properties, **Assigned to** (employees; editable by admins
  only — assignment is what grants employee access), the **NotionTable**, notes,
  and **AI actions**. Employees who aren't assigned are blocked.
- **NotionTable** ([NotionTable.tsx](src/components/projects/NotionTable.tsx)) —
  add/rename/delete/insert columns, **Change type** (Notion-style list), per-type
  cell editors, and the **Options editor** (add/rename/recolor/delete options).
- **Tasks** ([tasks/page.tsx](src/app/(app)/tasks/page.tsx)) — admins assign
  dated tasks to employees (with optional project) and see all tasks; employees
  see "My Tasks" and submit a **report** (text + links + file uploads) via
  [TaskReportEditor](src/components/tasks/TaskReportEditor.tsx).
- **Employees** ([team/page.tsx](src/app/(app)/team/page.tsx)) — admin-only
  directory: add/manage people and their access level.
- **Zirium AI** ([zirium/page.tsx](src/app/(app)/zirium/page.tsx)) — full chat;
  plus the **⌘K quick assistant** ([AiProvider.tsx](src/components/ai/AiProvider.tsx)).

---

## 9. AI integration

- **Provider:** DeepSeek (OpenAI-compatible).
- **Models** ([ai-models.ts](src/lib/ai-models.ts)): UI shows **"DeepSeek V4
  Flash/Pro"** — ⚠️ DeepSeek has **no public v4 API**; these map via `apiId` to
  `deepseek-chat` (Flash) and `deepseek-reasoner` (Pro). Swap `apiId` when a real
  v4 ships.
- **Endpoint** ([api/ai/route.ts](src/app/api/ai/route.ts)): `POST /api/ai` →
  validates model, maps to the real engine, streams DeepSeek SSE, re-emits clean
  **NDJSON** (`{type:"reasoning"|"text"|"error"}`).
- **Client** ([ai-client.ts](src/lib/ai-client.ts)): `streamCompletion(...)`.
- **Agent** ([ai-agent.ts](src/lib/ai-agent.ts)): `generateProjectPlan(brief,
  model)` → strict-JSON → `{ title, description, columns, rows }`.

---

## 10. Security (rules, storage, known gaps)

- **Firestore rules** ([firestore.rules](firestore.rules)) — deny-by-default.
  Members can read/write `projects`, `developers`, and `tasks`; self-join only
  grants `member`; role changes require owner/admin. **Must be published** to the
  live project.
- **Storage rules** ([storage.rules](storage.rules)) — any signed-in user can
  read/write under `task-reports/`; everything else denied. Requires **Storage
  enabled** in the console.

### ⚠️ Known gaps (address before real/public rollout)
1. **Access control is UI-level, not rule-level.** Rules let any member read
   employees/projects/tasks. Tighten with per-record checks (e.g. task `update`
   only if `request.auth.uid == resource.data.assigneeId` once uid binding is
   relied on; project read only if assigned). HR data (salaries, etc.) needs
   field-level/private-collection rules first.
2. **`/api/ai` has no caller authentication** — anyone reaching the URL can spend
   DeepSeek quota. Fix with Firebase ID-token verification (`firebase-admin`) or
   App Check.
3. **1 MB project-document limit** — move `rows` to a subcollection when projects
   get large.
4. **Secrets**: `DEEPSEEK_API_KEY` is server-only (no `NEXT_PUBLIC_`).
   `.env.local` is git-ignored — never commit it.

---

## 11. Conventions

- **Client vs server:** Firebase/hooks/browser APIs → `"use client"`. The secret
  AI call stays in the route handler.
- **Persistence pattern:** components are controlled by the parent, which owns
  writes. Editors call `onChange(nextWholeValue)` → parent does
  `updateX(id, {...})`. Free-typing fields (title, notes, text cells, reports)
  buffer locally and persist **on blur / explicit save**, not per keystroke.
- **Styling:** use the tokens in [globals.css](src/app/globals.css) — `bg-card`,
  `bg-surface`, `border-border`, `text-muted`, `bg-accent`, `text-accent`,
  `bg-accent-soft`.
- **IDs:** `crypto.randomUUID()` for client-generated ids.
- **Lint gotcha:** don't call `setState` synchronously inside an effect body. Use
  a lazy `useState(() => …)` initializer, or do it in the effect's cleanup, or
  rely on the subscription callback. (We hit this several times.)
- **Role checks:** read `isAdmin` / `employee` from `useAuth()`; never re-derive
  role logic in components.

---

## 12. How to extend it

- **Add a column type** → [types.ts](src/lib/types.ts) `ColumnType` (+ `CellValue`
  if needed); [NotionTable.tsx](src/components/projects/NotionTable.tsx)
  `TYPE_LABELS`/`TYPE_ICONS`/`TYPE_ORDER` + a `Cell` editor.
- **Add a page/route** → `src/app/(app)/<name>/page.tsx` (`"use client"`); add a
  nav item in [AppSidebar.tsx](src/components/AppSidebar.tsx) (set `adminOnly` if
  needed) + a breadcrumb case in [AppTopbar.tsx](src/components/AppTopbar.tsx).
- **Add a Firestore collection** → a `lib/<name>.ts` access module + **rules** in
  [firestore.rules](firestore.rules), then publish.
- **Gate a feature by role** → `const { isAdmin, employee } = useAuth();` and
  branch in the component.
- **Add an AI feature** → reuse `streamCompletion` or
  `useAi().openAi({ prompt, system, onInsert })`; for structured output, prompt
  for JSON and parse like [ai-agent.ts](src/lib/ai-agent.ts).

---

## 13. Roadmap

- **Next — Automation rules:** *trigger → action* (e.g. "Status → Done → AI
  drafts an update + posts to Slack"); AI Autofill for columns.
- **Slack** delivery (`SLACK_BOT_TOKEN`) + **endpoint auth hardening**.
- **Rule-level access control** for employees/tasks/HR data (see §10).
- **Report approval** workflow (admin marks reports Approved / Needs changes).
- **Later:** Board view for the project database, column drag-reorder/resize,
  filters, relations/rollups & more column types, multiple databases / nested
  pages, rows subcollection for scale, persisted chat history.
```
