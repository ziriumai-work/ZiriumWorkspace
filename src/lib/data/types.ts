
import type { Timestamp } from "firebase/firestore";

export type Role = "owner" | "admin" | "member" | "employee" | "intern";

// Public user profile stored in users/{uid}.
export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: Timestamp | null;
}

// Company membership and role. Primary permission gate.
export interface Member {
  uid: string;
  role: Role;
  teamIds: string[];
  hasSeenWelcome?: boolean;
  subscribeToEmails?: boolean;
  email?: string;
  createdAt: Timestamp | null;
}

// Admin action audit log entry.
export interface AdminLog {
  id: string;
  adminId: string;
  adminName: string;
  adminPhotoUrl: string | null;
  action: string;
  details: string;
  timestamp: Timestamp | null;
}

// Company documents — guidelines, NDAs, etc.
export interface CompanyDocument {
  id: string; // "guidelines_employee" or "guidelines_intern"
  title: string;
  content: string; // Markdown or plain text content
  links: string[]; // external urls
  files: TaskFile[]; // attached files (using TaskFile interface)
  updatedAt: Timestamp | null;
}

// Team grouping within the company.
export interface Team {
  id: string;
  name: string;
  memberIds: string[];
  createdAt: Timestamp | null;
}

// Project tracker with Notion-style database support.
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
  assigneeUid: string | null; // legacy field, superseded by developerIds
  teamId: string | null;
  dueDate: Timestamp | null;
  order: number; // sort order within a status column
  developerIds: string[]; // employees assigned to the project
  projectRoles?: Record<string, string>; // per-developer role labels
  slackChannelId?: string;
  lastUpdatedBy?: { uid: string; name: string; avatar?: string | null };
  columns: DbColumn[];
  rows: DbRow[];
  tasks?: TaskItem[]; // legacy field; auto-migrated to columns/rows on open
  financeFiles?: TaskFile[]; // attached service agreements/docs
  createdBy: string; // uid of creator
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type TaskStatus = "todo" | "in_progress" | "done" | "blocked";

export interface TaskItem {
  id: string;
  task: string;
  phase: string;
  week: string;
  status: TaskStatus;
  order: number;
}

// Employee record stored under developers/{id} (collection name kept for backward compat).
// Linked to a Firebase Auth account by matching email on first sign-in.
export type Department = "web" | "ai" | "app" | "custom";
export type EmploymentType = "full_time" | "part_time" | "contract" | "intern";
export type EmployeeStatus = "active" | "on_leave" | "terminated" | "offboarded";
export type AccessLevel = "admin" | "employee" | "intern";

// Resolved app role used for UI/routing decisions (combines member role + employee access level).
export type AppRole = "admin" | "employee" | "intern";

// Default landing route per role after sign-in.
export const ROLE_HOME: Record<AppRole, string> = {
  admin: "/dashboard",
  employee: "/dashboard",
  intern: "/intern",
};

export interface Developer {
  id: string;
  name: string;
  email: string; // used to link to the Firebase Auth account
  jobTitle?: string;
  role?: string; // management/team role label
  department: Department;
  customDepartment?: string;
  employmentType: EmploymentType;
  startDate: string | null; // ISO yyyy-mm-dd
  endDate: string | null; // ISO yyyy-mm-dd
  status: EmployeeStatus;
  accessLevel: AccessLevel;
  uid: string | null; // bound on first sign-in
  photoURL?: string;
  monthlySalary?: number;
  officeHours?: number; // expected weekly hours
  flexibilityHours?: number; // weekly flex buffer in hours
  subscribeToEmails?: boolean; // opt-in for clock-in/out email alerts
  createdAt: Timestamp | null;
}

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

// Daily tasks assigned to employees, stored in tasks/{id}.
export type DailyTaskStatus = "todo" | "in_progress" | "done" | "not_completed";

