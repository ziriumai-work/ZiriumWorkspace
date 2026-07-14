"use client";

// AI Project Agent — paste a project brief or timeline, and the agent generates
// a full project with a Task/Phase/Week structure (the same shape as the MARK
// sample). Review the plan, then create it in one click.

import { useState } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { createProject } from "@/lib/data/projects";
import { generateProjectPlan, type GeneratedPlan } from "@/lib/ai/ai-agent";
import { AI_MODELS, DEFAULT_MODEL_ID, getModel } from "@/lib/ai/ai-models";

export function AiProjectAgent({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => void;
}) {
  const { user } = useAuth();
  const [brief, setBrief] = useState("");
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function generate() {
    const text = brief.trim();
    if (!text || generating) return;
    setGenerating(true);
    setError(null);
    setPlan(null);
    try {
      const result = await generateProjectPlan(text, modelId);
      setPlan(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  async function create() {
    if (!plan || !user) return;
    setCreating(true);
    setError(null);
    try {
      const id = await createProject(
        {
          title: plan.title,
          description: plan.description,
          status: "in_progress",
          priority: "medium",
        },
        user.uid,
        { columns: plan.columns, rows: plan.rows },
      );
      onCreated(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project.");
    } finally {
      setCreating(false);
    }
  }

  // Resolve a row's Week option id to its label, and summarize counts per week.
  const weekOptions = plan?.columns.find((c) => c.id === "week")?.options ?? [];
  const weekLabel = (rowWeek: unknown) =>
    weekOptions.find((o) => o.id === rowWeek)?.label ?? "";
  const weekSummary: { week: string; count: number }[] = [];
  if (plan) {
    for (const r of plan.rows) {
      const label = weekLabel(r.cells.week);
      const last = weekSummary[weekSummary.length - 1];
      if (last && last.week === label) last.count++;
      else weekSummary.push({ week: label, count: 1 });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-[8vh] backdrop-blur-sm animate-fade-in"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[84vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-pop-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <SparkIcon />
            <span className="text-sm font-semibold">AI Project Agent</span>
          </div>
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="rounded-lg border border-border bg-transparent px-2 py-1 text-xs font-medium outline-none"
          >
            {AI_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <label className="mb-1 block text-xs font-medium text-muted">
            Project brief or timeline
          </label>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={6}
            placeholder={
              "Paste a timeline, or describe the project. e.g.\n" +
              "\"Build a 4-week marketing site: week 1 design, week 2 build pages, week 3 CMS + blog, week 4 QA and launch.\""
            }
            className="w-full resize-y rounded-xl border border-border bg-transparent p-3 text-sm leading-relaxed outline-none focus:border-accent"
          />

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}

          {/* Preview */}
          {plan && (
            <div className="mt-4 rounded-xl border border-border">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold">{plan.title}</p>
                {plan.description && (
                  <p className="mt-1 text-xs text-muted">{plan.description}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                    {plan.rows.length} tasks
                  </span>
                  {weekSummary.map((w) => (
                    <span
                      key={w.week}
                      className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-muted"
                    >
                      {w.week}: {w.count}
                    </span>
                  ))}
                </div>
              </div>
              <ul className="max-h-52 divide-y divide-border overflow-y-auto">
                {plan.rows.map((r) => (
                  <li key={r.id} className="px-4 py-2 text-sm">
                    <span>{String(r.cells.name ?? "")}</span>
                    <span className="ml-2 text-[11px] text-muted">
                      · {String(r.cells.phase ?? "")} · {weekLabel(r.cells.week)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
          <span className="text-[11px] text-muted">
            {generating
              ? `Generating with ${getModel(modelId)?.label}…`
              : plan
                ? "Review the plan, then create the project."
                : "The agent will structure your brief into weeks & tasks."}
          </span>
          <div className="flex gap-2">
            {plan ? (
              <>
                <button
                  onClick={generate}
                  disabled={generating}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-surface disabled:opacity-50"
                >
                  Regenerate
                </button>
                <button
                  onClick={create}
                  disabled={creating}
                  className="rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {creating ? "Creating…" : "Create project"}
                </button>
              </>
            ) : (
              <button
                onClick={generate}
                disabled={generating || !brief.trim()}
                className="rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {generating ? "Generating…" : "Generate plan"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-accent">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
    </svg>
  );
}
