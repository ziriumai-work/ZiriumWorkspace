"use client";

// Editor for a task's report: free-text, links, and file uploads (Firebase
// Storage). Used inside an expanded task. `editable` is false for viewers who
// aren't the assignee or an admin.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MuiLink from "@mui/material/Link";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import AttachFileIcon from "@mui/icons-material/AttachFile";
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
      <Box sx={{ fontSize: 14 }}>
        {empty ? (
          <Typography variant="body2" color="text.secondary">
            No report submitted yet.
          </Typography>
        ) : (
          <>
            {text && (
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {text}
              </Typography>
            )}
            <LinkList links={links} />
            <FileList files={files} />
          </>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <TextField
        value={text}
        onChange={(e) => setText(e.target.value)}
        multiline
        minRows={4}
        placeholder="Write your report…"
        fullWidth
      />

      {/* Links */}
      <Box>
        <LinkList
          links={links}
          onRemove={(i) => setLinks(links.filter((_, j) => j !== i))}
        />
        <Box sx={{ mt: 0.5, display: "flex", gap: 1 }}>
          <TextField
            value={newLink}
            onChange={(e) => setNewLink(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addLink()}
            placeholder="Add a link (e.g. Google Drive, Figma)…"
            fullWidth
          />
          <Button
            onClick={addLink}
            variant="outlined"
            color="inherit"
            sx={{ borderColor: "divider", flexShrink: 0, fontSize: 12 }}
          >
            Add link
          </Button>
        </Box>
      </Box>

      {/* Files */}
      <Box>
        <FileList
          files={files}
          onRemove={(i) => setFiles(files.filter((_, j) => j !== i))}
        />
        <Button
          component="label"
          variant="outlined"
          color="inherit"
          disabled={uploading}
          startIcon={<AttachFileIcon sx={{ fontSize: 14 }} />}
          sx={{
            mt: 0.5,
            borderStyle: "dashed",
            borderColor: "divider",
            color: "text.secondary",
            fontSize: 12,
          }}
        >
          {uploading ? "Uploading…" : "Attach files"}
          <input
            type="file"
            multiple
            hidden
            disabled={uploading}
            onChange={(e) => onFiles(e.target.files)}
          />
        </Button>
      </Box>

      {error && (
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      )}

      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Button onClick={save} disabled={!dirty || uploading} variant="contained">
          Save report
        </Button>
        {saved && (
          <Typography variant="caption" color="success.main">
            Saved ✓
          </Typography>
        )}
      </Box>
    </Box>
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
    <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 0.5 }}>
      {links.map((l, i) => (
        <Box component="li" key={i} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <MuiLink
            href={l}
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
            noWrap
            underline="hover"
          >
            🔗 {l}
          </MuiLink>
          {onRemove && (
            <IconButton
              size="small"
              onClick={() => onRemove(i)}
              sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          )}
        </Box>
      ))}
    </Box>
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
    <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 0.5 }}>
      {files.map((f, i) => (
        <Box component="li" key={i} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <MuiLink
            href={f.url}
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
            noWrap
            underline="hover"
          >
            📄 {f.name}
          </MuiLink>
          {onRemove && (
            <IconButton
              size="small"
              onClick={() => onRemove(i)}
              sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          )}
        </Box>
      ))}
    </Box>
  );
}
