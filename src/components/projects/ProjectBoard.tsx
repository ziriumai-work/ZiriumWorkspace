"use client";

// Board (Kanban) view: one column per status, cards grouped by status. Dragging
// a card to another column updates its status in Firestore (native HTML5 drag
// and drop — no extra dependency).

import { useState } from "react";
import Link from "next/link";
import Avatar from "@mui/material/Avatar";
import AvatarGroup from "@mui/material/AvatarGroup";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Badge from "@mui/material/Badge";
import CloseIcon from "@mui/icons-material/Close";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { updateProject } from "@/lib/data/projects";
import {
  PROJECT_STATUSES,
  type Developer,
  type Project,
  type ProjectStatus,
} from "@/lib/data/types";
import {
  PRIORITY_META,
  STATUS_META,
  chipSx,
  formatDueDate,
} from "@/components/projectMeta";

export function ProjectBoard({
  projects,
  developers,
  isAdmin,
}: {
  projects: Project[];
  developers: Record<string, Developer>;
  isAdmin?: boolean;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<ProjectStatus | null>(null);
  const [docsProject, setDocsProject] = useState<Project | null>(null);

  function onDrop(status: ProjectStatus) {
    if (draggingId) {
      const p = projects.find((x) => x.id === draggingId);
      if (p && p.status !== status) updateProject(draggingId, { status });
    }
    setDraggingId(null);
    setOverStatus(null);
  }

  return (
    <Box sx={{ display: "flex", height: "100%", gap: 1.5, overflowX: "auto", px: 4, py: 2 }}>
      {PROJECT_STATUSES.map((col) => {
        const cards = projects.filter((p) => p.status === col.value);
        const isOver = overStatus === col.value;
        return (
          <Box
            key={col.value}
            onDragOver={(e) => {
              e.preventDefault();
              setOverStatus(col.value);
            }}
            onDrop={() => onDrop(col.value)}
            sx={{
              display: "flex",
              width: 256,
              flexShrink: 0,
              flexDirection: "column",
              borderRadius: 3,
              border: 1,
              borderColor: isOver ? "text.disabled" : "divider",
              bgcolor: isOver ? "surface" : "transparent",
              p: 1,
              transition: "border-color 0.15s, background-color 0.15s",
            }}
          >
            <Box sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.75, px: 0.75 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  bgcolor: STATUS_META[col.value].color,
                }}
              />
              <Typography variant="caption" sx={{ fontWeight: 500 }}>
                {col.label}
              </Typography>
              <Typography variant="caption" color="text.disabled">
                {cards.length}
              </Typography>
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {cards.map((p) => {
                const devs = p.developerIds
                  .map((did) => developers[did])
                  .filter(Boolean);
                return (
                  <Paper
                    key={p.id}
                    component={Link}
                    href={`/projects/${p.id}`}
                    draggable
                    onDragStart={() => setDraggingId(p.id)}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setOverStatus(null);
                    }}
                    variant="outlined"
                    sx={{
                      display: "block",
                      cursor: "grab",
                      borderRadius: 2.5,
                      p: 1.25,
                      textDecoration: "none",
                      color: "inherit",
                      opacity: draggingId === p.id ? 0.5 : 1,
                      transition: "border-color 0.15s",
                      "&:hover": { borderColor: "text.disabled" },
                      "&:active": { cursor: "grabbing" },
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {p.title}
                    </Typography>
                    <Box
                      sx={{
                        mt: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Chip
                        label={PRIORITY_META[p.priority].label}
                        sx={[
                          chipSx(PRIORITY_META[p.priority].color),
                          { height: 18, fontSize: 10 },
                        ]}
                      />
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.75,
                        }}
                      >
                        {isAdmin && (
                          <Badge badgeContent={p.financeFiles?.length || 0} color="primary" sx={{ mr: 1, "& .MuiBadge-badge": { transform: "scale(0.7) translate(50%, -50%)" } }}>
                            <Button
                              size="small"
                              variant="text"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDocsProject(p);
                              }}
                              startIcon={<AttachFileIcon sx={{ fontSize: 14 }} />}
                              sx={{ minWidth: 0, p: 0, color: "text.secondary", fontSize: 10, fontWeight: 500, "& .MuiButton-startIcon": { mr: 0.5 } }}
                            >
                              Docs
                            </Button>
                          </Badge>
                        )}
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11 }}>
                          {formatDueDate(p.dueDate)}
                        </Typography>
                        <AvatarGroup
                          max={3}
                          sx={{
                            "& .MuiAvatar-root": {
                              width: 16,
                              height: 16,
                              fontSize: 8,
                              fontWeight: 600,
                              bgcolor: "accentSoft",
                              color: "primary.main",
                            },
                          }}
                        >
                          {devs.slice(0, 3).map((d) => (
                            <Tooltip key={d.id} title={d.name}>
                              <Avatar>{d.name.charAt(0).toUpperCase()}</Avatar>
                            </Tooltip>
                          ))}
                        </AvatarGroup>
                      </Box>
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          </Box>
        );
      })}

      <Dialog open={!!docsProject} onClose={() => setDocsProject(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          Project Documents
          <IconButton onClick={() => setDocsProject(null)} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {docsProject?.financeFiles?.length ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {docsProject.financeFiles.map((f, i) => (
                <Button
                  key={i}
                  component="a"
                  href={f.url}
                  target="_blank"
                  variant="outlined"
                  startIcon={<AttachFileIcon />}
                  sx={{ justifyContent: "flex-start", textAlign: "left" }}
                >
                  {f.name}
                </Button>
              ))}
            </Box>
          ) : (
            <Typography color="text.secondary">No documents attached.</Typography>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
