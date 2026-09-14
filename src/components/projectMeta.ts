
import { alpha, darken, lighten, type Theme } from "@mui/material/styles";
import type {
  DailyTaskStatus,
  EmployeeStatus,
  ProjectPriority,
  ProjectStatus,
} from "@/lib/data/types";
import {
  dailyTaskStatus,
  employeeStatus,
  projectPriority,
  projectStatus,
} from "@/lib/theme/colors";

export const STATUS_META: Record<ProjectStatus, { label: string; color: string }> =
  {
    backlog: { label: "Backlog", color: projectStatus.backlog },
    planned: { label: "Planned", color: projectStatus.planned },
    in_progress: { label: "In Progress", color: projectStatus.in_progress },
    in_review: { label: "In Review", color: projectStatus.in_review },
    done: { label: "Done", color: projectStatus.done },
    archived: { label: "Archived", color: projectStatus.archived },
  };

export const PRIORITY_META: Record<
  ProjectPriority,
  { label: string; color: string }
> = {
  low: { label: "Low", color: projectPriority.low },
  medium: { label: "Medium", color: projectPriority.medium },
  high: { label: "High", color: projectPriority.high },
  urgent: { label: "Urgent", color: projectPriority.urgent },
};

export const TASK_STATUS_COLORS: Record<DailyTaskStatus, string> =
  dailyTaskStatus;

export const EMPLOYEE_STATUS_COLORS: Record<EmployeeStatus, string> =
  employeeStatus;

export function chipSx(color: string) {
  return (theme: Theme) => ({
    bgcolor: alpha(color, 0.16),
    color: darken(color, 0.35),
    fontWeight: 500,
    ...theme.applyStyles("dark", {
      bgcolor: alpha(color, 0.22),
      color: lighten(color, 0.45),
    }),
  });
}

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
