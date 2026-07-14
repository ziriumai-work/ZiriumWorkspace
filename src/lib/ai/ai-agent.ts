// AI agent: turn a free-text project brief / timeline into a structured plan
// (title + description + task rows), matching the Task/Phase/Week/Status shape
// used everywhere else. Runs through DeepSeek via /api/ai and parses the JSON
// the model returns.

import { streamCompletion } from "@/lib/ai/ai-client";
import { defaultColumns } from "@/lib/firebase/db";
import {
  OPTION_COLOR_CYCLE,
  type DbColumn,
  type DbRow,
  type SelectOption,
} from "@/lib/data/types";

const uuid = () => crypto.randomUUID();

export interface GeneratedPlan {
  title: string;
  description: string;
  columns: DbColumn[];
  rows: DbRow[];
}

const SYSTEM = `You are a project-planning agent for a company workspace.
Convert the user's project brief or timeline into a structured delivery plan.

Return ONLY a single valid JSON object — no markdown fences, no commentary —
with this EXACT shape:
{"title": string, "description": string, "tasks": [{"task": string, "phase": string, "week": string}]}

Rules:
- Group tasks into phases, and group phases under weeks ("Week 1", "Week 2", ...).
- If the brief already has weeks/phases, preserve them faithfully.
- If it doesn't, infer a sensible weekly breakdown.
- "phase" is a short grouping label; you may prefix it with numbers like "1.1 Discovery".
- Keep each task concise and actionable.
- Output the JSON object only.`;

// Pull the JSON object out of the model's reply, tolerating code fences or
// stray text around it.
function extractJson(raw: string): string {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("The AI didn't return valid JSON. Try again.");
  }
  return s.slice(start, end + 1);
}

export async function generateProjectPlan(
  brief: string,
  modelId: string,
  opts: { onProgress?: (delta: string) => void; signal?: AbortSignal } = {},
): Promise<GeneratedPlan> {
  const raw = await streamCompletion(
    modelId,
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: brief },
    ],
    { onText: opts.onProgress, signal: opts.signal },
  );

  let parsed: {
    title?: unknown;
    description?: unknown;
    tasks?: unknown;
  };
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    throw new Error(
      "Couldn't read the generated plan. Try again, or simplify the brief.",
    );
  }

  const rawTasks = Array.isArray(parsed.tasks)
    ? (parsed.tasks as Record<string, unknown>[])
    : [];

  // Normalize the raw tasks.
  const norm = rawTasks
    .map((t) => ({
      task: String(t.task ?? "").trim(),
      phase: String(t.phase ?? "General").trim() || "General",
      week: String(t.week ?? "Week 1").trim() || "Week 1",
    }))
    .filter((t) => t.task.length > 0);

  if (norm.length === 0) {
    throw new Error("The AI returned no tasks. Try a more detailed brief.");
  }

  // Map into the Notion-style database: default columns + a Week option per
  // distinct week, every row starting as "todo".
  const columns = defaultColumns();
  const weekCol = columns.find((c) => c.id === "week")!;
  const weekLabels: string[] = [];
  for (const t of norm) if (!weekLabels.includes(t.week)) weekLabels.push(t.week);
  const weekOptions: SelectOption[] = weekLabels.map((label, i) => ({
    id: uuid(),
    label,
    color: OPTION_COLOR_CYCLE[i % OPTION_COLOR_CYCLE.length],
  }));
  weekCol.options = weekOptions;
  const weekIdByLabel = new Map(weekOptions.map((o) => [o.label, o.id]));

  const rows: DbRow[] = norm.map((t, i) => ({
    id: uuid(),
    order: i,
    cells: {
      name: t.task,
      phase: t.phase,
      week: weekIdByLabel.get(t.week) ?? null,
      status: "todo",
    },
  }));

  return {
    title: String(parsed.title ?? "").trim() || "Untitled project",
    description: String(parsed.description ?? "").trim(),
    columns,
    rows,
  };
}
