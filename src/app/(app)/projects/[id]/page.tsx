"use client";

// Project detail page — the "open as page" experience. Title, properties, and
// notes are all editable and persist to Firestore. In v16 the route `params`
// arrive as a Promise, so we unwrap them with React's `use()`.

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Timestamp } from "firebase/firestore";
import {
  subscribeToProject,
  updateProject,
  deleteProject,
} from "@/lib/projects";
import { subscribeToDevelopers } from "@/lib/developers";
import { migrateTasksToDb } from "@/lib/db";
import { useAi } from "@/components/ai/AiProvider";
import { useAuth } from "@/lib/auth-context";
import { NotionTable } from "@/components/projects/NotionTable";
import { ProjectDevelopers } from "@/components/projects/ProjectDevelopers";
import type { Developer } from "@/lib/types";
import {
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  type Project,
  type ProjectPriority,
  type ProjectStatus,
} from "@/lib/types";

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { openAi } = useAi();
  const { isAdmin, employee } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [loading, setLoading] = useState(true);

  // Local draft state for the free-typing fields (title, notes) so we don't
  // write to Firestore on every keystroke — we save on blur.
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const unsub = subscribeToProject(
      id,
      (p) => {
        setProject(p);
        if (p) {
          setTitle(p.title);
          setNotes(p.description);
        }
        setLoading(false);
      },
      () => setLoading(false),
    );
    const unsubDevs = subscribeToDevelopers(setDevelopers);
    return () => {
      unsub();
      unsubDevs();
    };
  }, [id]);

  // One-time migration: older projects stored a fixed `tasks` list. Convert it
  // into the columns/rows database the first time such a project is opened.
  const migratedRef = useRef(false);
  useEffect(() => {
    if (!project || migratedRef.current) return;
    if (
      project.rows.length === 0 &&
      project.tasks &&
      project.tasks.length > 0
    ) {
      migratedRef.current = true;
      updateProject(id, migrateTasksToDb(project.tasks));
    }
  }, [project, id]);

  if (loading) {
    return <p className="px-8 py-10 text-sm text-neutral-500">Loading…</p>;
  }

  if (!project) {
    return (
      <div className="px-8 py-10">
        <p className="text-sm text-neutral-500">Project not found.</p>
        <Link
          href="/projects"
          className="mt-2 inline-block text-sm text-blue-600 hover:underline"
        >
          ← Back to Projects
        </Link>
      </div>
    );
  }

  // Access guard: employees may only open projects they're assigned to.
  if (!isAdmin && (!employee || !project.developerIds.includes(employee.id))) {
    return (
      <div className="px-8 py-10">
        <p className="text-sm text-muted">
          You don’t have access to this project.
        </p>
        <Link
          href="/projects"
          className="mt-2 inline-block text-sm text-accent hover:underline"
        >
          ← Back to Projects
        </Link>
      </div>
    );
  }

  const dueValue = project.dueDate
    ? project.dueDate.toDate().toISOString().slice(0, 10)
    : "";

  // Compact, structured context the AI can reason about for this project.
  const taskList = project.rows
    .map((r) => `- ${String(r.cells.name ?? "")}`)
    .filter((l) => l.trim() !== "-")
    .join("\n");
  const projectContext = [
    `Project: ${project.title}`,
    `Status: ${project.status}`,
    `Priority: ${project.priority}`,
    `Due: ${dueValue || "none"}`,
    `Notes: ${project.description || "(empty)"}`,
    project.rows.length ? `\nTasks (${project.rows.length}):\n${taskList}` : "",
  ].join("\n");

  const AI_SYSTEM =
    "You are an assistant inside a company project workspace. Be concise, " +
    "professional, and practical. Use clear formatting (short paragraphs or " +
    "bullet points). Base answers on the provided project context.";

  // Append AI output into the notes field and persist.
  function insertIntoNotes(text: string) {
    const next = notes.trim() ? `${notes.trim()}\n\n${text}` : text;
    setNotes(next);
    updateProject(id, { description: next });
  }

  const aiActions: { label: string; prompt: string }[] = [
    {
      label: "Summarize",
      prompt: `Summarize this project in 2-3 sentences.\n\n${projectContext}`,
    },
    {
      label: "Draft status update",
      prompt: `Write a short status update for stakeholders about this project.\n\n${projectContext}`,
    },
    {
      label: "Next steps",
      prompt: `Suggest a concise, prioritized list of next steps for this project.\n\n${projectContext}`,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-8">
      <Link
        href="/projects"
        className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        ← Projects
      </Link>

      {/* Title */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          const t = title.trim();
          if (t && t !== project.title) updateProject(id, { title: t });
        }}
        className="mt-3 w-full bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-neutral-300"
        placeholder="Untitled"
      />

      {/* Properties */}
      <dl className="mt-6 grid grid-cols-[120px_1fr] items-start gap-y-3 text-sm">
        <PropRow label="Status">
          <select
            value={project.status}
            onChange={(e) =>
              updateProject(id, { status: e.target.value as ProjectStatus })
            }
            className="rounded-md border border-neutral-200 bg-transparent px-2 py-1 text-sm outline-none dark:border-neutral-800"
          >
            {PROJECT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </PropRow>

        <PropRow label="Priority">
          <select
            value={project.priority}
            onChange={(e) =>
              updateProject(id, {
                priority: e.target.value as ProjectPriority,
              })
            }
            className="rounded-md border border-neutral-200 bg-transparent px-2 py-1 text-sm outline-none dark:border-neutral-800"
          >
            {PROJECT_PRIORITIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </PropRow>

        <PropRow label="Assigned to">
          <ProjectDevelopers
            developerIds={project.developerIds}
            roster={developers}
            editable={isAdmin}
            onChange={(ids) => updateProject(id, { developerIds: ids })}
          />
        </PropRow>

        <PropRow label="Due date">
          <input
            type="date"
            value={dueValue}
            onChange={(e) =>
              updateProject(id, {
                dueDate: e.target.value
                  ? Timestamp.fromDate(new Date(e.target.value))
                  : null,
              })
            }
            className="rounded-md border border-neutral-200 bg-transparent px-2 py-1 text-sm outline-none dark:border-neutral-800"
          />
        </PropRow>
      </dl>

      {/* Database (Notion-style table) */}
      <div className="mt-8">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-md bg-surface px-2 py-1 text-xs font-medium">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M3 15h18M9 3v18" />
            </svg>
            Table
          </span>
          <span className="text-xs text-muted">{project.rows.length} rows</span>
        </div>
        <NotionTable
          columns={project.columns}
          rows={project.rows}
          onColumnsChange={(cols) => updateProject(id, { columns: cols })}
          onRowsChange={(rws) => updateProject(id, { rows: rws })}
        />
      </div>

      {/* AI actions */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <span className="mr-1 flex items-center gap-1 text-xs font-medium text-accent">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
          </svg>
          AI
        </span>
        {aiActions.map((a) => (
          <button
            key={a.label}
            onClick={() =>
              openAi({
                title: a.label,
                prompt: a.prompt,
                system: AI_SYSTEM,
                autoRun: true,
                insertLabel: "Insert into notes",
                onInsert: insertIntoNotes,
              })
            }
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-surface"
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Notes */}
      <div className="mt-4">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Notes
        </h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if (notes !== project.description)
              updateProject(id, { description: notes });
          }}
          rows={10}
          placeholder="Write anything about this project…"
          className="w-full resize-y rounded-lg border border-neutral-200 bg-transparent p-3 text-sm leading-relaxed outline-none focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600"
        />
      </div>

      {/* Danger zone */}
      <div className="mt-10 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <button
          onClick={() => {
            if (confirm(`Delete "${project.title}"? This cannot be undone.`)) {
              deleteProject(id).then(() => router.replace("/projects"));
            }
          }}
          className="text-sm text-red-600 hover:underline"
        >
          Delete project
        </button>
      </div>
    </div>
  );
}

function PropRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-neutral-500">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}
