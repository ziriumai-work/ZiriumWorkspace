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
  type EmploymentType,
} from "@/lib/data/types";

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

export default function EmployeesPage() {
  const { isAdmin } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<NewEmployee>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [developerToDelete, setDeveloperToDelete] = useState<Developer | null>(null);
  const [editForm, setEditForm] = useState<Developer | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

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
    const cleanEmail = form.email.trim().toLowerCase();
    if (employees.some(e => e.email.toLowerCase() === cleanEmail)) {
      setError("An employee with this email already exists in the system.");
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

      {/* Directory */}
      <Box sx={{ mt: 5 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Team Directory</Typography>
        {loading ? (
          <Typography variant="body2" color="text.secondary">Loading…</Typography>
        ) : employees.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No employees yet. Add your first one above.</Typography>
        ) : (
          <Grid container spacing={3}>
            {employees.map((e) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={e.id}>
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
                    onClick={() => setEditForm(e)}
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
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
      <Dialog 
        open={!!editForm} 
        onClose={() => setEditForm(null)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: { sx: { borderRadius: 4, p: 1 } },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Team Member</DialogTitle>
        <DialogContent dividers sx={{ borderBottom: "none" }}>
          {editForm && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Field label="Full name">
                  <TextField
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    fullWidth
                  />
                </Field>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Field label="Work email">
                  <TextField
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    fullWidth
                  />
                </Field>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Field label="Job title">
                  <TextField
                    value={editForm.jobTitle}
                    onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })}
                    fullWidth
                  />
                </Field>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Field label="Role (Optional)">
                  <TextField
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    fullWidth
                  />
                </Field>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Field label="Department">
                  <TextField
                    select
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value as Department })}
                    fullWidth
                  >
                    {DEPARTMENTS.map((d) => (
                      <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>
                    ))}
                  </TextField>
                </Field>
              </Grid>
              {editForm.department === "custom" && (
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Field label="Custom Department Name">
                    <TextField
                      value={editForm.customDepartment}
                      onChange={(e) => setEditForm({ ...editForm, customDepartment: e.target.value })}
                      fullWidth
                    />
                  </Field>
                </Grid>
              )}
              <Grid size={{ xs: 12, sm: 6 }}>
                <Field label="Monthly Salary (PKR)">
                  <TextField
                    type="number"
                    slotProps={{ htmlInput: { min: 0 } }}
                    value={editForm.monthlySalary ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, monthlySalary: e.target.value ? Number(e.target.value) : undefined })}
                    fullWidth
                  />
                </Field>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Field label="Weekly Office Hours">
                  <TextField
                    type="number"
                    slotProps={{ htmlInput: { min: 0 } }}
                    value={editForm.officeHours ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, officeHours: e.target.value ? Number(e.target.value) : undefined })}
                    fullWidth
                  />
                </Field>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Field label="Flexibility (Hours/week)">
                  <TextField
                    type="number"
                    slotProps={{ htmlInput: { min: 0 } }}
                    value={editForm.flexibilityHours ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, flexibilityHours: e.target.value ? Number(e.target.value) : undefined })}
                    fullWidth
                  />
                </Field>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Field label="Employment type">
                  <TextField
                    select
                    value={editForm.employmentType}
                    onChange={(e) => setEditForm({ ...editForm, employmentType: e.target.value as EmploymentType })}
                    fullWidth
                  >
                    {EMPLOYMENT_TYPES.map((t) => (
                      <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                    ))}
                  </TextField>
                </Field>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Field label="Access level">
                  <TextField
                    select
                    value={editForm.accessLevel}
                    onChange={(e) => setEditForm({ ...editForm, accessLevel: e.target.value as AccessLevel })}
                    fullWidth
                  >
                    {ACCESS_LEVELS.map((a) => (
                      <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>
                    ))}
                  </TextField>
                </Field>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0, display: "flex", justifyContent: "space-between" }}>
          <Button 
            color="error"
            onClick={() => {
              setDeveloperToDelete(editForm);
              setEditForm(null);
            }}
          >
            Remove Member
          </Button>
          <Box sx={{ display: "flex", gap: 2 }}>
            <Button onClick={() => setEditForm(null)} color="inherit">Cancel</Button>
            <Button 
              variant="contained" 
              disabled={savingEdit}
              onClick={async () => {
                if (editForm) {
                  setSavingEdit(true);
                  try {
                    const { id, ...patch } = editForm;
                    await updateDeveloper(id, patch);

                    // Sync Admin status with the strict Firebase rules database
                    if (editForm.uid && patch.accessLevel) {
                      const newRole = patch.accessLevel === "admin" ? "admin" : "member";
                      const { doc, updateDoc } = await import("firebase/firestore");
                      const { db } = await import("@/lib/firebase/client");
                      await updateDoc(doc(db, "members", editForm.uid), { role: newRole }).catch(() => {});
                    }

                    setEditForm(null);
                  } catch(e) {
                    // handle
                  } finally {
                    setSavingEdit(false);
                  }
                }
              }}
            >
              {savingEdit ? "Saving..." : "Save Changes"}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

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

function CardRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, py: 0.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13, minWidth: 90, flexShrink: 0 }}>
        {label}
      </Typography>
      <Box sx={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
        {children}
      </Box>
    </Box>
  );
}
