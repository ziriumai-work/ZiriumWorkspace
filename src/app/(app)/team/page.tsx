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
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  subscribeToDevelopers,
  addDeveloper,
  updateDeveloper,
  deleteDeveloper,
  type NewEmployee,
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
} from "@/lib/data/types";

const EMPTY: NewEmployee = {
  name: "",
  email: "",
  role: "",
  department: "web",
  employmentType: "full_time",
  startDate: "",
  status: "active",
  accessLevel: "employee",
};

export default function EmployeesPage() {
  const { isAdmin } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<NewEmployee>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [developerToDelete, setDeveloperToDelete] = useState<Developer | null>(null);

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
      <Box sx={{ mx: "auto", width: "100%", maxWidth: 720, px: 4, py: 5 }}>
        <Typography variant="h1">Employees</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          You don’t have permission to manage employees. Ask an admin.
        </Typography>
      </Box>
    );
  }

  async function add() {
    if (!form.name.trim() || !form.email.trim()) {
      setError("Name and email are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addDeveloper(form);
      setForm(EMPTY);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add employee");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box sx={{ mx: "auto", width: "100%", maxWidth: 1000, px: 4, py: 5 }}>
      <Box component="header" sx={{ mb: 3 }}>
        <Typography variant="h1">Employees</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Add your team. Each employee signs in with the Google account matching
          their email, then sees only their assigned projects and tasks.
        </Typography>
      </Box>

      {/* Add employee */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <Field label="Full name *">
              <TextField
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                fullWidth
              />
            </Field>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <Field label="Work email *">
              <TextField
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                fullWidth
              />
            </Field>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <Field label="Job title">
              <TextField
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                placeholder="e.g. Frontend Engineer"
                fullWidth
              />
            </Field>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <Field label="Department">
              <TextField
                select
                value={form.department}
                onChange={(e) =>
                  setForm({ ...form, department: e.target.value as Department })
                }
                fullWidth
              >
                {DEPARTMENTS.map((d) => (
                  <MenuItem key={d.value} value={d.value}>
                    {d.label}
                  </MenuItem>
                ))}
              </TextField>
            </Field>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <Field label="Employment type">
              <TextField
                select
                value={form.employmentType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    employmentType: e.target
                      .value as NewEmployee["employmentType"],
                  })
                }
                fullWidth
              >
                {EMPLOYMENT_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>
                    {t.label}
                  </MenuItem>
                ))}
              </TextField>
            </Field>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <Field label="Start date">
              <TextField
                type="date"
                value={form.startDate ?? ""}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                fullWidth
              />
            </Field>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <Field label="Status">
              <TextField
                select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as EmployeeStatus })
                }
                fullWidth
              >
                {EMPLOYEE_STATUSES.map((s) => (
                  <MenuItem key={s.value} value={s.value}>
                    {s.label}
                  </MenuItem>
                ))}
              </TextField>
            </Field>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <Field label="Access level">
              <TextField
                select
                value={form.accessLevel}
                onChange={(e) =>
                  setForm({
                    ...form,
                    accessLevel: e.target.value as AccessLevel,
                  })
                }
                fullWidth
              >
                {ACCESS_LEVELS.map((a) => (
                  <MenuItem key={a.value} value={a.value}>
                    {a.label}
                  </MenuItem>
                ))}
              </TextField>
            </Field>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }} sx={{ display: "flex", alignItems: "flex-end" }}>
            <Button
              onClick={add}
              disabled={saving}
              variant="contained"
              fullWidth
            >
              {saving ? "Adding…" : "Add employee"}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {error}
        </Alert>
      )}

      {/* Directory */}
      <Paper variant="outlined" sx={{ mt: 3, borderRadius: 3, overflowX: "auto" }}>
        <Table sx={{ minWidth: 760 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: "surface" }}>
              <TableCell>Name</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Dept</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Start</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Access</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography variant="body2" color="text.secondary">
                    Loading…
                  </Typography>
                </TableCell>
              </TableRow>
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography variant="body2" color="text.secondary">
                    No employees yet. Add your first one above.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              employees.map((e) => (
                <TableRow
                  key={e.id}
                  hover
                  sx={{
                    "& .row-actions": { opacity: 0 },
                    "&:hover .row-actions": { opacity: 1 },
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Avatar
                        sx={{
                          width: 28,
                          height: 28,
                          fontSize: 12,
                          fontWeight: 600,
                          bgcolor: "accentSoft",
                          color: "primary.main",
                        }}
                      >
                        {e.name.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                          {e.name}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          noWrap
                          sx={{ display: "block", fontSize: 11 }}
                        >
                          {e.email}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>
                    {e.role || "—"}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={e.department}
                      onChange={(ev) =>
                        updateDeveloper(e.id, {
                          department: ev.target.value as Department,
                        })
                      }
                      variant="standard"
                      disableUnderline
                      sx={{ fontSize: 12 }}
                    >
                      {DEPARTMENTS.map((d) => (
                        <MenuItem key={d.value} value={d.value}>
                          {d.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell sx={{ color: "text.secondary", fontSize: 12 }}>
                    {EMPLOYMENT_TYPES.find((t) => t.value === e.employmentType)
                      ?.label ?? "—"}
                  </TableCell>
                  <TableCell sx={{ color: "text.secondary", fontSize: 12 }}>
                    {e.startDate || "—"}
                  </TableCell>
                  <TableCell>
                    <PillSelect
                      value={e.status}
                      options={EMPLOYEE_STATUSES}
                      color={EMPLOYEE_STATUS_COLORS[e.status]}
                      onChange={(status: EmployeeStatus) =>
                        updateDeveloper(e.id, { status })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={e.accessLevel}
                      onChange={(ev) =>
                        updateDeveloper(e.id, {
                          accessLevel: ev.target.value as AccessLevel,
                        })
                      }
                      variant="standard"
                      disableUnderline
                      sx={{ fontSize: 12 }}
                    >
                      {ACCESS_LEVELS.map((a) => (
                        <MenuItem key={a.value} value={a.value}>
                          {a.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      className="row-actions"
                      size="small"
                      color="inherit"
                      onClick={() => setDeveloperToDelete(e)}
                      sx={{
                        fontSize: 12,
                        fontWeight: 400,
                        color: "text.secondary",
                        transition: "opacity 0.15s",
                        "&:hover": { color: "error.main" },
                      }}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>
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
