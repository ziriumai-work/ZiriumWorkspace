"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import {
  ACCESS_LEVELS,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  EMPLOYEE_STATUSES,
  type Department,
  type EmployeeStatus,
  type AccessLevel,
  type Employee,
} from "@/lib/data/types";
import { type NewEmployee } from "@/lib/data/developers";

const EMPTY: NewEmployee = {
  name: "",
  email: "",
  jobTitle: "",
  role: "",
  department: "web",
  customDepartment: "",
  employmentType: "full_time",
  startDate: "",
  status: "active",
  accessLevel: "employee",
};

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box component="label" sx={{ display: "block" }}>
      <Typography variant="caption" sx={{ mb: 0.5, display: "block", fontWeight: 600, color: "text.secondary" }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

export function AddEmployeeForm({
  employees,
  onAdd,
}: {
  employees: Employee[];
  onAdd: (form: NewEmployee) => Promise<unknown>;
}) {
  const [form, setForm] = useState<NewEmployee>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!form.name.trim() || !form.email.trim() || !form.startDate) {
      setError("Name, email, and start date are required.");
      return;
    }
    const cleanEmail = form.email.trim().toLowerCase();
    if (employees.some(e => e.email.toLowerCase() === cleanEmail)) {
      setError("An employee with this email already exists in the system.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onAdd(form);
      setForm(EMPTY);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add employee");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 4, bgcolor: "background.paper", backgroundImage: "linear-gradient(to right bottom, rgba(255,255,255,0.05), rgba(255,255,255,0))" }}>
        <Typography variant="h6" sx={{ mb: 3, fontWeight: 700 }}>Add New Team Member</Typography>
        <Grid container spacing={2}>
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
                value={form.jobTitle}
                onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                placeholder="e.g. Frontend Engineer"
                fullWidth
              />
            </Field>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <Field label="Role (Optional)">
              <TextField
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                fullWidth
                placeholder="e.g. Lead, Manager, MD"
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
          {form.department === "custom" && (
            <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
              <Field label="Custom Department Name">
                <TextField
                  value={form.customDepartment}
                  onChange={(e) => setForm({ ...form, customDepartment: e.target.value })}
                  placeholder="e.g. Finance"
                  fullWidth
                />
              </Field>
            </Grid>
          )}
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <Field label="Monthly Salary (PKR)">
              <TextField
                type="number"
                slotProps={{ htmlInput: { min: 0 } }}
                value={form.monthlySalary ?? ""}
                onChange={(e) => setForm({ ...form, monthlySalary: e.target.value ? Number(e.target.value) : undefined })}
                fullWidth
              />
            </Field>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <Field label="Weekly Office Hours">
              <TextField
                type="number"
                slotProps={{ htmlInput: { min: 0 } }}
                value={form.officeHours ?? ""}
                onChange={(e) => setForm({ ...form, officeHours: e.target.value ? Number(e.target.value) : undefined })}
                fullWidth
              />
            </Field>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <Field label="Flexibility (Hours/week)">
              <TextField
                type="number"
                slotProps={{ htmlInput: { min: 0 } }}
                value={form.flexibilityHours ?? ""}
                onChange={(e) => setForm({ ...form, flexibilityHours: e.target.value ? Number(e.target.value) : undefined })}
                fullWidth
              />
            </Field>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <Field label="Start Date *">
              <TextField
                type="date"
                value={form.startDate || ""}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
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
              sx={{
                py: 1.2,
                borderRadius: 2,
                background: "linear-gradient(45deg, #1976d2, #42a5f5)",
                fontWeight: 600,
                boxShadow: "0 4px 14px 0 rgba(25, 118, 210, 0.39)",
                "&:hover": {
                  background: "linear-gradient(45deg, #1565c0, #1e88e5)",
                },
              }}
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
    </>
  );
}
