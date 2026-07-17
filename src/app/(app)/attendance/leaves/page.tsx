"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  CircularProgress,
  LinearProgress,
  IconButton,
  Collapse,
  MenuItem,
  Select,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import FilterListIcon from "@mui/icons-material/FilterList";
import { Toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/lib/firebase/auth-context";
import {
  subscribeToAllLeaveRequests,
  subscribeToMyLeaveRequests,
  submitLeaveRequest,
  updateLeaveRequestStatus,
} from "@/lib/data/leaves";
import { subscribeToDevelopers } from "@/lib/data/developers";
import { markAttendance } from "@/lib/data/attendance";
import type { LeaveRequest, Developer } from "@/lib/data/types";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { DEFAULT_OFFICE_SETTINGS, type OfficeSettings } from "@/lib/data/types";
import { uploadLeaveProof } from "@/lib/firebase/storage";

export default function LeavesPage() {
  const { user, employee, isAdmin, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Developer[]>([]);
  const [settings, setSettings] = useState<OfficeSettings>(DEFAULT_OFFICE_SETTINGS);
  
  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("");

  const filteredRequests = useMemo(() => {
    let res = requests;
    if (isAdmin && filterEmployee !== "all") {
      res = res.filter(r => r.uid === filterEmployee || r.employeeName === filterEmployee);
    }
    if (filterDate) {
      res = res.filter(r => r.dates.includes(filterDate));
    }
    return res;
  }, [requests, filterEmployee, filterDate, isAdmin]);
  
  // Dialog state
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [newDate, setNewDate] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [confirmData, setConfirmData] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsubSettings = onSnapshot(doc(db, "settings", "office"), (doc) => {
      if (doc.exists()) setSettings(doc.data() as OfficeSettings);
    });
    return unsubSettings;
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    const unsubEmployees = subscribeToDevelopers(setEmployees);
    return unsubEmployees;
  }, [isAdmin]);

  useEffect(() => {
    if (!user) return;
    if (role === null) return;
    
    const handleError = (err: Error) => {
      console.error("Leaves error:", err);
      setLoading(false);
    };

    const unsub = isAdmin
      ? subscribeToAllLeaveRequests((r) => { setRequests(r); setLoading(false); }, handleError)
      : subscribeToMyLeaveRequests(user.uid, (r) => { setRequests(r); setLoading(false); }, handleError);
      
    return unsub;
  }, [user, isAdmin, role]);

  const handleAddDate = () => {
    if (newDate && !dates.includes(newDate)) {
      setDates([...dates, newDate].sort());
    }
    setNewDate("");
  };

  const handleRemoveDate = (d: string) => {
    setDates(dates.filter(x => x !== d));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
  };

  const handleSubmit = async () => {
    if (!user) return;
    
    if (dates.length === 0) {
      setToastType("error");
      setToastMsg("Please select at least one date for your sick leave.");
      return;
    }
    
    if (!reason.trim()) {
      setToastType("error");
      setToastMsg("Please provide a reason for your sick leave.");
      return;
    }
    
    if (files.length === 0) {
      setToastType("error");
      setToastMsg("Please attach a proof document for your sick leave.");
      return;
    }

    setSubmitting(true);
    try {
      const proofUrls = [];
      for (const file of files) {
        const uploaded = await uploadLeaveProof(user.uid, file);
        proofUrls.push(uploaded.url);
      }
      await submitLeaveRequest(user.uid, employee?.name || user.displayName || "Unknown", dates, reason, proofUrls);
      setOpen(false);
      setReason("");
      setDates([]);
      setFiles([]);
      setToastType("success");
      setToastMsg("Leave request submitted successfully.");
    } catch (e) {
      console.error(e);
      setToastType("error");
      setToastMsg("Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  const executeApprove = async (req: LeaveRequest) => {
    try {
      // Create attendance records
      for (const d of req.dates) {
        await markAttendance(req.uid, req.employeeName, d, "sick_leave", settings, null, null);
      }
      await updateLeaveRequestStatus(req.id, "approved");
      setToastType("success");
      setToastMsg("Leave approved successfully.");
    } catch (e) {
      console.error(e);
      setToastType("error");
      setToastMsg("Failed to approve leave.");
    }
  };

  const handleApprove = (req: LeaveRequest) => {
    setConfirmData({
      title: "Approve Leave",
      message: `Are you sure you want to approve leave for ${req.employeeName}?`,
      onConfirm: () => executeApprove(req),
    });
  };

  const executeReject = async (req: LeaveRequest) => {
    try {
      await updateLeaveRequestStatus(req.id, "rejected");
      setToastType("success");
      setToastMsg("Leave rejected.");
    } catch (e) {
      console.error(e);
      setToastType("error");
      setToastMsg("Failed to reject leave.");
    }
  };

  const handleReject = (req: LeaveRequest) => {
    setConfirmData({
      title: "Reject Leave",
      message: `Are you sure you want to reject leave for ${req.employeeName}?`,
      onConfirm: () => executeReject(req),
    });
  };

  if (loading) {
    return <Box sx={{ p: 4 }}><CircularProgress size={20}/></Box>;
  }

  return (
    <Box sx={{ px: { xs: 2, sm: 4 }, py: 4, maxWidth: 1000, mx: "auto" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 4 }}>
        <Box>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            Sick Leaves
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {isAdmin ? "Manage employee sick leave requests." : "Request sick leaves and track status."}
          </Typography>
        </Box>
        {!isAdmin && (
          <Button variant="contained" onClick={() => setOpen(true)} sx={{ borderRadius: 3 }}>
            Request Leave
          </Button>
        )}
      </Box>

      {/* Filter Toggle */}
      <Box sx={{ display: "flex", justifyContent: "flex-start", mb: showFilters ? 2 : 3 }}>
        <IconButton 
          onClick={() => setShowFilters(!showFilters)}
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
          <FilterListIcon />
        </IconButton>
      </Box>

      {/* Filters Form */}
      <Collapse in={showFilters}>
        <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 3, display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
          {isAdmin && (
            <Select
              size="small"
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value as string)}
              displayEmpty
              sx={{ width: 200 }}
            >
              <MenuItem value="all">All Employees</MenuItem>
              {employees.map(e => (
                <MenuItem key={e.id} value={e.uid || e.name}>{e.name}</MenuItem>
              ))}
            </Select>
          )}
          <TextField
            size="small"
            type="date"
            label="Filter by Date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 160 }}
          />
          {(filterDate || filterEmployee !== "all") && (
            <Button size="small" onClick={() => {
              setFilterDate("");
              setFilterEmployee("all");
            }}>Clear Filters</Button>
          )}
        </Paper>
      </Collapse>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {filteredRequests.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 4, textAlign: "center", borderRadius: 3, borderStyle: "dashed" }}>
            <Typography variant="body2" color="text.secondary">
              No leave requests found.
            </Typography>
          </Paper>
        ) : (
          filteredRequests.map(req => {
            const senderEmployee = employees.find(e => e.uid === req.uid || e.name === req.employeeName);
            return (
            <Paper key={req.id} variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2 }}>
                <Box>
                  {isAdmin && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: "text.primary", letterSpacing: "-0.02em" }}>
                        {req.employeeName}
                      </Typography>
                      {senderEmployee && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                          <Chip 
                            size="small" 
                            label={senderEmployee.accessLevel.toUpperCase()} 
                            sx={{ 
                              fontSize: 10, 
                              fontWeight: 700, 
                              height: 20, 
                              bgcolor: senderEmployee.accessLevel === "intern" ? "rgba(251, 191, 36, 0.15)" : "rgba(96, 165, 250, 0.15)",
                              color: senderEmployee.accessLevel === "intern" ? "#fbbf24" : "#60a5fa",
                            }} 
                          />
                          {(senderEmployee.jobTitle || senderEmployee.role) && (
                            <Typography variant="caption" sx={{ color: "grey.500", fontWeight: 600 }}>
                              {senderEmployee.jobTitle || senderEmployee.role}
                            </Typography>
                          )}
                        </Box>
                      )}
                    </Box>
                  )}
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
                    {req.dates.map(d => (
                      <Chip key={d} label={d} size="small" variant="outlined" />
                    ))}
                  </Box>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    <strong>Reason:</strong> <span style={{ color: "#9ca3af", fontStyle: "italic" }}>{req.reason}</span>
                  </Typography>
                  {req.proofUrls.length > 0 && (
                    <Box sx={{ mt: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
                      {req.proofUrls.map((url, i) => (
                        <Button key={i} size="small" variant="outlined" component="a" href={url} target="_blank" startIcon={<AttachFileIcon />}>
                          Attachment {i + 1}
                        </Button>
                      ))}
                    </Box>
                  )}
                </Box>
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                  <Chip 
                    label={req.status.toUpperCase()} 
                    size="small"
                    sx={{ 
                      fontWeight: 600,
                      bgcolor: req.status === "approved" ? "#22c55e22" : req.status === "rejected" ? "#ef444422" : "#f59e0b22",
                      color: req.status === "approved" ? "#22c55e" : req.status === "rejected" ? "#ef4444" : "#f59e0b"
                    }} 
                  />
                  {isAdmin && req.status === "pending" && (
                    <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                      <Button size="small" variant="contained" color="success" onClick={() => handleApprove(req)}>Approve</Button>
                      <Button size="small" variant="contained" color="error" onClick={() => handleReject(req)}>Reject</Button>
                    </Box>
                  )}
                </Box>
              </Box>
            </Paper>
            );
          })
        )}
      </Box>

      {/* Request Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Request Sick Leave</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", gap: 1, mt: 1, mb: 2 }}>
            <TextField
              size="small"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Button variant="outlined" onClick={handleAddDate} disabled={!newDate}>Add Date</Button>
          </Box>
          {dates.length > 0 && (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 3 }}>
              {dates.map(d => (
                <Chip key={d} label={d} onDelete={() => handleRemoveDate(d)} />
              ))}
            </Box>
          )}

          <TextField
            label="Reason"
            multiline
            rows={3}
            fullWidth
            value={reason}
            onChange={e => setReason(e.target.value)}
            sx={{ mb: 3 }}
          />

          {submitting && <LinearProgress sx={{ mb: 2 }} />}
          <Button component="label" variant="outlined" startIcon={<AttachFileIcon />} sx={{ mb: 1 }}>
            Attach Proof
            <input type="file" multiple hidden onChange={handleFileChange} disabled={submitting} />
          </Button>
          {files.length > 0 && (
            <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 1 }}>
              {files.map((file, i) => (
                <Box key={i} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 1, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                  <Typography variant="caption" noWrap sx={{ maxWidth: 300 }}>{file.name}</Typography>
                  <IconButton size="small" onClick={() => handleRemoveFile(i)} disabled={submitting}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit"}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!confirmData}
        title={confirmData?.title || ""}
        message={confirmData?.message || ""}
        onConfirm={() => {
          confirmData?.onConfirm();
          setConfirmData(null);
        }}
        onCancel={() => setConfirmData(null)}
      />

      <Toast
        open={!!toastMsg}
        message={toastMsg || ""}
        type={toastType}
        onClose={() => setToastMsg(null)}
      />
    </Box>
  );
}
