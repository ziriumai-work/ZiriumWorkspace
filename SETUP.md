# Workspace — setup

A Notion-style company workspace: project tracking now, generic pages/databases,
DeepSeek automations, and Slack updates in later phases. Built on Next.js 16 +
React 19 + Firebase (Auth + Firestore) + Tailwind.

There are two ways to run it: **(A) the emulators** (no Firebase account needed,
great for trying it out) or **(B) a real Firebase project** (for actually using
it as a team).

---

## A) Run locally with the Firebase emulators (fastest)

1. Install the Firebase CLI (one time):

   ```bash
   npm install -g firebase-tools
   ```

2. Create `.env.local` from the example and turn the emulator flag on:

   ```bash
   cp .env.local.example .env.local
   ```

   Then in `.env.local` set:

   ```
   NEXT_PUBLIC_FIREBASE_USE_EMULATOR=true
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-workspace
   ```

   (With the emulator the other `NEXT_PUBLIC_FIREBASE_*` values can stay blank.)

3. In one terminal, start the emulators:

   ```bash
   firebase emulators:start
   ```

4. In another terminal, start the app:

   ```bash
   npm run dev
   ```

5. Open http://localhost:3000 → you'll be sent to `/login`. Click **Continue
   with Google**; the Auth emulator lets you create a test account in the popup.
   The first user becomes a plain `member`.

---

## B) Run against a real Firebase project

1. Go to the [Firebase console](https://console.firebase.google.com) → **Add
   project**.

2. **Authentication** → Get started → enable the **Google** sign-in provider.

3. **Firestore Database** → Create database (start in production mode; our rules
   handle access).

4. **Project settings → General → Your apps → Web app** → register an app and
   copy the config values.

5. Create `.env.local` and fill them in (leave `USE_EMULATOR` unset):

   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```

6. Put your real project ID in `.firebaserc` (replace the placeholder).

7. **Enable Storage** (for task-report file uploads): **Build → Storage → Get
   started** → pick a location. (Skip only if you don't need file uploads — text
   and link reports work without it.)

8. Deploy the security rules (Firestore **and** Storage):

   ```bash
   firebase deploy --only firestore:rules,storage
   ```

   Or paste them in the console: **Firestore → Rules** ← [firestore.rules](firestore.rules);
   **Storage → Rules** ← [storage.rules](storage.rules). Republish whenever these
   files change (they currently cover `users`, `members`, `teams`, `developers`
   (employees), `projects`, and `tasks`).

9. Start the app and sign in:

   ```bash
   npm run dev
   ```

10. **Owner / admin access:** the first user who signs in and isn't yet in the
    Employees directory is treated as an **admin** automatically (so you're never
    locked out). Optionally also set `members/{your-uid}.role = "owner"` in the
    console. Once you add yourself to **Employees**, set your Access level to
    **Admin** so you keep admin rights.

---

## AI assistant (DeepSeek)

The workspace has a built-in AI assistant (Notion-AI style): pick a model, give a
prompt, watch the answer stream in. It's powered by DeepSeek, called from a
server route handler so the API key never reaches the browser.

1. Get an API key at https://platform.deepseek.com → **API keys**.
2. Add it to `.env.local` (server-only — no `NEXT_PUBLIC_` prefix):

   ```
   DEEPSEEK_API_KEY=sk-...
   ```

3. Restart `npm run dev`.

**Using it:**

- Click **Ask AI** in the top bar, or press **⌘K / Ctrl+K** anywhere.
- Pick a model: **DeepSeek V4 Flash** (fast, general) or **DeepSeek V4 Pro**
  (shows reasoning; better for planning). Note: these are product labels — they
  map to DeepSeek's `deepseek-chat` and `deepseek-reasoner` engines (no public v4
  API yet); see [ARCHITECTURE.md](ARCHITECTURE.md) §9.
- On a project page, use the **AI** quick actions (Summarize / Draft status
  update / Next steps) — results can be inserted straight into the notes.

> Security note: the `/api/ai` endpoint protects the API key but does not yet
> verify the caller's identity. Before exposing the app publicly, add Firebase
> ID-token verification (firebase-admin) or Firebase App Check. Tracked for a
> later phase.

## What's built

- **Auth & roles** — Google sign-in; admins vs employees (see the access model in
  [ARCHITECTURE.md](ARCHITECTURE.md)).
- **Employees directory** (admin-only) — name, email, job title, department
  (Web/AI/App/Custom), employment type, start date, status, access level.
- **Projects** — list with Table + Board views; project pages with properties,
  assigned employees, notes, and AI actions. Employees see only assigned projects.
- **Notion-style database** per project — custom typed columns (text, number,
  select, multi-select, status, date, URL, email, phone, checkbox), a column menu
  (rename, change type, sort, insert, delete), and an options editor with colors.
- **Daily tasks** — admins assign dated tasks to employees; employees get
  "My Tasks" and submit reports (text + links + **file uploads** via Storage).
- **Zirium AI** — DeepSeek chat, model picker, streaming; plus a ⌘K quick
  assistant and a "Generate with AI" project agent.

For the full picture (data model, file map, conventions, how to extend), read
[ARCHITECTURE.md](ARCHITECTURE.md).

## Roadmap

- **Phase 2** — generic pages & databases with custom property types
- **Phase 3 (next)** — automation rules (trigger → AI action): auto-edit
  properties, auto-create pages, auto-send updates, built on the AI layer above
- **Phase 4** — Slack delivery for those updates; endpoint auth hardening
  (Firebase ID-token verification / App Check)
