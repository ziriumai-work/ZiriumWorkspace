"use client";

// Employees directory. Admins add and manage employee records (which link to a
// Google login by email). Regular employees don't see this page.

import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Input from "@mui/material/Input";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import Collapse from "@mui/material/Collapse";
import FilterListIcon from "@mui/icons-material/FilterList";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { HandoverResetDialog } from "@/components/employees/HandoverResetDialog";

import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { AddEmployeeForm } from "@/components/employees/AddEmployeeForm";
import { EmployeeCard } from "@/components/employees/EmployeeCard";
import { EditEmployeeDialog } from "@/components/employees/EditEmployeeDialog";
import {
  subscribeToDevelopers,
  addDeveloper,
  deleteDeveloper,
} from "@/lib/data/developers";
import { useAuth } from "@/lib/firebase/auth-context";
import { EMPLOYEE_STATUS_COLORS } from "@/components/projectMeta";
import { PillSelect } from "@/components/ui/PillSelect";
import {
  ACCESS_LEVELS,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  EMPLOYEE_STATUSES,
  type Department,
  type Employee,
  type EmployeeStatus,
  type AccessLevel,
  type Developer,
  type EmploymentType,
} from "@/lib/data/types";


export default function EmployeesPage() {
  const { isAdmin } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [developerToDelete, setDeveloperToDelete] = useState<Developer | null>(null);
  const [editForm, setEditForm] = useState<Developer | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterRole, setFilterRole] = useState<"all" | "employee" | "intern">("all");
  const [filterPay, setFilterPay] = useState<"all" | "paid" | "unpaid">("all");
  const [filterDept, setFilterDept] = useState<string>("all");
  const [handoverOpen, setHandoverOpen] = useState(false);

  useEffect(() => {
    const unsub = subscribeToDevelopers(
      (d) => {
        setEmployees(d);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  if (!isAdmin) {
    return (
      <Box sx={{ mx: "auto", width: "100%", maxWidth: 1400, px: 4, py: 5 }}>
        <Typography variant="h1">Employees</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          You don’t have permission to manage employees. Ask an admin.
        </Typography>
      </Box>
    );
  }


  const filteredEmployees = employees.filter((e) => {
    if (filterRole !== "all" && e.accessLevel !== filterRole) return false;
    if (filterPay === "paid" && (!e.monthlySalary || e.monthlySalary <= 0)) return false;
    if (filterPay === "unpaid" && e.monthlySalary && e.monthlySalary > 0) return false;
    if (filterDept !== "all" && e.department !== filterDept) return false;
    return true;
  });

  return (
    <Box sx={{ mx: "auto", width: "100%", maxWidth: 1400, px: 4, py: 5 }}>
      <Box component="header" sx={{ mb: 3, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h1">Employees</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Add your team. Each employee signs in with the Google account matching
            their email, then sees only their assigned projects and tasks.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="error"
          size="small"
          onClick={() => setHandoverOpen(true)}
          sx={{ borderRadius: 2, fontWeight: 700, textTransform: "none" }}
        >
          🧹 Reset DB (Company Handover)
        </Button>
      </Box>

      {/* Add employee */}
      <ScrollReveal>
        <AddEmployeeForm employees={employees} onAdd={addDeveloper} />
      </ScrollReveal>

      {error && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {error}
        </Alert>
      )}

      {/* Directory */}
      <Box sx={{ mt: 5 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: showFilters ? 2 : 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Team Directory</Typography>
          <IconButton 
            onClick={() => setShowFilters(!showFilters)}
            size="small"
            sx={{ 
              bgcolor: showFilters ? "primary.main" : "transparent",
              color: showFilters ? "primary.contrastText" : "text.secondary",
              border: "1px solid",
              borderColor: showFilters ? "primary.main" : "divider",
              borderRadius: 2,
              "&:hover": {
                bgcolor: showFilters ? "primary.dark" : "action.hover",
              }
            }}
          >
            <FilterListIcon fontSize="small" />
          </IconButton>
        </Box>

        <Collapse in={showFilters}>
          <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 3, display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
            <Select
              size="small"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as any)}
              displayEmpty
              sx={{ width: 140 }}
            >
              <MenuItem value="all">All Roles</MenuItem>
              <MenuItem value="employee">Employees</MenuItem>
              <MenuItem value="intern">Interns</MenuItem>
            </Select>
            <Select
              size="small"
              value={filterPay}
              onChange={(e) => setFilterPay(e.target.value as any)}
              displayEmpty
              sx={{ width: 160 }}
            >
              <MenuItem value="all">All Pay Statuses</MenuItem>
              <MenuItem value="paid">Paid</MenuItem>
              <MenuItem value="unpaid">Unpaid</MenuItem>
            </Select>
            <Select
              size="small"
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              displayEmpty
              sx={{ width: 160 }}
            >
              <MenuItem value="all">All Departments</MenuItem>
              {DEPARTMENTS.map(d => (
                <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>
              ))}
            </Select>
          </Paper>
        </Collapse>
        {loading ? (
          <Typography variant="body2" color="text.secondary">Loading…</Typography>
        ) : filteredEmployees.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No employees match this filter.</Typography>
        ) : (
          <Grid container spacing={3}>
            {filteredEmployees.map((e) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={e.id}>
                <ScrollReveal>
                  <EmployeeCard employee={e} onEdit={() => setEditForm(e)} />
                </ScrollReveal>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
      <EditEmployeeDialog developer={editForm} onClose={() => setEditForm(null)} onRemove={(dev) => setDeveloperToDelete(dev)} />

      <ConfirmDialog
        open={!!developerToDelete}
        title="Remove Employee"
        message={`Are you sure you want to remove ${developerToDelete?.name}?`}
        type="error"
        confirmLabel="Remove"
        onConfirm={() => {
          if (developerToDelete) deleteDeveloper(developerToDelete.id);
          setDeveloperToDelete(null);
        }}
        onCancel={() => setDeveloperToDelete(null)}
      />

      <HandoverResetDialog
        open={handoverOpen}
        onClose={() => setHandoverOpen(false)}
      />
    </Box>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Box component="label" sx={{ display: "block" }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mb: 0.5, display: "block", fontSize: 11, fontWeight: 500 }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  );
}

