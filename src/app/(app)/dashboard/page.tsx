"use client";

// Dashboard: a live overview of the workspace. Phase 1 shows project counts by
// status plus the most recently updated projects. As more databases and
// automations land, this becomes the home for cross-workspace summaries.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { subscribeToProjects } from "@/lib/projects";
import { PROJECT_STATUSES, type Project } from "@/lib/types";
import { STATUS_META } from "@/components/projectMeta";
import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
  const { user, employee, isAdmin } = useAuth();
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToProjects(
      (p) => {
        setAllProjects(p);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  // Admins see all projects; employees only their assigned ones.
  const projects = useMemo(() => {
    if (isAdmin) return allProjects;
    if (!employee) return [];
    return allProjects.filter((p) => p.developerIds.includes(employee.id));
  }, [allProjects, isAdmin, employee]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of projects) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [projects]);

  const active = projects.filter(
    (p) => p.status !== "done" && p.status !== "archived",
  ).length;

  const recent = projects.slice(0, 6);
  const firstName = (user?.displayName ?? "there").split(" ")[0];

  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {firstName}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {active} active {active === 1 ? "project" : "projects"} across the
          workspace.
        </p>
      </header>

      {/* Status summary cards */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {PROJECT_STATUSES.map((s) => (
          <div
            key={s.value}
            className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
          >
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${STATUS_META[s.value].dot}`}
              />
              <span className="text-xs text-neutral-500">{s.label}</span>
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {counts[s.value] ?? 0}
            </p>
          </div>
        ))}
      </section>

      {/* Recently updated */}
      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Recently updated
          </h2>
          <Link
            href="/projects"
            className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
          >
            View all →
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : recent.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
            <p className="text-sm text-neutral-500">No projects yet.</p>
            <Link
              href="/projects"
              className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline"
            >
              Create your first project
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {recent.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-neutral-50 dark:hover:bg-neutral-900"
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${STATUS_META[p.status].dot}`}
                  />
                  <span className="flex-1 truncate text-sm">{p.title}</span>
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
  );
}