export interface TaskFile {
  name: string;
  url: string;
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
  assigneeId: string;
  assigneeName: string; // denormalized
  date: string; // ISO yyyy-mm-dd
  status: DailyTaskStatus;
  report: TaskReport; // legacy single-report field
  reports?: TaskReport[];
  assignedHours?: number;
  isOvertime?: boolean;
  compensatesWeeklyHours?: boolean; // hours count toward weekly total (compensatory)
  resolvesODH?: boolean; // hours pay down ODH balance
  overtimeCost?: number;
  attachments?: TaskFile[];
  createdBy: string;
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

// Notion-style database columns/rows, stored on the project document.
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
  width?: number;
  options?: SelectOption[]; // for select/status
}

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

// Client-provided fields for project creation (server fills id, order, timestamps).
export type NewProject = Pick<Project, "title"> &
  Partial<
    Pick<
      Project,
      "description" | "status" | "priority" | "assigneeUid" | "teamId" | "dueDate"
    >
  >;
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

// Office hours, leave policy, and app URL stored in settings/office.
export interface OfficeSettings {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  graceMinutes: number; // minutes after start still counted as on-time
  lateThresholdDays: number; // late days before salary deduction kicks in
  employeeLeavesPerMonth: number;
  internLeavesPerMonth: number;
  appUrl?: string;
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
  appUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://zirium.vercel.app",
};

export type AttendanceStatus =
  | "present"
  | "absent"
  | "late"
  | "on_leave"
  | "sick_leave"
  | "clock_out";

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
  uid: string;
  employeeName: string; // denormalized for display
  date: string; // ISO yyyy-mm-dd
  checkIn: string | null;
  checkOut: string | null;
  status: AttendanceStatus;
  hoursWorked: number;
  isLate: boolean;
  flexibilityUsed?: number; // flex minutes consumed today
  isOvertime: boolean;
  overtimeMinutes: number;
  adminApprovedLeave?: boolean; // exempt from leave penalty when true
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type LeaveRequestStatus = "pending" | "approved" | "rejected";

export interface LeaveRequest {
  id: string;
  uid: string;
  employeeName: string; // denormalized
  dates: string[]; // ISO yyyy-mm-dd dates
  reason: string;
  proofUrls: string[];
  status: LeaveRequestStatus;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

// Announcements
export interface Announcement {
  id: string;
  title: string;
  description: string;
  expiryDate: string | null;
  createdAt: Timestamp | null;
  createdBy: string;
  showToEmployees?: boolean;
  showToInterns?: boolean;
}

export type SalaryStatus = "due" | "paid" | "fulfilled";

export interface SalaryLineItem {
  description: string;
  amount: number; // positive = addition, negative = deduction
  dateStr?: string;
}

export interface SalaryRecord {
  id: string;
  month: string; // "yyyy-MM"
  employeeId: string;
  employeeName: string;
  baseSalary: number;
  overtimeTotal: number;
  deductionsTotal: number;
  netSalary: number;
  lineItems: SalaryLineItem[];
  status: SalaryStatus;
  receiptUrl?: string | null;
  createdAt: Timestamp | import("firebase/firestore").FieldValue | null;
  paidAt: Timestamp | null;
  fulfilledAt: Timestamp | null;
}

export type PersonalTaskPriority = "High" | "Medium" | "Low";
export type PersonalTaskCategory = "Work" | "Meeting" | "Personal" | "Other";
export type PersonalTaskStatus = "pending" | "done" | "archived";

export interface PersonalTask {
  id: string;
  uid: string;
  title: string;
  description?: string;
  priority: PersonalTaskPriority;
  category: PersonalTaskCategory;
  status: PersonalTaskStatus;
  isRoutine: boolean;
  routineDays?: number[]; // 0 = Sunday … 6 = Saturday
  targetDate?: string; // ISO yyyy-mm-dd (one-time tasks)
  targetTime: string; // HH:mm
  notifyMinutesBefore: number;
  emailSent?: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}
