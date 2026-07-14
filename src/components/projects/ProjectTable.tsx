"use client";

// Table view of the Projects database. Status and priority are editable inline
// via pill selects (writes straight to Firestore). The title links to the
// project detail page.

import Link from "next/link";
import Avatar from "@mui/material/Avatar";
import AvatarGroup from "@mui/material/AvatarGroup";
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
import { updateProject, deleteProject } from "@/lib/data/projects";
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

export function ProjectTable({
  projects,
  developers,
}: {
  projects: Project[];
  developers: Record<string, Developer>;
}) {
  return (
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
                          <Avatar>{d.name.charAt(0).toUpperCase()}</Avatar>
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
                <Button
                  className="row-actions"
                  size="small"
                  color="inherit"
                  onClick={() => {
                    if (confirm(`Delete "${p.title}"?`)) deleteProject(p.id);
                  }}
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
  );
}
