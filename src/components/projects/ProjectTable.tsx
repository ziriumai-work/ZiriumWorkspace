"use client";

// Table view of the Projects database. Status and priority are editable inline
// via pill selects (writes straight to Firestore). The title links to the
// project detail page.

import { useState } from "react";
import Link from "next/link";
import Avatar from "@mui/material/Avatar";
import AvatarGroup from "@mui/material/AvatarGroup";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MuiLink from "@mui/material/Link";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import DeleteIcon from "@mui/icons-material/Delete";
import { updateProject, deleteProject } from "@/lib/data/projects";
import { updateFinanceProject } from "@/lib/data/finance";
import { useUpload } from "@/lib/contexts/UploadContext";
import {
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  type Developer,
  type Project,
  type ProjectPriority,
  type ProjectStatus,
} from "@/lib/data/types";
import {
  PRIORITY_META,
  STATUS_META,
  formatDueDate,
} from "@/components/projectMeta";
import { PillSelect } from "@/components/ui/PillSelect";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toast } from "@/components/ui/Toast";
import { type AlertColor } from "@mui/material/Alert";

export function ProjectTable({
  projects,
  developers,
  isAdmin,
}: {
  projects: Project[];
  developers: Record<string, Developer>;
  isAdmin?: boolean;
}) {
  const { uploadFile } = useUpload();
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [docsProject, setDocsProject] = useState<Project | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastType, setToastType] = useState<AlertColor>("success");

  return (
    <Box>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell sx={{ pl: 4 }}>Title</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Priority</TableCell>
            <TableCell>Developers</TableCell>
            <TableCell>Due</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {projects.map((p) => {
            const devs = p.developerIds
              .map((did) => developers[did])
              .filter(Boolean);
            return (
              <TableRow
                key={p.id}
                hover
                sx={{
                  "& .row-actions": { opacity: 0 },
                  "&:hover .row-actions": { opacity: 1 },
                }}
              >
                <TableCell sx={{ pl: 4 }}>
                  <MuiLink
                    component={Link}
                    href={`/projects/${p.id}`}
                    color="inherit"
                    underline="hover"
                    sx={{ fontWeight: 500 }}
                  >
                    {p.title}
                  </MuiLink>
                </TableCell>

                <TableCell>
                  <PillSelect
                    value={p.status}
                    options={PROJECT_STATUSES}
                    color={STATUS_META[p.status].color}
                    onChange={(status: ProjectStatus) =>
                      updateProject(p.id, { status })
                    }
                  />
                </TableCell>

                <TableCell>
                  <PillSelect
                    value={p.priority}
                    options={PROJECT_PRIORITIES}
                    color={PRIORITY_META[p.priority].color}
                    onChange={(priority: ProjectPriority) =>
                      updateProject(p.id, { priority })
                    }
                  />
                </TableCell>

                <TableCell>
                  {devs.length > 0 ? (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <AvatarGroup
                        max={3}
                        sx={{
                          "& .MuiAvatar-root": {
                            width: 24,
                            height: 24,
                            fontSize: 10,
                            fontWeight: 600,
                            bgcolor: "accentSoft",
                            color: "primary.main",
                          },
                        }}
                      >
                        {devs.map((d) => (
                          <Tooltip key={d.id} title={d.name}>
                            <Avatar src={d.photoURL || undefined}>{d.name.charAt(0).toUpperCase()}</Avatar>
                          </Tooltip>
                        ))}
                      </AvatarGroup>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {devs[0].name}
                        {devs.length > 1 ? ` +${devs.length - 1}` : ""}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.disabled">
                      —
                    </Typography>
                  )}
                </TableCell>

                <TableCell sx={{ color: "text.secondary" }}>
                  {formatDueDate(p.dueDate)}
                </TableCell>

                <TableCell align="right">
                  {isAdmin && (
                    <Badge badgeContent={p.financeFiles?.length || 0} color="primary" sx={{ mr: 2 }}>
                      <Button
                        size="small"
                        color="inherit"
                        onClick={() => setDocsProject(p)}
                        startIcon={<AttachFileIcon sx={{ fontSize: 16 }} />}
                        sx={{ fontSize: 12, fontWeight: 500, color: "text.secondary" }}
                      >
                        Docs
                      </Button>
                    </Badge>
                  )}
                  <Button
                    className="row-actions"
                    size="small"
                    color="inherit"
                    onClick={() => setProjectToDelete(p)}
                    sx={{
                      fontSize: 12,
                      fontWeight: 400,
                      color: "text.secondary",
                      transition: "opacity 0.15s",
                      "&:hover": { color: "error.main" },
                    }}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={!!projectToDelete}
        title="Delete Project"
        message={`Are you sure you want to delete "${projectToDelete?.title}"?`}
        type="error"
        confirmLabel="Delete Project"
        onConfirm={() => {
          if (projectToDelete) deleteProject(projectToDelete.id);
          setProjectToDelete(null);
        }}
        onCancel={() => setProjectToDelete(null)}
      />

      <Dialog open={!!docsProject} onClose={() => setDocsProject(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          Project Documents
          <IconButton onClick={() => setDocsProject(null)} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ mb: 3 }}>
            <Button component="label" variant="contained" size="small" startIcon={<AttachFileIcon />}>
              Upload Document
              <input
                type="file"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !docsProject) return;
                  if (docsProject.financeFiles?.some(f => f.name === file.name)) {
                    setToastType("error");
                    setToast(`File "${file.name}" is already uploaded.`);
                    e.target.value = '';
                    return;
                  }
                  e.target.value = ''; // reset

                  try {
                    const uploaded = await uploadFile(`financeProjects/${docsProject.id}/${Date.now()}-${file.name}`, file);
                    const newFiles = [...(docsProject.financeFiles || []), uploaded];
                    
                    // Sync to both collections
                    await updateProject(docsProject.id, { financeFiles: newFiles });
                    await updateFinanceProject(docsProject.id, { files: newFiles }).catch(() => {}); // Catch if finance project doesn't exist
                    
                    setDocsProject({ ...docsProject, financeFiles: newFiles });
                  } catch (err) {
                    console.error("Upload failed", err);
                  }
                }}
              />
            </Button>
          </Box>
          {docsProject?.financeFiles?.length ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {docsProject.financeFiles.map((f, i) => (
                <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Button
                    component="a"
                    href={f.url}
                    target="_blank"
                    variant="outlined"
                    startIcon={<AttachFileIcon />}
                    sx={{ justifyContent: "flex-start", textAlign: "left", flexGrow: 1 }}
                  >
                    {f.name}
                  </Button>
                  <IconButton 
                    size="small" 
                    color="error" 
                    onClick={async () => {
                      const newFiles = docsProject.financeFiles!.filter((_, index) => index !== i);
                      await updateProject(docsProject.id, { financeFiles: newFiles });
                      await updateFinanceProject(docsProject.id, { files: newFiles }).catch(() => {});
                      setDocsProject({ ...docsProject, financeFiles: newFiles });
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography color="text.secondary">No documents attached.</Typography>
          )}
        </DialogContent>
      </Dialog>
      <Toast
        open={Boolean(toast)}
        message={toast ?? ""}
        type={toastType}
        onClose={() => setToast(null)}
      />
    </Box>
  );
}
