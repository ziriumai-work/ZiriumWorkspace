"use client";

// Editor for a task's report: free-text, links, and file uploads (Firebase
// Storage). Used inside an expanded task. `editable` is false for viewers who
// aren't the assignee or an admin.

import { useState } from "react";
import { uploadTaskFile } from "@/lib/firebase/storage";
import type { TaskReport } from "@/lib/data/types";

export function TaskReportEditor({
  taskId,
  report,
  editable,
  onSave,
}: {
  taskId: string;
  report: TaskReport;
  editable: boolean;
  onSave: (report: TaskReport) => void | Promise<void>;
}) {
  const [text, setText] = useState(report.text);
  const [links, setLinks] = useState<string[]>(report.links);
  const [files, setFiles] = useState(report.files);
  const [newLink, setNewLink] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty =
    text !== report.text ||
    JSON.stringify(links) !== JSON.stringify(report.links) ||
    JSON.stringify(files) !== JSON.stringify(report.files);

  function addLink() {
    const l = newLink.trim();
    if (!l) return;
    setLinks([...links, l]);
    setNewLink("");
  }

  async function onFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = [];
      for (const file of Array.from(list)) {
        uploaded.push(await uploadTaskFile(taskId, file));
      }
      setFiles([...files, ...uploaded]);
    } catch {
      setError(
        "Upload failed. Make sure Firebase Storage is enabled (Build → Storage) and its rules are published.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    await onSave({ text, links, files });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  // Read-only view for non-editors.
  if (!editable) {
    const empty = !text && links.length === 0 && files.length === 0;
    return (
      <div className="text-sm">
        {empty ? (
          <p className="text-muted">No report submitted yet.</p>
        ) : (
          <>
            {text && <p className="whitespace-pre-wrap">{text}</p>}
            <LinkList links={links} />
            <FileList files={files} />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Write your report…"
        className="w-full resize-y rounded-lg border border-border bg-transparent p-2.5 text-sm outline-none focus:border-accent"
      />

      {/* Links */}
      <div>
        <LinkList links={links} onRemove={(i) => setLinks(links.filter((_, j) => j !== i))} />
        <div className="mt-1 flex gap-2">
          <input
            value={newLink}
            onChange={(e) => setNewLink(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addLink()}
            placeholder="Add a link (e.g. Google Drive, Figma)…"
            className="flex-1 rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-accent"
          />
          <button
            onClick={addLink}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-surface"
          >
            Add link
          </button>
        </div>
      </div>

      {/* Files */}
      <div>
        <FileList files={files} onRemove={(i) => setFiles(files.filter((_, j) => j !== i))} />
        <label className="mt-1 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-surface">
          {uploading ? "Uploading…" : "📎 Attach files"}
          <input
            type="file"
            multiple
            disabled={uploading}
            onChange={(e) => onFiles(e.target.files)}
            className="hidden"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={!dirty || uploading}
          className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          Save report
        </button>
        {saved && <span className="text-xs text-green-600">Saved ✓</span>}
      </div>
    </div>
  );
}

function LinkList({
  links,
  onRemove,
}: {
  links: string[];
  onRemove?: (i: number) => void;
}) {
  if (links.length === 0) return null;
  return (
    <ul className="space-y-1">
      {links.map((l, i) => (
        <li key={i} className="flex items-center gap-2 text-sm">
          <a
            href={l}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-accent hover:underline"
          >
            🔗 {l}
          </a>
          {onRemove && (
            <button
              onClick={() => onRemove(i)}
              className="text-xs text-muted hover:text-red-600"
            >
              ✕
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function FileList({
  files,
  onRemove,
}: {
  files: { name: string; url: string }[];
  onRemove?: (i: number) => void;
}) {
  if (files.length === 0) return null;
  return (
    <ul className="space-y-1">
      {files.map((f, i) => (
        <li key={i} className="flex items-center gap-2 text-sm">
          <a
            href={f.url}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-accent hover:underline"
          >
            📄 {f.name}
          </a>
          {onRemove && (
            <button
              onClick={() => onRemove(i)}
              className="text-xs text-muted hover:text-red-600"
            >
              ✕
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
