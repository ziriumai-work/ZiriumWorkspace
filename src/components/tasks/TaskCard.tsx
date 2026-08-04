"use client";

import { useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import MuiLink from "@mui/material/Link";

import CloseIcon from "@mui/icons-material/Close";
import AttachFileIcon from "@mui/icons-material/AttachFile";

import { deleteTask, updateTask } from "@/lib/data/tasks";
import { useCurrency } from "@/lib/contexts/CurrencyContext";
import { TaskReportEditor } from "@/components/tasks/TaskReportEditor";
import { TASK_STATUS_COLORS } from "@/components/projectMeta";
import { PillSelect } from "@/components/ui/PillSelect";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  DAILY_TASK_STATUSES,
  type DailyTask,
  type DailyTaskStatus,
  type Employee,
  type TaskReport,
} from "@/lib/data/types";

export function TaskCard({
  task,
  showAssignee,
  canEdit,
  canDelete,
  currentUser,
  employees = [],
  index = 0,
}: {
  task: DailyTask;
  showAssignee: boolean;
  canEdit: boolean;
  canDelete: boolean;
  currentUser: { uid: string; name: string; isAdmin: boolean };
  employees?: Employee[];
  index?: number;
}) {
  const { formatCurrency } = useCurrency();
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const reportsCount = task.reports ? task.reports.length : (task.report?.text || task.report?.links?.length || task.report?.files?.length ? 1 : 0);
  const hasReport = reportsCount > 0;

  const isLive = task.status === "in_progress";
  const emp = employees.find((e) => e.id === task.assigneeId);

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 3,
        position: "relative",
        overflow: "hidden",
        transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        borderColor: open ? "primary.main" : "divider",
        bgcolor: open ? "surface" : "background.paper",
        "&:hover": {
          borderColor: "primary.main",
          boxShadow: "0 8px 24px -6px rgba(0, 0, 0, 0.12)",
          transform: "translateY(-4px) scale(1.015)",
          "& .docket-scanline": {
            transform: "translateX(100%)",
          },
        },
      }}
    >
      {/* Top subtle scanline sweep effect on hover */}
      <Box
        className="docket-scanline"
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "2px",
          background: "linear-gradient(90deg, transparent, var(--mui-palette-primary-main), transparent)",
          transform: "translateX(-100%)",
          transition: "transform 0.6s ease-in-out",
          zIndex: 2,
        }}
      />

      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.75, px: 2.5, py: 2 }}>
        {/* Employee / Intern Profile Avatar */}
        <Avatar
          src={emp?.photoURL || undefined}
          sx={{
            width: 38,
            height: 38,
            fontSize: 14,
            fontWeight: 700,
            bgcolor: "accentSoft",
            color: "primary.main",
            border: "1px solid",
            borderColor: "divider",
            flexShrink: 0,
            mt: 0.25,
          }}
        >
          {task.assigneeName?.charAt(0).toUpperCase() ?? "?"}
        </Avatar>

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            {/* Assignee Name Label */}
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: "primary.main",
                textTransform: "uppercase",
                fontSize: 10.5,
                letterSpacing: "0.04em",
                fontFamily: "var(--font-geist-mono), monospace",
              }}
            >
              {task.assigneeName || "Unassigned"}
            </Typography>

            {/* Live Indicator Dot */}
            {isLive && (
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  bgcolor: TASK_STATUS_COLORS[task.status],
                  animation: "live-pulse 2s infinite",
                  flexShrink: 0,
                }}
              />
            )}
          </Box>

          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 14, color: "text.primary", mt: 0.25 }}>
            {task.title}
          </Typography>

          {task.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: 13, lineHeight: 1.4 }}>
              {task.description}
            </Typography>
          )}

          {/* Micro Tags Bar */}
          <Box
            sx={{
              mt: 1.25,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 1,
            }}
          >
            {task.projectTitle && (
              <Chip
                label={task.projectTitle}
                size="small"
                sx={{ bgcolor: "surface", fontSize: 11, height: 22, border: "1px solid", borderColor: "divider" }}
              />
            )}
            {!!task.assignedHours && task.assignedHours > 0 && (
              <Chip
                label={`${task.assignedHours}h assigned`}
                size="small"
                sx={{ bgcolor: "surface", fontSize: 11, height: 22, border: "1px solid", borderColor: "divider" }}
              />
            )}
            {task.isOvertime && (
              <Chip
                label={
                  task.resolvesODH && task.compensatesWeeklyHours
                    ? "ODH + Compensatory Task"
                    : task.resolvesODH
                    ? "ODH Overtime"
                    : task.compensatesWeeklyHours
                    ? "Compensatory Task"
                    : `Overtime (${formatCurrency(task.overtimeCost || 0)})`
                }
                size="small"
                sx={{ bgcolor: "#ef444415", color: "#ef4444", fontWeight: 600, fontSize: 11, height: 22, border: "1px solid #ef444433" }}
              />
            )}
            {task.attachments && task.attachments.length > 0 && (
              <Chip
                label={`${task.attachments.length} doc(s)`}
                size="small"
                sx={{ bgcolor: "surface", fontSize: 11, height: 22, border: "1px solid", borderColor: "divider", cursor: "pointer" }}
                onClick={() => setOpen(true)}
              />
            )}

            <MuiLink
              component="button"
              variant="caption"
              underline="none"
              onClick={() => setOpen((v) => !v)}
              sx={{
                position: "relative",
                fontWeight: 600,
                color: open ? "primary.main" : "text.secondary",
                fontSize: 12,
                transition: "color 0.2s ease",
                border: "none",
                background: "none",
                cursor: "pointer",
                p: 0,
                ml: 0.5,
                "&:hover": {
                  color: "primary.main",
                },
                "&::after": {
                  content: '""',
                  position: "absolute",
                  bottom: -2,
                  left: 0,
                  width: "100%",
                  height: "2px",
                  borderRadius: "2px",
                  bgcolor: "primary.main",
                  transform: open ? "scaleX(1)" : "scaleX(0)",
                  transformOrigin: "right",
                  transition: "transform 0.3s ease",
                },
                "&:hover::after": {
                  transform: "scaleX(1)",
                  transformOrigin: "left",
                },
              }}
            >
              {open ? "Hide updates" : hasReport ? `View ${reportsCount} update${reportsCount > 1 ? "s" : ""}` : "Add update"}
            </MuiLink>
          </Box>
        </Box>

        {/* Status Dropdown / Complete Chip */}
        {!currentUser.isAdmin && task.status === "done" ? (
          <Chip
            label="Complete"
            sx={{
              bgcolor: TASK_STATUS_COLORS.done,
              color: "white",
              fontWeight: 600,
              fontSize: 12,
              height: 28,
            }}
          />
        ) : (
          <PillSelect
            value={task.status}
            options={currentUser.isAdmin ? DAILY_TASK_STATUSES : DAILY_TASK_STATUSES.filter((s) => s.value !== "done")}
            color={TASK_STATUS_COLORS[task.status]}
            onChange={(status: DailyTaskStatus) => updateTask(task.id, { status })}
          />
        )}

        {canDelete && (
          <IconButton
            size="small"
            onClick={() => setDeleteDialogOpen(true)}
            title="Delete task"
            sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </Box>

      <Collapse in={open}>
        <Divider />
        {task.attachments && task.attachments.length > 0 && (
          <Box sx={{ px: 2.5, pt: 1.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mb: 1, color: "text.secondary" }}>
              Assigned Documents:
            </Typography>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {task.attachments.map((f, i) => (
                <MuiLink
                  key={i}
                  href={f.url}
                  target="_blank"
                  rel="noopener"
                  variant="body2"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    bgcolor: "surface",
                    px: 1.25,
                    py: 0.5,
                    borderRadius: 1.5,
                    border: "1px solid",
                    borderColor: "divider",
                    fontSize: 12,
                    "&:hover": { bgcolor: "action.hover", borderColor: "primary.main" },
                    textDecoration: "none",
                  }}
                >
                  <AttachFileIcon sx={{ fontSize: 15 }} />
                  {f.name}
                </MuiLink>
              ))}
            </Box>
          </Box>
        )}
        <Box sx={{ px: 2.5, py: 2 }}>
          <TaskReportEditor
            taskId={task.id}
            reports={task.reports ?? (task.report?.text || task.report?.links?.length || task.report?.files?.length ? [task.report] : [])}
            editable={canEdit}
            currentUser={currentUser}
            onSave={(reports: TaskReport[]) => updateTask(task.id, { reports })}
          />
        </Box>
      </Collapse>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Task"
        message={`Are you sure you want to delete "${task.title}"?`}
        type="error"
        confirmLabel="Delete Task"
        onConfirm={() => {
          deleteTask(task.id);
          setDeleteDialogOpen(false);
        }}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </Paper>
  );
}
