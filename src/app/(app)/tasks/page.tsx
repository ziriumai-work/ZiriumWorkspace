"use client";

// Tasks. Admins assign dated tasks to employees and see everything; employees
// see only their own tasks and submit a report (text + links + files) per task.

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import {
  subscribeToAllTasks,
  subscribeToTasksForEmployee,
  createTask,
  updateTask,
  deleteTask,
} from "@/lib/data/tasks";
import { subscribeToDevelopers } from "@/lib/data/developers";
import { subscribeToProjects } from "@/lib/data/projects";
import { TaskReportEditor } from "@/components/tasks/TaskReportEditor";
import {
  DAILY_TASK_STATUSES,
  type DailyTask,
  type DailyTaskStatus,
  type Employee,
  type Project,
  type TaskReport,
} from "@/lib/data/types";

const STATUS_BADGE: Record<DailyTaskStatus, string> = {
  todo: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  in_progress:
    "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  done: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function TasksPage() {
  const { user, employee, isAdmin } = useAuth();
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to the right task set for the role.
  useEffect(() => {
    if (isAdmin) {
      return subscribeToAllTasks(
        (t) => {
          setTasks(t);
          setLoading(false);
        },
        () => setLoading(false),
      );
    }
    if (employee) {
      return subscribeToTasksForEmployee(
        employee.id,
        (t) => {
          setTasks(t);
          setLoading(false);
        },
        () => setLoading(false),
      );
    }
    // Neither resolved yet — stay in the loading state until a role is known.
  }, [isAdmin, employee]);

  // Admin needs employees (assignee picker) and projects (optional link).
  useEffect(() => {
    if (!isAdmin) return;
    const u1 = subscribeToDevelopers(setEmployees);
    const u2 = subscribeToProjects(setProjects);
    return () => {
      u1();
      u2();
    };
  }, [isAdmin]);

  // Group tasks by date (already sorted newest-first).
  const groups = useMemo(() => {
    const out: { date: string; items: DailyTask[] }[] = [];
    for (const t of tasks) {
      const last = out[out.length - 1];
      if (last && last.date === t.date) last.items.push(t);
      else out.push({ date: t.date, items: [t] });
    }
    return out;
  }, [tasks]);

  return (
    <div className="mx-auto w-full max-w-4xl px-8 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isAdmin ? "Tasks" : "My Tasks"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {isAdmin
            ? "Assign daily tasks to employees and track their reports."
            : "Your assigned tasks. Update status and submit a report for each."}
        </p>
      </header>

      {isAdmin && (
        <AssignTaskForm
          employees={employees}
          projects={projects}
          onAssign={(input) => createTask(input, user?.uid ?? "")}
        />
      )}

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : groups.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
            {isAdmin
              ? "No tasks yet. Assign one above."
              : "You have no tasks yet."}
          </p>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <section key={g.date}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  {g.date}
                </h2>
                <div className="space-y-2">
                  {g.items.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      showAssignee={isAdmin}
                      canEdit={isAdmin || employee?.id === t.assigneeId}
                      canDelete={isAdmin}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AssignTaskForm({
  employees,
  projects,
  onAssign,
}: {
  employees: Employee[];
  projects: Project[];
  onAssign: (input: {
    title: string;
    description: string;
    assigneeId: string;
    assigneeName: string;
    projectId: string | null;
    projectTitle: string | null;
    date: string;
  }) => Promise<unknown>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function assign() {
    if (!title.trim() || !assigneeId) {
      setError("A title and an assignee are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const emp = employees.find((e) => e.id === assigneeId);
      const proj = projects.find((p) => p.id === projectId);
      await onAssign({
        title,
        description,
        assigneeId,
        assigneeName: emp?.name ?? "",
        projectId: proj?.id ?? null,
        projectTitle: proj?.title ?? null,
        date,
      });
      setTitle("");
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border p-4">
      <p className="mb-2 text-sm font-medium">Assign a task</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          className="rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent sm:col-span-2"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Details (optional)"
          rows={2}
          className="resize-y rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent sm:col-span-2"
        />
        <select
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          className="rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
        >
          <option value="">Assign to…</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
        >
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
        <button
          onClick={assign}
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Assigning…" : "Assign task"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function TaskCard({
  task,
  showAssignee,
  canEdit,
  canDelete,
}: {
  task: DailyTask;
  showAssignee: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hasReport =
    task.report.text || task.report.links.length || task.report.files.length;

  return (
    <div className="rounded-xl border border-border">
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{task.title}</p>
          {task.description && (
            <p className="mt-0.5 text-sm text-muted">{task.description}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
            {showAssignee && (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">
                {task.assigneeName || "Unassigned"}
              </span>
            )}
            {task.projectTitle && (
              <span className="rounded-full bg-surface px-2 py-0.5">
                {task.projectTitle}
              </span>
            )}
            <button
              onClick={() => setOpen((v) => !v)}
              className="hover:text-foreground"
            >
              {open ? "Hide report" : hasReport ? "View report" : "Add report"}
            </button>
          </div>
        </div>

        <select
          value={task.status}
          onChange={(e) =>
            updateTask(task.id, {
              status: e.target.value as DailyTaskStatus,
            })
          }
          disabled={!canEdit}
          className={`shrink-0 cursor-pointer rounded-full border-0 px-2 py-0.5 text-[11px] font-medium outline-none disabled:cursor-default ${STATUS_BADGE[task.status]}`}
        >
          {DAILY_TASK_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        {canDelete && (
          <button
            onClick={() => {
              if (confirm(`Delete task "${task.title}"?`)) deleteTask(task.id);
            }}
            className="shrink-0 text-xs text-muted transition hover:text-red-600"
            title="Delete task"
          >
            ✕
          </button>
        )}
      </div>

      {open && (
        <div className="border-t border-border px-4 py-3">
          <TaskReportEditor
            taskId={task.id}
            report={task.report}
            editable={canEdit}
            onSave={(report: TaskReport) => updateTask(task.id, { report })}
          />
        </div>
      )}
    </div>
  );
}
