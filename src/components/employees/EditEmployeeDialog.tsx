"use client";

import { useState, useEffect } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";

import {
  ACCESS_LEVELS,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  EMPLOYEE_STATUSES,
  type Department,
  type EmployeeStatus,
  type AccessLevel,
  type EmploymentType,
  type Developer,
} from "@/lib/data/types";
import { updateDeveloper } from "@/lib/data/developers";
import { Field } from "./AddEmployeeForm";

export function EditEmployeeDialog({
  developer,
  onClose,
  onRemove,
}: {
  developer: Developer | null;
  onClose: () => void;
  onRemove: (developer: Developer) => void;
}) {
  const [editForm, setEditForm] = useState<Developer | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (developer) {
      setEditForm({ ...developer });
    } else {
      setEditForm(null);
    }
  }, [developer]);

  async function handleSave() {
    if (!editForm) return;
    setSavingEdit(true);
    try {
      // Exclude id and createdAt — they are not updatable fields.
      const { id, createdAt, ...patch } = editForm as Developer & { createdAt?: unknown };

      // Strip undefined values to avoid Firestore rejecting the update.
      const cleanPatch = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined)
      ) as Partial<Omit<Developer, "id" | "createdAt">>;

      await updateDeveloper(id, cleanPatch);

      // Sync member role when accessLevel changes.
      if (editForm.uid && cleanPatch.accessLevel) {
        const newRole = cleanPatch.accessLevel === "admin" ? "owner" : "member";
        const { doc, updateDoc } = await import("firebase/firestore");
        const { db } = await import("@/lib/firebase/client");
        await updateDoc(doc(db, "members", editForm.uid), { role: newRole }).catch(() => {});
      }

      onClose();
    } catch (e) {
      console.error("Edit save error:", e);
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <Dialog
      open={!!developer}
      onClose={onClose}
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
                    value={editForm.customDepartment || ""}
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
              <Field label="Start Date">
                <TextField
                  type="date"
                  value={editForm.startDate || ""}
                  onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                />
              </Field>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Field label="End Date">
                <TextField
                  type="date"
                  value={editForm.endDate || ""}
                  onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                />
              </Field>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Field label="Status">
                <TextField
                  select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as EmployeeStatus })}
                  fullWidth
                >
                  {EMPLOYEE_STATUSES.map((s) => (
                    <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
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
            if (editForm) {
              onRemove(editForm);
              onClose();
            }
          }}
        >
          Remove Member
        </Button>
        <Box sx={{ display: "flex", gap: 2 }}>
          <Button onClick={onClose} color="inherit">Cancel</Button>
          <Button
            variant="contained"
            disabled={savingEdit || !editForm}
            onClick={handleSave}
          >
            {savingEdit ? "Saving..." : "Save Changes"}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
