// Shared domain types. The Firestore data model is documented in DATA-MODEL.md.

import type { Timestamp } from "firebase/firestore";

export type Role = "owner" | "admin" | "member";

// users/{uid} — public-ish profile shown across the app.
export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: Timestamp | null;
}

// members/{uid} — company membership + role. The real permission gate.
export interface Member {
  uid: string;
  role: Role;
  teamIds: string[];
  hasSeenWelcome?: boolean;
  createdAt: Timestamp | null;
}

// documents/{docId} — company guidelines, NDAs, etc.
export interface CompanyDocument {
  id: string; // "guidelines_employee" or "guidelines_intern"
  title: string;
  content: string; // Markdown or plain text content
  links: string[]; // external urls
  files: TaskFile[]; // attached files (using TaskFile interface)
  updatedAt: Timestamp | null;
}

// teams/{teamId} — a group inside the single company.
export interface Team {
  id: string;
  name: string;
  memberIds: string[];
  createdAt: Timestamp | null;
}

// ---------------------------------------------------------------------------
// Workspace content (Notion-style)
// ---------------------------------------------------------------------------
// Phase 1 ships an opinionated Projects tracker. The shapes below are designed
// so the generic "databases with custom properties" engine (Phase 2) can grow
// on top of them without a rewrite.

// projects/{projectId} — a tracked project (one "row" in the Projects database).
export type ProjectStatus =
  | "backlog"
  | "planned"
  | "in_progress"
  | "in_review"
  | "done"
  | "archived";

export type ProjectPriority = "low" | "medium" | "high" | "urgent";

export interface Project {
  id: string;
  title: string;
  description: string; // free-form notes / page body (plain text for now)
  status: ProjectStatus;
  priority: ProjectPriority;
  assigneeUid: string | null; // members/{uid} — legacy, superseded by developerIds
  teamId: string | null; // teams/{teamId}
  dueDate: Timestamp | null;
  order: number; // manual sort within a status column (board view)
  // Developers assigned to the WHOLE project (references developers/{id}). Start
  // with one; add or remove people as the team changes (e.g. someone leaves).
  developerIds: string[];
  // Custom roles per developer for this specific project (e.g. { devId: "Project Lead" })
  projectRoles?: Record<string, string>;
  // Notion-style database: customizable columns + rows (see below).
  columns: DbColumn[];
  rows: DbRow[];
  // Legacy fixed task list (pre-database). Auto-migrated into columns/rows when
  // a project is opened. Kept optional so old documents still load.
  tasks?: TaskItem[];
  financeFiles?: TaskFile[]; // attached service agreements/docs
  createdBy: string; // uid of creator
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

// A row in a project's task table. Stored as an array on the project document
// (no separate collection — keeps it within the existing Firestore rules). Fine
// for up to a few hundred tasks per project.
export type TaskStatus = "todo" | "in_progress" | "done" | "blocked";

export interface TaskItem {
  id: string;
  task: string; // what needs doing
  phase: string; // grouping, e.g. "1.1 Project Kickoff & Asset Collection"
  week: string; // e.g. "Week 1"
  status: TaskStatus;
  order: number; // sort order within the project
}

// developers/{id} — an EMPLOYEE record (collection name kept as "developers" for
// backwards-compat). Distinct from `members` (auth accounts): an employee is
// created by an admin and linked to a login by matching `email` on first sign-in.
export type Department = "web" | "ai" | "app" | "custom";
export type EmploymentType = "full_time" | "part_time" | "contract" | "intern";
export type EmployeeStatus = "active" | "on_leave" | "terminated" | "offboarded";
// App-level access (UI gate). "intern" gets the same restricted scope as
// "employee" but lands on its own My Space screen (/intern).
export type AccessLevel = "admin" | "employee" | "intern";

// The resolved role of the signed-in user (see useAuth().role). Unlike
// AccessLevel (a field on the employee record), this also accounts for member
// roles and the owner fallback, so it's what UI/routing decisions key off.
export type AppRole = "admin" | "employee" | "intern";

// Where each role lands after sign-in (and when kicked off a page they can't
// access). Employees keep the role-filtered dashboard until their dedicated
// "My Workflow" screen ships.
export const ROLE_HOME: Record<AppRole, string> = {
  admin: "/dashboard",
  employee: "/dashboard",
  intern: "/intern",
};

export interface Developer {
  id: string;
  name: string;
  email: string; // used to link to the Google sign-in account
  jobTitle?: string; // what they actually do (e.g. "Full stack Developer")
  role?: string; // management role (e.g. "Lead", "Manager") - making it optional as requested
  department: Department;
  customDepartment?: string; // Name if department === "custom"
  employmentType: EmploymentType;
  startDate: string | null; // ISO yyyy-mm-dd
  status: EmployeeStatus;
  accessLevel: AccessLevel; // "admin" can manage; "employee" gets a restricted view
  uid: string | null; // bound on first matching sign-in
  monthlySalary?: number; // base monthly salary
  officeHours?: number; // expected weekly office hours
  flexibilityHours?: number; // weekly flexibility time allowed
  createdAt: Timestamp | null;
}

// Alias so new code can use the clearer name while storage stays "developers".
export type Employee = Developer;

export const DEPARTMENTS: { value: Department; label: string }[] = [
  { value: "web", label: "Web" },
  { value: "ai", label: "AI" },
  { value: "app", label: "App" },
  { value: "custom", label: "Custom" },
];

export const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "intern", label: "Intern" },
];

