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
    </Box>
  );
}
