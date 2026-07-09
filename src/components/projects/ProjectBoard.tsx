"use client";

// Board (Kanban) view: one column per status, cards grouped by status. Dragging
// a card to another column updates its status in Firestore (native HTML5 drag
// and drop — no extra dependency).

import { useState } from "react";
import Link from "next/link";
import { updateProject } from "@/lib/projects";
import {
  PROJECT_STATUSES,
  type Developer,
  type Project,
  type ProjectStatus,
} from "@/lib/types";
import { PRIORITY_META, STATUS_META, formatDueDate } from "@/components/projectMeta";

export function ProjectBoard({
  projects,
  developers,
}: {
  projects: Project[];
  developers: Record<string, Developer>;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<ProjectStatus | null>(null);

  function onDrop(status: ProjectStatus) {
    if (draggingId) {
      const p = projects.find((x) => x.id === draggingId);
      if (p && p.status !== status) updateProject(draggingId, { status });
    }
    setDraggingId(null);
    setOverStatus(null);
  }

  return (
    <div className="flex h-full gap-3 overflow-x-auto px-8 py-4">
      {PROJECT_STATUSES.map((col) => {
        const cards = projects.filter((p) => p.status === col.value);
        return (
          <div
            key={col.value}
            onDragOver={(e) => {
              e.preventDefault();
              setOverStatus(col.value);
            }}
            onDrop={() => onDrop(col.value)}
            className={`flex w-64 shrink-0 flex-col rounded-xl border p-2 transition ${
              overStatus === col.value
                ? "border-neutral-400 bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900"
                : "border-neutral-200 dark:border-neutral-800"
            }`}
          >
            <div className="mb-2 flex items-center gap-1.5 px-1.5">
              <span className={`h-2 w-2 rounded-full ${STATUS_META[col.value].dot}`} />
              <span className="text-xs font-medium">{col.label}</span>
              <span className="text-xs text-neutral-400">{cards.length}</span>
            </div>

            <div className="flex flex-col gap-2">
              {cards.map((p) => {
                const devs = p.developerIds
                  .map((did) => developers[did])
                  .filter(Boolean);
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    draggable
                    onDragStart={() => setDraggingId(p.id)}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setOverStatus(null);
                    }}
                    className={`block cursor-grab rounded-lg border border-neutral-200 bg-white p-2.5 shadow-sm transition hover:border-neutral-300 active:cursor-grabbing dark:border-neutral-800 dark:bg-neutral-950 ${
                      draggingId === p.id ? "opacity-50" : ""
                    }`}
                  >
                    <p className="text-sm font-medium">{p.title}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${PRIORITY_META[p.priority].badge}`}
                      >
                        {PRIORITY_META[p.priority].label}
                      </span>
                      <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                        <span>{formatDueDate(p.dueDate)}</span>
                        <div className="flex -space-x-1.5">
                          {devs.slice(0, 3).map((d) => (
                            <span
                              key={d.id}
                              title={d.name}
                              className="flex h-4 w-4 items-center justify-center rounded-full border border-background bg-accent-soft text-[8px] font-semibold text-accent"
                            >
                              {d.name.charAt(0).toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
