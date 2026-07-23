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
import DeleteIcon from "@mui/icons-material/Delete";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { uploadTaskFile } from "@/lib/firebase/storage";
import type { TaskReport, TaskFile } from "@/lib/data/types";
import { Toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function TaskReportEditor({
  taskId,
  reports,
  editable,
  currentUser,
  onSave,
}: {
  taskId: string;
  reports: TaskReport[];
  editable: boolean;
  currentUser?: { uid: string; name: string; isAdmin: boolean };
  onSave: (reports: TaskReport[]) => void | Promise<void>;
}) {
  const [text, setText] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [newLink, setNewLink] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);

  const dirty = text.trim() !== "" || links.length > 0 || files.length > 0;

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
    const newReport: TaskReport = {
      id: Math.random().toString(36).substring(2, 11),
      type: currentUser?.isAdmin ? "review" : "report",
      text,
      links,
      files,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.uid ?? "unknown",
      createdByName: currentUser?.name ?? "Unknown User",
    };
    await onSave([...reports, newReport]);
    setSaved(true);
    setText("");
    setLinks([]);
    setFiles([]);
  }

  async function handleDeleteReport() {
    if (!reportToDelete) return;
    const filtered = reports.filter((r) => r.id !== reportToDelete);
    await onSave(filtered);
    setReportToDelete(null);
  }

  // Common render for a single report item
  const renderReportItem = (r: TaskReport, index: number) => (
    <Box key={r.id || index} sx={{ display: "flex", gap: 2, mb: 3, position: "relative" }}>
      {/* Timeline Line */}
      <Box sx={{ 
        position: "absolute", 
        left: "7px", 
        top: "20px", 
        bottom: "-24px", 
        width: "2px", 
        bgcolor: "divider",
        display: index === reports.length - 1 ? "none" : "block"
      }} />
      
      {/* Timeline Dot */}
      <Box sx={{ mt: 0.5, flexShrink: 0 }}>
        <Box sx={{ 
          width: 16, 
          height: 16, 
          borderRadius: "50%", 
          bgcolor: r.type === "review" ? "primary.main" : "text.secondary",
          border: "3px solid",
          borderColor: "background.paper",
          position: "relative",
          zIndex: 1
        }} />
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, pb: 1 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5, alignItems: "center" }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: r.type === "review" ? "primary.main" : "text.primary" }}>
            {r.createdByName || "Unknown"} {r.type === "review" ? "(Admin Review)" : "(Report)"}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {r.createdAt ? new Date(r.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : ""}
            </Typography>
            {(currentUser?.isAdmin || r.createdBy === currentUser?.uid) && (
              <IconButton size="small" onClick={() => setReportToDelete(r.id ?? null)} sx={{ color: "text.secondary", "&:hover": { color: "error.main" }, p: 0.5 }}>
                <DeleteIcon sx={{ fontSize: 14 }} />
              </IconButton>
            )}
          </Box>
        </Box>
        {r.text && (
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mb: 1.5, color: "text.secondary" }}>
            {r.text}
          </Typography>
        )}
        <LinkList links={r.links} />
        <FileList files={r.files} />
      </Box>
    </Box>
  );

  // Read-only view for non-editors.
  if (!editable) {
    if (reports.length === 0) {
      return (
        <Box sx={{ fontSize: 14 }}>
          <Typography variant="body2" color="text.secondary">
            No updates submitted yet.
          </Typography>
        </Box>
      );
    }
    return (
      <Box sx={{ fontSize: 14 }}>
        {reports.map(renderReportItem)}
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {reports.length > 0 && (
        <Box>
          <Button 
            onClick={() => setShowHistory(!showHistory)}
            color={showHistory ? "primary" : "inherit"}
            variant="text"
            endIcon={showHistory ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            sx={{ 
              mb: showHistory ? 1.5 : 0, 
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 3,
              py: 0.5,
              px: 2,
              bgcolor: showHistory ? "accentSoft" : "transparent",
              "&:hover": { bgcolor: "accentSoft", color: "primary.main" }
            }}
          >
            {reports.length} previous update{reports.length > 1 ? "s" : ""}
          </Button>
          {showHistory && (
            <Box sx={{ mt: 1 }}>
              {reports.map(renderReportItem)}
            </Box>
          )}
        </Box>
      )}
      
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 2, border: "1px dashed", borderColor: "divider", borderRadius: 2 }}>
        <Typography variant="subtitle2">
          {currentUser?.isAdmin ? "Add Admin Review" : "Add Task Report"}
        </Typography>
        <TextField
          value={text}
          onChange={(e) => setText(e.target.value)}
          multiline
          minRows={3}
          placeholder={currentUser?.isAdmin ? "Write your review..." : "Write your report..."}
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
          {currentUser?.isAdmin ? "Submit Review" : "Submit Report"}
        </Button>
      </Box>

      <Toast
        open={saved}
        message={currentUser?.isAdmin ? "Review submitted successfully!" : "Report submitted successfully!"}
        type="success"
        onClose={() => setSaved(false)}
      />

      <ConfirmDialog
        open={!!reportToDelete}
        title="Delete Update"
        message="Are you sure you want to delete this update? This action cannot be undone."
        type="error"
        confirmLabel="Delete"
        onConfirm={handleDeleteReport}
        onCancel={() => setReportToDelete(null)}
      />
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
