"use client";

// Project-level developer assignment. Assign one developer to the whole project
// to start; add more or remove someone if the team changes (e.g. a developer
// leaves mid-project and is replaced). The first in the list is the lead.
// People come from the shared roster (Team page).

import Link from "next/link";
import type { Developer } from "@/lib/types";

export function ProjectDevelopers({
  developerIds,
  roster,
  onChange,
  editable = true,
}: {
  developerIds: string[];
  roster: Developer[];
  onChange: (ids: string[]) => void;
  editable?: boolean;
}) {
  const byId = new Map(roster.map((d) => [d.id, d]));
  const assigned = developerIds
    .map((id) => byId.get(id))
    .filter((d): d is Developer => Boolean(d));
  const available = roster.filter((d) => !developerIds.includes(d.id));

  function add(id: string) {
    if (id && !developerIds.includes(id)) onChange([...developerIds, id]);
  }
  function remove(id: string) {
    onChange(developerIds.filter((x) => x !== id));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {assigned.length === 0 && (
        <span className="text-sm text-muted">No developer assigned yet.</span>
      )}

      {assigned.map((d, i) => (
        <span
          key={d.id}
          className="group flex items-center gap-1.5 rounded-full border border-border bg-surface py-1 pl-1 pr-2 text-sm"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
            {d.name.charAt(0).toUpperCase()}
          </span>
          <span className="font-medium">{d.name}</span>
          {i === 0 && (
            <span className="rounded bg-accent-soft px-1 py-0.5 text-[10px] font-medium text-accent">
              Lead
            </span>
          )}
          {d.role && <span className="text-xs text-muted">· {d.role}</span>}
          {editable && (
            <button
              onClick={() => remove(d.id)}
              className="ml-0.5 text-muted transition hover:text-red-600"
              title={`Remove ${d.name} from this project`}
            >
              ✕
            </button>
          )}
        </span>
      ))}

      {/* Add control */}
      {!editable ? null : roster.length === 0 ? (
        <Link
          href="/team"
          className="rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-surface"
        >
          + Add developers on the Team page
        </Link>
      ) : available.length > 0 ? (
        <select
          value=""
          onChange={(e) => add(e.target.value)}
          className="rounded-lg border border-dashed border-border bg-transparent px-2.5 py-1.5 text-xs font-medium text-muted outline-none transition hover:bg-surface"
        >
          <option value="">
            {assigned.length === 0 ? "+ Assign developer" : "+ Add developer"}
          </option>
          {available.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
              {d.role ? ` (${d.role})` : ""}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
