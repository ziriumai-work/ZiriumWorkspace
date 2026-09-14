# Company Workspace - Project Handover

Welcome to the Company Workspace repository. This document serves as the primary "Start Here" guide for developers taking over or contributing to the project.

This is a Notion-style company internal tool that provides project tracking with flexible databases, an employee directory with role-based access, daily task assignments, HR modules (Attendance, Leaves, Salaries, Invoices), and a built-in AI assistant ("Zirium AI") powered by DeepSeek.

**Important Companion Docs:**
- 📐 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Full developer guide (stack, data model, file map, conventions, how to extend). **Read this first before changing code.**
- ⚙️ [docs/SETUP.md](docs/SETUP.md) — Instructions on how to run the project locally (Firebase Emulators or Real Project) and how to configure DeepSeek API keys.

---

## 🚀 Current State & Features Shipped

The project is currently in the middle of active development (Phases 0–2 completed). It is a single-tenant application meant for one company's internal use via Google Sign-In.

**Key Features Implemented:**
- **Auth & Access Control:** Role-based access (`admin` vs `employee`). First signed-in, unlisted user defaults to `admin` to prevent lockouts.
- **Employee Directory:** HR record management (Job title, department, access level) linking directly to Firebase Auth logins.
- **Project Tracking:** Notion-style customizable databases for each project. Table and Board views. Employees can only see projects they are assigned to.
- **Daily Tasks:** Task assignment system with daily reports (supports text, links, and file uploads via Firebase Storage).
- **Zirium AI:** A DeepSeek-powered AI assistant that functions as a full chat interface, a ⌘K quick assistant, and a "Generate with AI" project planner.
- **HR & Finance Modules:** Added sections for Attendance, Leaves, Finance (Salaries, Allotment, Invoices), and Documents.
- **Dashboards:** Role-filtered dashboard displaying live status counts, employee stats, and recent projects.

---

## 🛠 Tech Stack

- **Framework:** [Next.js 16.2.9](https://nextjs.org/) (App Router, Turbopack)
- **UI & Styling:** React 19, [Tailwind CSS v4](https://tailwindcss.com/) (config-less with CSS variables)
- **Backend & Database:** Firebase (Cloud Firestore NoSQL, Firebase Auth, Firebase Storage)
- **AI Integration:** DeepSeek API (OpenAI-compatible) called strictly from server-side Route Handlers.
- **Language:** TypeScript (Strict mode)

> ⚠️ **Note on Next.js 16:** This project uses Next.js 16 which includes breaking changes (e.g., `params` / `searchParams` are Promises). Read the bundled docs in `node_modules/next/dist/docs/` before implementing new routes.

---

## 📂 Project Structure Overview

```text
src/
├── app/                  # Next.js App Router pages and API routes
│   ├── (app)/            # Authenticated route group (dashboard, projects, tasks, finance, etc.)
│   ├── api/ai/           # Server-side Route Handler for DeepSeek API
│   └── login/            # Public Google sign-in page
├── components/           # Reusable React components (UI, layout, NotionTable, etc.)
├── hooks/                # Custom React hooks (e.g., useAttendanceData, useLocalStorage)
├── lib/                  # Core business logic and utilities
│   ├── ai/               # AI models, DeepSeek client, and agent helpers
│   ├── data/             # Firestore CRUD operations & TS types for all domain entities
│   ├── firebase/         # Firebase initialization, DB helpers, and AuthProvider context
│   └── utils/            # General utilities (PDF generation, date formatting)
firebase/                 # Firebase rules for Firestore and Storage
docs/                     # Detailed architectural and setup documentation
scripts/                  # Project maintenance scripts (e.g., comment cleanup)
test/                     # Test suites (unit tests)
```

---

## 🔒 Security & Known Gaps (Action Required)

The following security enhancements are required before deploying to production:

1. **Rule-Level Access Control:** Currently, role gating (admin vs employee) is primarily handled in the UI. A determined employee could query unauthorized data (like other people's salaries or unassigned projects) using the Firebase SDK directly. **Action:** Harden `firestore.rules` using the implementation plan documented in the workspace.
2. **Endpoint Authentication:** The `/api/ai` endpoint protects the API key but does not verify caller identity. **Action:** Add Firebase ID-token verification (`firebase-admin`) to prevent unauthorized API consumption.
3. **Data Scaling:** The Notion-style `rows` for projects are stored inline on the `projects` document. **Action:** Migrate to a `projects/{id}/rows` subcollection if a project is expected to exceed Firestore's 1 MB document limit.

---

## 🏁 Getting Started

To pick up where development left off, follow these steps:

1. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) to deeply understand the data flow and UI conventions.
2. Read [docs/SETUP.md](docs/SETUP.md) and set up your local `.env.local` and Firebase emulators.
3. Run `npm install` and start the local development server with `npm run dev`.
4. Run `npm run lint` and `npx tsc --noEmit` before committing new code to ensure everything passes the strict TS/ESLint checks.
