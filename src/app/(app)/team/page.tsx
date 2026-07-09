"use client";

// Employees directory. Admins add and manage employee records (which link to a
// Google login by email). Regular employees don't see this page.

import { useEffect, useState } from "react";
import {
  subscribeToDevelopers,
  addDeveloper,
  updateDeveloper,
  deleteDeveloper,
  type NewEmployee,
} from "@/lib/developers";
import { useAuth } from "@/lib/auth-context";
import {
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  EMPLOYEE_STATUSES,
  type Department,
  type Employee,
  type EmployeeStatus,
  type EmploymentType,
  type AccessLevel,
} from "@/lib/types";

const STATUS_BADGE: Record<EmployeeStatus, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  on_leave:
    "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  terminated: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

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
      <div className="mx-auto w-full max-w-3xl px-8 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
        <p className="mt-2 text-sm text-muted">
          You don’t have permission to manage employees. Ask an admin.
        </p>
      </div>
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
    <div className="mx-auto w-full max-w-5xl px-8 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
        <p className="mt-1 text-sm text-muted">
          Add your team. Each employee signs in with the Google account matching
          their email, then sees only their assigned projects and tasks.
        </p>
      </header>

      {/* Add employee */}
      <div className="grid grid-cols-1 gap-2 rounded-xl border border-border p-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Full name *">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
        </Field>
        <Field label="Work email *">
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
        </Field>
        <Field label="Job title">
          <input
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            placeholder="e.g. Frontend Engineer"
            className="w-full rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
        </Field>
        <Field label="Department">
          <select
            value={form.department}
            onChange={(e) =>
              setForm({ ...form, department: e.target.value as Department })
            }
            className="w-full rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
          >
            {DEPARTMENTS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Employment type">
          <select
            value={form.employmentType}
            onChange={(e) =>
              setForm({
                ...form,
                employmentType: e.target.value as EmploymentType,
              })
            }
            className="w-full rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
          >
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Start date">
          <input
            type="date"
            value={form.startDate ?? ""}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className="w-full rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
        </Field>
        <Field label="Status">
          <select
            value={form.status}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value as EmployeeStatus })
            }
            className="w-full rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
          >
            {EMPLOYEE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Access level">
          <select
            value={form.accessLevel}
            onChange={(e) =>
              setForm({ ...form, accessLevel: e.target.value as AccessLevel })
            }
            className="w-full rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
          >
            <option value="employee">Employee</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <div className="flex items-end">
          <button
            onClick={add}
            disabled={saving}
            className="w-full rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add employee"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {/* Directory */}
      <div className="mt-6 overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-xs text-muted">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Dept</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Start</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Access</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-sm text-muted">
                  Loading…
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-sm text-muted">
                  No employees yet. Add your first one above.
                </td>
              </tr>
            ) : (
              employees.map((e) => (
                <tr
                  key={e.id}
                  className="group border-b border-border last:border-0 hover:bg-surface"
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                        {e.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{e.name}</p>
                        <p className="truncate text-[11px] text-muted">
                          {e.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted">{e.role || "—"}</td>
                  <td className="px-3 py-2">
                    <select
                      value={e.department}
                      onChange={(ev) =>
                        updateDeveloper(e.id, {
                          department: ev.target.value as Department,
                        })
                      }
                      className="rounded-md border border-border bg-transparent px-1.5 py-0.5 text-xs outline-none"
                    >
                      {DEPARTMENTS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {EMPLOYMENT_TYPES.find((t) => t.value === e.employmentType)
                      ?.label ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {e.startDate || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={e.status}
                      onChange={(ev) =>
                        updateDeveloper(e.id, {
                          status: ev.target.value as EmployeeStatus,
                        })
                      }
                      className={`cursor-pointer rounded-full border-0 px-2 py-0.5 text-[11px] font-medium outline-none ${STATUS_BADGE[e.status]}`}
                    >
                      {EMPLOYEE_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={e.accessLevel}
                      onChange={(ev) =>
                        updateDeveloper(e.id, {
                          accessLevel: ev.target.value as AccessLevel,
                        })
                      }
                      className="rounded-md border border-border bg-transparent px-1.5 py-0.5 text-xs outline-none"
                    >
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${e.name}?`)) deleteDeveloper(e.id);
                      }}
                      className="rounded px-2 py-1 text-xs text-muted opacity-0 transition hover:text-red-600 group-hover:opacity-100"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
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
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
