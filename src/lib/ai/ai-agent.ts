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
import { STATUS_OPTIONS } from "@/lib/firebase/db";

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

const SYSTEM_TABLE_IMPORT = `You are an AI that converts unstructured documents and a user's instructions into a structured project table.
The user is providing a document (like a Work Breakdown Structure) and a prompt.
You must parse this document and output a structured table of columns and rows.

Return ONLY a single valid JSON object — no markdown fences, no commentary — with this EXACT shape:
{
  "columns": [
    {"name": "Task Name", "type": "text"},
    {"name": "Status", "type": "status"},
    {"name": "Phase", "type": "select", "options": ["Discovery", "Design"]}
  ],
  "rows": [
    {"Task Name": "Do something", "Status": "todo", "Phase": "Design"}
  ]
}

Rules:
1. ALWAYS include a column with name "Status" and type "status".
2. If a column type is "select", you MUST provide an "options" array of strings.
3. Map the data from the document into the "rows" array. The keys in the row must EXACTLY match the column names.
4. Keep the text concise and actionable.
5. Output ONLY the JSON object, do NOT wrap it in \`\`\`json blocks.`;

export async function generateTableImport(
  documentText: string,
  prompt: string,
  modelId: string,
  opts: { onProgress?: (delta: string) => void; signal?: AbortSignal } = {},
): Promise<{ columns: DbColumn[]; rows: DbRow[] }> {
  const content = `User Prompt: ${prompt}\n\nDocument Context:\n${documentText}`;
  
  const raw = await streamCompletion(
    modelId,
    [
      { role: "system", content: SYSTEM_TABLE_IMPORT },
      { role: "user", content },
    ],
    { onText: opts.onProgress, signal: opts.signal },
  );

  let parsed: any;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    throw new Error("Couldn't read the generated table schema. Try again.");
  }

  const rawColumns = Array.isArray(parsed.columns) ? parsed.columns : [];
  const rawRows = Array.isArray(parsed.rows) ? parsed.rows : [];

  if (rawColumns.length === 0) {
    throw new Error("The AI returned no columns.");
  }

  const columns: DbColumn[] = [];
  const colNameMap = new Map<string, DbColumn>();
  const optionMap = new Map<string, Map<string, string>>(); // colId -> label -> optionId

  for (const c of rawColumns) {
    const colId = uuid();
    const type = c.type === "status" ? "status" : c.type === "select" ? "select" : "text";
    
    const newCol: DbColumn = {
      id: colId,
      name: String(c.name).trim() || "Column",
      type,
      width: 200,
    };

    if (type === "select" && Array.isArray(c.options)) {
      const options = c.options.map((opt: string, i: number) => ({
        id: uuid(),
        label: String(opt).trim(),
        color: OPTION_COLOR_CYCLE[i % OPTION_COLOR_CYCLE.length],
      }));
      newCol.options = options;
      
      const lblMap = new Map<string, string>();
      options.forEach(o => lblMap.set(o.label, o.id));
      optionMap.set(colId, lblMap);
    } else if (type === "status") {
       newCol.options = [...STATUS_OPTIONS];
    }

    columns.push(newCol);
    colNameMap.set(c.name, newCol);
  }

  // Ensure status column exists
  if (!columns.some(c => c.type === "status")) {
    const statusCol: DbColumn = { id: uuid(), name: "Status", type: "status", width: 140, options: [...STATUS_OPTIONS] };
    columns.push(statusCol);
    colNameMap.set("Status", statusCol);
  }

  const rows: DbRow[] = rawRows.map((r, i) => {
    const cells: Record<string, any> = {};
    for (const colName of Object.keys(r)) {
      const col = colNameMap.get(colName);
      if (!col) continue;
      
      const val = String(r[colName] || "").trim();
      
      if (col.type === "select") {
        const lblMap = optionMap.get(col.id);
        cells[col.id] = lblMap?.get(val) || null;
      } else if (col.type === "status") {
        cells[col.id] = val.toLowerCase() === "done" ? "done" : "todo";
      } else {
        cells[col.id] = val;
      }
    }
    
    // Fallback status if missing
    const statusCol = columns.find(c => c.type === "status");
    if (statusCol && !cells[statusCol.id]) {
      cells[statusCol.id] = "todo";
    }

    return {
      id: uuid(),
      order: i,
      cells,
    };
  });

  return { columns, rows };
}