export const EMPLOYEE_STATUSES: { value: EmployeeStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "on_leave", label: "On Leave" },
  { value: "terminated", label: "Terminated" },
  { value: "offboarded", label: "Offboarded" },
];

export const ACCESS_LEVELS: { value: AccessLevel; label: string }[] = [
  { value: "employee", label: "Employee" },
  { value: "intern", label: "Intern" },
  { value: "admin", label: "Admin" },
];

// ---------------------------------------------------------------------------
// Daily tasks assigned to employees (tasks/{id})
// ---------------------------------------------------------------------------
export type DailyTaskStatus = "todo" | "in_progress" | "done" | "not_completed";

export interface TaskFile {
  name: string;
  url: string; // Firebase Storage download URL
}

export interface TaskReport {
  id?: string;
  type?: "report" | "review"; // user submits report, admin submits review
  text: string;
  links: string[];
  files: TaskFile[];
  createdAt?: string; // ISO yyyy-mm-ddThh:mm:ss
  createdBy?: string; // UID of user who submitted
  createdByName?: string; // Name of user
}

export interface DailyTask {
  id: string;
  title: string;
  description: string;
  projectId: string | null;
  projectTitle: string | null; // denormalized for display
  assigneeId: string; // employee id (developers/{id})
  assigneeName: string; // denormalized
  date: string; // ISO yyyy-mm-dd (the day it's due/for)
  status: DailyTaskStatus;
  report: TaskReport; // legacy fallback
  reports?: TaskReport[]; // ordered history of reports/reviews
  assignedHours?: number; // specific number of hours assigned
  isOvertime?: boolean; // toggle to mark as overtime
  compensatesWeeklyHours?: boolean; // if true, these hours count towards weekly total instead of extra pay
  overtimeCost?: number; // computed overtime cost
  attachments?: TaskFile[]; // admin attached docs
  createdBy: string; // uid of the admin who assigned it
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export const DAILY_TASK_STATUSES: { value: DailyTaskStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Completed" },
  { value: "not_completed", label: "Not Completed Yet" },
];

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "blocked", label: "Blocked" },
];

// ---------------------------------------------------------------------------
// Notion-style database (flexible columns + rows), stored on the project doc.
// ---------------------------------------------------------------------------

export type ColumnType =
  | "text"
  | "number"
  | "select"
  | "multi_select"
  | "status"
  | "date"
  | "url"
  | "email"
  | "phone"
  | "checkbox";

export type OptionColor =
  | "gray"
  | "blue"
  | "green"
  | "yellow"
  | "orange"
  | "red"
  | "purple"
  | "pink";

export interface SelectOption {
  id: string;
  label: string;
  color: OptionColor;
}

