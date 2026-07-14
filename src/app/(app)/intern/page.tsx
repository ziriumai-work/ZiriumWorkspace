"use client";

// My Space — the intern home screen. Interns land here after sign-in and see
// only what concerns them: their profile, their department team, the projects
// they're assigned to, and their pending tasks for the week (with quick status
// updates; full reports live on /tasks). Data is the same role-scoped
// subscriptions the employee views use.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/auth-context";
import { subscribeToProjects } from "@/lib/data/projects";
import { subscribeToTasksForEmployee, updateTask } from "@/lib/data/tasks";
import { subscribeToDevelopers } from "@/lib/data/developers";
import { STATUS_META } from "@/components/projectMeta";
import {
  DAILY_TASK_STATUSES,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  type DailyTask,
  type DailyTaskStatus,
  type Employee,
  type Project,
} from "@/lib/data/types";

const TASK_BADGE: Record<DailyTaskStatus, string> = {
  todo: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  in_progress:
    "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  done: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function InternPage() {
  const { user, employee } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [directory, setDirectory] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employee) return;
    const u1 = subscribeToProjects(setProjects);
    const u2 = subscribeToTasksForEmployee(employee.id, (t) => {
      setTasks(t);
      setLoading(false);
    });
    const u3 = subscribeToDevelopers(setDirectory);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [employee]);

  const myProjects = useMemo(
    () =>
      employee
        ? projects.filter((p) => p.developerIds.includes(employee.id))
        : [],
    [projects, employee],
  );

  const team = useMemo(
    () =>
      employee
        ? directory.filter(
            (e) => e.department === employee.department && e.status === "active",
          )
        : [],
    [directory, employee],
  );

  const today = todayIso();
  const weekAgo = isoDaysAgo(7);

  const pending = useMemo(
    () =>
      [...tasks]
        .filter((t) => t.status !== "done")
        .sort((a, b) => a.date.localeCompare(b.date)),
    [tasks],
  );
  const dueToday = pending.filter((t) => t.date === today).length;
  const doneThisWeek = tasks.filter(
    (t) => t.status === "done" && t.date >= weekAgo,
  ).length;
  const activeProjects = myProjects.filter(
    (p) => p.status !== "done" && p.status !== "archived",
  ).length;

  const firstName = (user?.displayName ?? employee?.name ?? "there").split(
    " ",
  )[0];
  const deptLabel = employee
    ? (DEPARTMENTS.find((d) => d.value === employee.department)?.label ??
      employee.department)
    : "";

  if (!employee) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted">Loading…</p>
      </main>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-10">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome, {firstName}
          </h1>
          <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent">
            Intern
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">
          {employee.role || "Intern"} · {deptLabel} team ·{" "}
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Due today" value={dueToday} accent={dueToday > 0} />
        <Stat label="Pending tasks" value={pending.length} />
        <Stat label="Active projects" value={activeProjects} />
        <Stat label="Done this week" value={doneThisWeek} />
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-8 lg:col-span-2">
          {/* This week's tasks */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                My pending tasks
              </h2>
              <Link
                href="/tasks"
                className="text-xs text-muted hover:text-foreground"
              >
                Open My Tasks →
              </Link>
            </div>

            {loading ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : pending.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted">
                  All caught up — no pending tasks. 🎉
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {pending.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-start gap-3 rounded-xl border border-border px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{t.title}</p>
                      {t.description && (
                        <p className="mt-0.5 truncate text-sm text-muted">
                          {t.description}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                        {t.date < today ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                            Overdue · {t.date}
                          </span>
                        ) : t.date === today ? (
                          <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">
                            Today
                          </span>
                        ) : (
                          <span className="rounded-full bg-surface px-2 py-0.5">
                            {t.date}
                          </span>
                        )}
                        {t.projectTitle && (
                          <span className="rounded-full bg-surface px-2 py-0.5">
                            {t.projectTitle}
                          </span>
                        )}
                        <Link href="/tasks" className="hover:text-foreground">
                          Submit report
                        </Link>
                      </div>
                    </div>

                    <select
                      value={t.status}
                      onChange={(e) =>
                        updateTask(t.id, {
                          status: e.target.value as DailyTaskStatus,
                        })
                      }
                      className={`shrink-0 cursor-pointer rounded-full border-0 px-2 py-0.5 text-[11px] font-medium outline-none ${TASK_BADGE[t.status]}`}
                    >
                      {DAILY_TASK_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* My projects */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                My projects
              </h2>
              <Link
                href="/projects"
                className="text-xs text-muted hover:text-foreground"
              >
                View all →
              </Link>
            </div>

            {myProjects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted">
                  You haven’t been assigned to a project yet.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {myProjects.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface"
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${STATUS_META[p.status].dot}`}
                      />
                      <span className="flex-1 truncate text-sm">{p.title}</span>
                      {p.developerIds[0] === employee.id && (
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                          Lead
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_META[p.status].badge}`}
                      >
                        {STATUS_META[p.status].label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Side column */}
        <div className="space-y-6">
          {/* Profile */}
          <section className="rounded-xl border border-border p-4">
            <h2 className="mb-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              My profile
            </h2>
            <div className="flex items-center gap-3">
              {user?.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.photoURL}
                  alt=""
                  className="h-10 w-10 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                  {employee.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{employee.name}</p>
                <p className="truncate text-xs text-muted">{employee.email}</p>
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <ProfileRow label="Title" value={employee.role || "—"} />
              <ProfileRow label="Department" value={deptLabel} />
              <ProfileRow
                label="Type"
                value={
                  EMPLOYMENT_TYPES.find(
                    (t) => t.value === employee.employmentType,
                  )?.label ?? "—"
                }
              />
              <ProfileRow label="Started" value={employee.startDate || "—"} />
            </dl>
          </section>

          {/* Team */}
          <section className="rounded-xl border border-border p-4">
            <h2 className="mb-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {deptLabel} team
            </h2>
            {team.length === 0 ? (
              <p className="text-sm text-muted">No teammates yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {team.map((m) => (
                  <li key={m.id} className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                      {m.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        {m.name}
                        {m.id === employee.id && (
                          <span className="text-muted"> (you)</span>
                        )}
                      </p>
                      <p className="truncate text-[11px] text-muted">
                        {m.role || "—"}
                      </p>
                    </div>
                    {m.accessLevel === "admin" && (
                      <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-muted">
                        Admin
                      </span>
                    )}
                    {m.accessLevel === "intern" && m.id !== employee.id && (
                      <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-muted">
                        Intern
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          accent ? "text-accent" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs text-muted">{label}</dt>
      <dd className="truncate text-right">{value}</dd>
    </div>
  );
}
