// Shared display metadata (labels + Tailwind color classes) for project status
// and priority. Keeping this in one place means the dashboard, table, board,
// and detail views stay visually consistent.

import type { ProjectPriority, ProjectStatus } from "@/lib/types";

export const STATUS_META: Record<
  ProjectStatus,
  { label: string; dot: string; badge: string }
> = {
  backlog: {
    label: "Backlog",
    dot: "bg-neutral-400",
    badge: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  },
  planned: {
    label: "Planned",
    dot: "bg-blue-400",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  in_progress: {
    label: "In Progress",
    dot: "bg-amber-400",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  in_review: {
    label: "In Review",
    dot: "bg-purple-400",
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  },
  done: {
    label: "Done",
    dot: "bg-green-500",
    badge: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
  archived: {
    label: "Archived",
    dot: "bg-neutral-300",
    badge: "bg-neutral-100 text-neutral-400 dark:bg-neutral-900 dark:text-neutral-500",
  },
};

export const PRIORITY_META: Record<
  ProjectPriority,
  { label: string; badge: string }
> = {
  low: {
    label: "Low",
    badge: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
  },
  medium: {
    label: "Medium",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  },
  high: {
    label: "High",
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  },
  urgent: {
    label: "Urgent",
    badge: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
};

// Format a Firestore Timestamp-ish value to a short date, tolerating null.
export function formatDueDate(ts: { toDate: () => Date } | null): string {
  if (!ts) return "—";
  try {
    return ts.toDate().toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}