export interface DbColumn {
  id: string;
  name: string;
  type: ColumnType;
  options?: SelectOption[]; // for select/status
}

// A cell value is keyed by column id. Strings cover text/select/status/date/
// url/email/phone, numbers cover number, booleans cover checkbox, and string[]
// covers multi-select (a list of option ids).
export type CellValue = string | number | boolean | string[] | null;

export interface DbRow {
  id: string;
  order: number;
  cells: Record<string, CellValue>;
}

export const OPTION_COLOR_CYCLE: OptionColor[] = [
  "blue",
  "green",
  "yellow",
  "orange",
  "red",
  "purple",
  "pink",
  "gray",
];

// Fields a client supplies when creating a project. Server-managed fields
// (id, order, createdBy, timestamps) are filled in by the data layer.
export type NewProject = Pick<Project, "title"> &
  Partial<
    Pick<
      Project,
      "description" | "status" | "priority" | "assigneeUid" | "teamId" | "dueDate"
    >
  >;

// Display metadata for statuses/priorities lives next to the types so the UI
// and (later) automations share one source of truth.
export const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "in_review", label: "In Review" },
  { value: "done", label: "Done" },
  { value: "archived", label: "Archived" },
];

export const PROJECT_PRIORITIES: { value: ProjectPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

// ---------------------------------------------------------------------------
// Office Settings (settings/office)
// ---------------------------------------------------------------------------
export interface OfficeSettings {
  startHour: number; // e.g. 10
  startMinute: number; // e.g. 0
  endHour: number; // e.g. 18
  endMinute: number; // e.g. 0
  graceMinutes: number; // e.g. 60 — clock-in within this window is still "on time"
  lateThresholdDays: number; // e.g. 3 — after this many late days, deduction kicks in
  employeeLeavesPerMonth: number; // e.g. 2
  internLeavesPerMonth: number; // e.g. 1
}

export const DEFAULT_OFFICE_SETTINGS: OfficeSettings = {
  startHour: 10,
  startMinute: 0,
  endHour: 18,
  endMinute: 0,
  graceMinutes: 60,
  lateThresholdDays: 3,
  employeeLeavesPerMonth: 2,
  internLeavesPerMonth: 1,
};

// ---------------------------------------------------------------------------
// Attendance (attendance/{recordId})
// ---------------------------------------------------------------------------
export type AttendanceStatus =
  | "present"
  | "absent"
  | "late"
  | "on_leave"
  | "sick_leave";

export const ATTENDANCE_STATUSES: { value: AttendanceStatus; label: string }[] =
  [
    { value: "present", label: "Present" },
    { value: "absent", label: "Absent" },
    { value: "late", label: "Late" },
    { value: "on_leave", label: "On Leave" },
    { value: "sick_leave", label: "Sick Leave" },
  ];

export interface AttendanceRecord {
  id: string;
  uid: string; // the employee's auth uid
  employeeName: string; // denormalised for easy display
  date: string; // ISO yyyy-mm-dd
  checkIn: string | null; // ISO datetime string
  checkOut: string | null; // ISO datetime string
  status: AttendanceStatus;
  hoursWorked: number; // auto-calculated from check-in/out
  isLate: boolean; // true if checked in after grace period
  flexibilityUsed?: number; // minutes of flexibility used today
  isOvertime: boolean; // true if checked out after office end time
  overtimeMinutes: number; // extra minutes past office end time
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

// ---------------------------------------------------------------------------
// Leave Requests (leaveRequests/{id})
// ---------------------------------------------------------------------------
export type LeaveRequestStatus = "pending" | "approved" | "rejected";

export interface LeaveRequest {
  id: string;
  uid: string; // auth uid of the requester
  employeeName: string; // denormalised name
  dates: string[]; // array of ISO yyyy-mm-dd dates requested
  reason: string;
  proofUrls: string[]; // urls of uploaded documents
  status: LeaveRequestStatus;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

// ---------------------------------------------------------------------------
// Attendance helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------
export interface Announcement {
  id: string;
  title: string;
  description: string;
  expiryDate: string | null;
  createdAt: Timestamp | null;
  createdBy: string;
}

