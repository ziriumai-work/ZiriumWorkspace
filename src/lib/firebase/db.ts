// Helpers for the Notion-style project database (columns + rows).

import {
  OPTION_COLOR_CYCLE,
  type DbColumn,
  type DbRow,
  type SelectOption,
  type TaskItem,
} from "@/lib/data/types";

const uuid = () => crypto.randomUUID();

// Default status options used by the "status" column type.
export const STATUS_OPTIONS: SelectOption[] = [
  { id: "todo", label: "To Do", color: "gray" },
  { id: "in_progress", label: "In Progress", color: "yellow" },
  { id: "done", label: "Done", color: "green" },
  { id: "blocked", label: "Blocked", color: "red" },
];

// The columns every new project starts with. Stable ids ("name", "phase", ...)
// let the seed and the legacy-task migration map onto them reliably.
export function defaultColumns(): DbColumn[] {
  return [
    { id: "name", name: "Name", type: "text" },
    { id: "phase", name: "Phase", type: "text" },
    { id: "week", name: "Week", type: "select", options: [] },
    { id: "status", name: "Status", type: "status", options: [...STATUS_OPTIONS] },
  ];
}

// Convert a legacy fixed task list into the columns/rows database model. Used
// once when an older project (with `tasks`) is first opened.
export function migrateTasksToDb(tasks: TaskItem[]): {
  columns: DbColumn[];
  rows: DbRow[];
} {
  const columns = defaultColumns();
  const weekCol = columns.find((c) => c.id === "week")!;

  const weekLabels: string[] = [];
  for (const t of tasks) if (!weekLabels.includes(t.week)) weekLabels.push(t.week);
  const weekOptions: SelectOption[] = weekLabels.map((label, i) => ({
    id: uuid(),
    label,
    color: OPTION_COLOR_CYCLE[i % OPTION_COLOR_CYCLE.length],
  }));
  weekCol.options = weekOptions;
  const weekIdByLabel = new Map(weekOptions.map((o) => [o.label, o.id]));

  const rows: DbRow[] = [...tasks]
    .sort((a, b) => a.order - b.order)
    .map((t, i) => ({
      id: uuid(),
      order: i,
      cells: {
        name: t.task,
        phase: t.phase,
        week: weekIdByLabel.get(t.week) ?? null,
        status: t.status,
      },
    }));

  return { columns, rows };
}
