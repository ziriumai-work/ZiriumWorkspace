"use client";

import { useState, useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import { useTheme } from "@mui/material/styles";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import TableChartIcon from "@mui/icons-material/TableChart";
import { downloadAttendancePdf } from "@/lib/utils/attendanceExportPdf";

import {
  type Employee,
  type AttendanceRecord,
  type DailyTask,
  type OfficeSettings,
  DEFAULT_OFFICE_SETTINGS,
} from "@/lib/data/types";
import {
  generateAttendanceExportData,
  getPascalCaseFileName,
  downloadAttendanceExcel,
} from "./attendance-export-helpers";

interface ExportAttendanceModalProps {
  open: boolean;
  onClose: () => void;
  employees: Employee[];
  allRecords: AttendanceRecord[];
  allTasks: DailyTask[];
  settings: OfficeSettings;
}

export function ExportAttendanceModal({
  open,
  onClose,
  employees,
  allRecords,
  allTasks,
  settings,
}: ExportAttendanceModalProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [selectedUid, setSelectedUid] = useState<string>("ALL");

  // Generate last 12 month strings YYYY-MM
  const availableMonths = useMemo(() => {
    const list: { key: string; label: string }[] = [];
    const d = new Date();
    for (let i = 0; i < 12; i++) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const key = `${year}-${month}`;
      const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      list.push({ key, label });
      d.setMonth(d.getMonth() - 1);
    }
    return list;
  }, []);

  const [selectedMonths, setSelectedMonths] = useState<string[]>(() => {
    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return [curMonth];
  });

  function toggleMonth(key: string) {
    if (selectedMonths.includes(key)) {
      if (selectedMonths.length > 1) {
        setSelectedMonths(selectedMonths.filter((m) => m !== key));
      }
    } else {
      setSelectedMonths([...selectedMonths, key].sort().reverse());
    }
  }

  function handleSelectQuick(count: number) {
    const subset = availableMonths.slice(0, count).map((m) => m.key);
    setSelectedMonths(subset);
  }

  // Generate full dataset across selected employees & months
  const exportData = useMemo(() => {
    return generateAttendanceExportData(
      selectedUid,
      selectedMonths,
      employees,
      allRecords,
      allTasks,
      settings,
      availableMonths
    );
  }, [
    selectedUid,
    selectedMonths,
    employees,
    allRecords,
    allTasks,
    settings,
    availableMonths,
  ]);

  // Download PDF Report directly (.pdf)
  async function downloadPDF() {
    const selectedName =
      selectedUid === "ALL"
        ? "All Employees & Interns"
        : employees.find((e) => e.uid === selectedUid || e.id === selectedUid)
            ?.name || "Employee";
    const fileName = getPascalCaseFileName(
      selectedMonths,
      "pdf",
      selectedUid,
      employees
    );
    await downloadAttendancePdf(
      exportData,
      selectedName,
      selectedMonths,
      fileName
    );
  }

  // Download Excel-compatible HTML Spreadsheet (.xls)
  function downloadExcel() {
    const selectedName =
      selectedUid === "ALL"
        ? "All Employees & Interns"
        : employees.find((e) => e.uid === selectedUid || e.id === selectedUid)
            ?.name || "Employee";
    const fileName = getPascalCaseFileName(
      selectedMonths,
      "xls",
      selectedUid,
      employees
    );
    downloadAttendanceExcel(
      exportData,
      selectedName,
      selectedMonths,
      fileName
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 4 } } }}
    >
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
        Export Attendance Sheet
      </DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 3, pt: "16px !important" }}>
        {/* Filter Employee & Months */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>
              SELECT EMPLOYEE OR INTERN
            </Typography>
            <Select
              value={selectedUid}
              onChange={(e) => setSelectedUid(e.target.value)}
              fullWidth
              size="small"
              sx={{ borderRadius: 2 }}
            >
              <MenuItem value="ALL">All Employees & Interns (Full Report)</MenuItem>
              {employees
                .filter((e) => e.uid)
                .map((e) => (
                  <MenuItem key={e.uid!} value={e.uid!}>
                    {e.name} — {e.accessLevel === "intern" ? "Intern" : "Employee"}
                  </MenuItem>
                ))}
            </Select>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>
              QUICK MONTH SELECTORS
            </Typography>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button size="small" variant="outlined" onClick={() => handleSelectQuick(1)} sx={{ borderRadius: 2 }}>
                Current Month
              </Button>
              <Button size="small" variant="outlined" onClick={() => handleSelectQuick(3)} sx={{ borderRadius: 2 }}>
                Last 3 Months
              </Button>
              <Button size="small" variant="outlined" onClick={() => handleSelectQuick(6)} sx={{ borderRadius: 2 }}>
                Last 6 Months
              </Button>
              <Button size="small" variant="outlined" onClick={() => handleSelectQuick(12)} sx={{ borderRadius: 2 }}>
                All 12 Months
              </Button>
            </Box>
          </Box>
        </Box>

        {/* Multi-Select Month Chips */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", mb: 1 }}>
            SELECT ONE OR MULTIPLE MONTHS ({selectedMonths.length} Selected)
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {availableMonths.map((m) => {
              const isSelected = selectedMonths.includes(m.key);
              return (
                <Chip
                  key={m.key}
                  label={m.label}
                  onClick={() => toggleMonth(m.key)}
                  color={isSelected ? "primary" : "default"}
                  variant={isSelected ? "filled" : "outlined"}
                  sx={{ fontWeight: isSelected ? 600 : 400, cursor: "pointer" }}
                />
              );
            })}
          </Box>
        </Box>

        <Divider />

        {/* Live Export Preview & Summary */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            📊 Overall Summary Preview Across Selected Months
          </Typography>
          <Paper
            variant="outlined"
            sx={{
              p: 2.5,
              borderRadius: 3,
              display: "grid",
              gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)", md: "repeat(6, 1fr)" },
              gap: 2,
              bgcolor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)",
            }}
          >
            <Box>
              <Typography variant="caption" color="text.secondary">Present Days</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#22c55e" }}>
                {exportData.overall.totalPresent}d
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Late Days</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#f59e0b" }}>
                {exportData.overall.totalLate}d
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Absent Days</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#ef4444" }}>
                {exportData.overall.totalAbsent}d
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Leaves Used</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#a855f7" }}>
                {exportData.overall.totalLeave}d
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Hours Worked</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {exportData.overall.totalHoursWorked}h
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Salary Deduction</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#ef4444" }}>
                {exportData.overall.totalDeductionDays}d
              </Typography>
            </Box>
          </Paper>
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          px: { xs: 2.5, sm: 3 },
          pb: { xs: 2.5, sm: 3 },
          pt: 1,
          display: "flex",
          flexDirection: { xs: "column-reverse", sm: "row" },
          gap: { xs: 1.25, sm: 1.5 },
          "& .MuiButton-root": {
            width: { xs: "100%", sm: "auto" },
            m: "0 !important",
            py: { xs: 1, sm: 0.75 },
          },
        }}
      >
        <Button onClick={onClose} sx={{ borderRadius: 3, fontWeight: 600 }}>
          Close
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={downloadPDF}
          sx={{ borderRadius: 3, fontWeight: 700, px: 3 }}
        >
          <PictureAsPdfIcon sx={{ mr: 0.8, fontSize: 18 }} />
          Download PDF
        </Button>
        <Button
          variant="outlined"
          color="primary"
          onClick={downloadExcel}
          sx={{ borderRadius: 3, fontWeight: 600 }}
        >
          <TableChartIcon sx={{ mr: 0.8, fontSize: 18 }} />
          Download Excel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
