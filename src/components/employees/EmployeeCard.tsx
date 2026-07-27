"use client";

import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import EditIcon from "@mui/icons-material/Edit";
import { PillSelect } from "@/components/ui/PillSelect";
import { EMPLOYEE_STATUS_COLORS } from "@/components/projectMeta";
import { updateDeveloper } from "@/lib/data/developers";
import {
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  EMPLOYEE_STATUSES,
  type Employee,
  type EmployeeStatus,
} from "@/lib/data/types";

function CardRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, py: 0.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13, flexShrink: 0 }}>
        {label}
      </Typography>
      <Box sx={{ flex: 1, display: "flex", justifyContent: "flex-end", textAlign: "right" }}>
        {children}
      </Box>
    </Box>
  );
}

export function EmployeeCard({
  employee: e,
  onEdit,
}: {
  employee: Employee;
  onEdit: () => void;
}) {
  return (
    <Paper
      elevation={1}
      sx={{
        p: 3,
        borderRadius: 4,
        position: "relative",
        border: "1px solid transparent",
        transition: "all 0.2s ease-in-out",
        "&:hover": {
          transform: "translateY(-4px)",
          borderColor: "primary.main",
          boxShadow: "0 8px 24px rgba(25, 118, 210, 0.15)",
        }
      }}
    >
      <IconButton
        size="small"
        onClick={onEdit}
        sx={{
          position: "absolute",
          top: 12,
          right: 12,
          color: "text.secondary",
          "&:hover": { color: "primary.main", bgcolor: "primary.soft" }
        }}
      >
        <EditIcon fontSize="small" />
      </IconButton>

      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Avatar
          src={e.photoURL || undefined}
          sx={{
            width: 48,
            height: 48,
            fontSize: 18,
            fontWeight: 600,
            bgcolor: "accentSoft",
            color: "primary.main",
          }}
        >
          {e.name.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ minWidth: 0, pr: 3 }}>
          <Typography variant="subtitle1" noWrap sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            {e.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.5 }}>
            {e.email}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <CardRow label="Department">
          <Typography variant="body2" sx={{ fontWeight: 500, fontSize: 13 }}>
            {e.department === "custom" ? (e.customDepartment || "Custom") : (DEPARTMENTS.find(d => d.value === e.department)?.label ?? "—")}
          </Typography>
        </CardRow>

        <CardRow label="Job Title">
          <Typography variant="body2" sx={{ fontWeight: 500, fontSize: 13 }}>
            {e.jobTitle || "—"}
          </Typography>
        </CardRow>

        <CardRow label="Role/Level">
          <Typography variant="body2" sx={{ fontWeight: 500, fontSize: 13 }}>
            {e.role || "—"}
          </Typography>
        </CardRow>

        <CardRow label="Employment">
          <Typography variant="body2" sx={{ fontWeight: 500, fontSize: 13 }}>
            {EMPLOYMENT_TYPES.find((t) => t.value === e.employmentType)?.label ?? "—"}
          </Typography>
        </CardRow>

        <CardRow label="Salary (PKR)">
          <Typography variant="body2" sx={{ fontWeight: 500, fontSize: 13 }}>
            {e.monthlySalary ? e.monthlySalary.toLocaleString() : "—"}
          </Typography>
        </CardRow>

        <CardRow label="Office / Flex">
          <Typography variant="body2" sx={{ fontWeight: 500, fontSize: 13 }}>
            {e.officeHours ?? "—"} Hrs / {e.flexibilityHours ?? "—"} Flex
          </Typography>
        </CardRow>

        <CardRow label="Start Date">
          <Typography variant="body2" sx={{ fontWeight: 500, fontSize: 13 }}>
            {e.startDate || "—"}
          </Typography>
        </CardRow>

        {e.endDate && (
          <CardRow label="End Date">
            <Typography variant="body2" sx={{ fontWeight: 500, fontSize: 13 }}>
              {e.endDate}
            </Typography>
          </CardRow>
        )}

        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 1 }}>
          <PillSelect
            value={e.status}
            options={EMPLOYEE_STATUSES}
            color={EMPLOYEE_STATUS_COLORS[e.status]}
            onChange={(status: EmployeeStatus) => updateDeveloper(e.id, { status })}
          />
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12, fontWeight: 500, textTransform: "capitalize" }}>
            {e.accessLevel}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}
