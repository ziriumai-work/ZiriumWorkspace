"use client";

// The Projects database. Subscribes to projects + member profiles in real time
// and renders one of two views (Table / Board). Creating, editing status, and
// deleting all write straight to Firestore; the subscription reflects changes
// back instantly (and for every other signed-in user too).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { subscribeToProjects, createProject } from "@/lib/projects";
import { subscribeToDevelopers } from "@/lib/developers";
import { useAuth } from "@/lib/auth-context";
import type { Developer, Project } from "@/lib/types";
import { ProjectTable } from "@/components/projects/ProjectTable";
import { ProjectBoard } from "@/components/projects/ProjectBoard";
import { AiProjectAgent } from "@/components/projects/AiProjectAgent";
import {
  buildMarkDatabase,
  MARK_PROJECT_DESCRIPTION,
  MARK_PROJECT_TITLE,
} from "@/lib/seed/markArchitecture";

type View = "table" | "board";

export default function ProjectsPage() {
  const { user, employee, isAdmin } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("table");
  const [showAgent, setShowAgent] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubProjects = subscribeToProjects(
      (p) => {
        setProjects(p);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    const unsubDevs = subscribeToDevelopers(setDevelopers);
    return () => {
      unsubProjects();
      unsubDevs();
    };
  }, []);

  // Roster lookup for rendering assigned developers in the table/board.
  const devMap = useMemo(
    () => Object.fromEntries(developers.map((d) => [d.id, d])),
    [developers],
  );

  async function handleCreate() {
    const title = newTitle.trim();
    if (!title || !user) return;
    setCreating(true);
    setError(null);
    try {
      await createProject({ title }, user.uid);
      setNewTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  // One-click sample: the MARK Architecture timeline. If it already exists, just
  // open it (idempotent — avoids duplicates).
  const markProject = projects.find((p) => p.title === MARK_PROJECT_TITLE);
  async function loadMark() {
    if (!user) return;
    if (markProject) {
      router.push(`/projects/${markProject.id}`);
      return;
    }
    setSeeding(true);
    setError(null);
    try {
      const newId = await createProject(
        {
          title: MARK_PROJECT_TITLE,
          description: MARK_PROJECT_DESCRIPTION,
          status: "in_progress",
          priority: "high",
        },
        user.uid,
        buildMarkDatabase(),
      );
      router.push(`/projects/${newId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create the project",
      );
    } finally {
      setSeeding(false);
    }
  }

  // Admins see all projects; employees see only the ones they're assigned to.
  const visibleProjects = useMemo(() => {
    if (isAdmin) return projects;
    if (!employee) return [];
    return projects.filter((p) => p.developerIds.includes(employee.id));
  }, [projects, isAdmin, employee]);

  const sorted = useMemo(
    () => [...visibleProjects].sort((a, b) => a.order - b.order),
    [visibleProjects],
  );

  return (
    <div className="flex flex-1 flex-col">
      <AiProjectAgent
        open={showAgent}
        onClose={() => setShowAgent(false)}
        onCreated={(newId) => {
          setShowAgent(false);
          router.push(`/projects/${newId}`);
        }}
      />

      {/* Header + toolbar */}
      <header className="flex items-center justify-between border-b border-neutral-200 px-8 py-4 dark:border-neutral-800">
        <h1 className="text-lg font-semibold tracking-tight">Projects</h1>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <button
                onClick={() => setShowAgent(true)}
                className="flex items-center gap-1.5 rounded-lg bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent transition hover:opacity-90"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
                </svg>
                Generate with AI
              </button>
              <button
                onClick={loadMark}
                disabled={seeding}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-surface disabled:opacity-50"
              >
                {seeding
                  ? "Creating…"
                  : markProject
                    ? "Open MARK Architecture"
                    : "+ MARK Architecture sample"}
              </button>
            </>
          )}
          <div className="flex rounded-lg border border-neutral-200 p-0.5 dark:border-neutral-800">
            {(["table", "board"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition ${
                  view === v
                    ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Quick-add row (admins only) */}
      <div
        className={`items-center gap-2 border-b border-neutral-200 px-8 py-3 dark:border-neutral-800 ${
          isAdmin ? "flex" : "hidden"
        }`}
      >
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="New project title…"
          className="flex-1 rounded-lg border border-neutral-200 bg-transparent px-3 py-1.5 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600"
        />
        <button
          onClick={handleCreate}
          disabled={creating || !newTitle.trim()}
          className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {creating ? "Adding…" : "Add"}
        </button>
      </div>

      {error && (
        <p className="px-8 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {/* View */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <p className="px-8 py-10 text-sm text-neutral-500">Loading…</p>
        ) : sorted.length === 0 ? (
          <p className="px-8 py-10 text-sm text-neutral-500">
            No projects yet. Add one above to get started.
          </p>
        ) : view === "table" ? (
          <ProjectTable projects={sorted} developers={devMap} />
        ) : (
          <ProjectBoard projects={sorted} developers={devMap} />
        )}
      </div>
    </div>
  );
}
