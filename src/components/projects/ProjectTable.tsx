"use client";

// Table view of the Projects database. Status and priority are editable inline
// via native selects (writes straight to Firestore). The title links to the
// project detail page.

import Link from "next/link";
import { updateProject, deleteProject } from "@/lib/projects";
import {
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  type Developer,
  type Project,
  type ProjectPriority,
  type ProjectStatus,
} from "@/lib/types";
import { PRIORITY_META, STATUS_META, formatDueDate } from "@/components/projectMeta";

export function ProjectTable({
  projects,
  developers,
}: {
  projects: Project[];
  developers: Record<string, Developer>;
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500 dark:border-neutral-800">
          <th className="px-8 py-2 font-medium">Title</th>
          <th className="px-3 py-2 font-medium">Status</th>
          <th className="px-3 py-2 font-medium">Priority</th>
          <th className="px-3 py-2 font-medium">Developers</th>
          <th className="px-3 py-2 font-medium">Due</th>
          <th className="px-3 py-2" />
        </tr>
      </thead>
      <tbody>
        {projects.map((p) => {
          const devs = p.developerIds
            .map((did) => developers[did])
            .filter(Boolean);
          return (
            <tr
              key={p.id}
              className="group border-b border-neutral-100 hover:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900/50"
            >
              <td className="px-8 py-2">
                <Link
                  href={`/projects/${p.id}`}
                  className="font-medium hover:underline"
                >
                  {p.title}
                </Link>
              </td>

              <td className="px-3 py-2">
                <select
                  value={p.status}
                  onChange={(e) =>
                    updateProject(p.id, {
                      status: e.target.value as ProjectStatus,
                    })
                  }
                  className={`cursor-pointer rounded-full border-0 px-2 py-0.5 text-[11px] font-medium outline-none ${STATUS_META[p.status].badge}`}
                >
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </td>

              <td className="px-3 py-2">
                <select
                  value={p.priority}
                  onChange={(e) =>
                    updateProject(p.id, {
                      priority: e.target.value as ProjectPriority,
                    })
                  }
                  className={`cursor-pointer rounded-full border-0 px-2 py-0.5 text-[11px] font-medium outline-none ${PRIORITY_META[p.priority].badge}`}
                >
                  {PROJECT_PRIORITIES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </td>

              <td className="px-3 py-2">
                {devs.length > 0 ? (
                  <div className="flex items-center gap-1">
                    <div className="flex -space-x-1.5">
                      {devs.slice(0, 3).map((d) => (
                        <span
                          key={d.id}
                          title={d.name}
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-background bg-accent-soft text-[10px] font-semibold text-accent"
                        >
                          {d.name.charAt(0).toUpperCase()}
                        </span>
                      ))}
                    </div>
                    <span className="ml-1 truncate text-xs text-neutral-600 dark:text-neutral-300">
                      {devs[0].name}
                      {devs.length > 1 ? ` +${devs.length - 1}` : ""}
                    </span>
                  </div>
                ) : (
                  <span className="text-neutral-400">—</span>
                )}
              </td>

              <td className="px-3 py-2 text-neutral-500">
                {formatDueDate(p.dueDate)}
              </td>

              <td className="px-3 py-2 text-right">
                <button
                  onClick={() => {
                    if (confirm(`Delete "${p.title}"?`)) deleteProject(p.id);
                  }}
                  className="rounded px-2 py-0.5 text-xs text-neutral-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950"
                >
                  Delete
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
