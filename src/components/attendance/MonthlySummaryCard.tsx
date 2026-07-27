import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import { red, amber, green, purple, pink } from "@/lib/theme/colors";
import { StatCard } from "./StatCard";
import { formatHoursMinutes } from "./attendance-utils";

interface MonthlySummaryCardProps {
  summaryMonth: string;
  setSummaryMonth: (val: string) => void;
  summary: {
    totalPresent: number;
    totalLate: number;
    totalLeaves: number;
    totalSickLeaves: number;
    totalAbsent: number;
    totalHoursWorked: number;
    totalOvertimeMinutes: number;
    lateDaysOverThreshold: number;
    excessLeaves: number;
    deductionDays: number;
    overtimeDueMinutes?: number;
  };
  isAdmin: boolean;
  filterUid: string;
  isTargetIntern: boolean;
}

export function MonthlySummaryCard({
  summaryMonth,
  setSummaryMonth,
  summary,
  isAdmin,
  filterUid,
  isTargetIntern,
}: MonthlySummaryCardProps) {
  return (
    <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Monthly Summary
        </Typography>
        <TextField
          type="month"
          value={summaryMonth}
          onChange={(e) => setSummaryMonth(e.target.value)}
          size="small"
          sx={{
            width: 180,
            "& .MuiOutlinedInput-root": {
              borderRadius: 3,
              transition: "all 0.2s ease-in-out",
              bgcolor: "background.paper",
              "&:hover": {
                boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.08)",
              },
              "&.Mui-focused": {
                boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.15)",
              },
            },
          }}
        />
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(2, 1fr)",
            sm: "repeat(3, 1fr)",
            md: "repeat(5, 1fr)",
          },
          gap: 2,
        }}
      >
        <StatCard label="Present" value={summary.totalPresent} color={green.main} />
        <StatCard label="Late" value={summary.totalLate} color={amber.main} />
        <StatCard label="Leaves" value={summary.totalLeaves} color={purple.main} />
        <StatCard label="Sick Leaves" value={summary.totalSickLeaves} color={pink.main} />
        <StatCard label="Absent" value={summary.totalAbsent} color={red.main} />
      </Box>
      <Divider sx={{ my: 2 }} />
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" }}>
        <Typography variant="body2" color="text.secondary">
          Total Hours: <strong>{formatHoursMinutes(summary.totalHoursWorked)}</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Overtime: <strong>{formatHoursMinutes(summary.totalOvertimeMinutes / 60)}</strong>
        </Typography>
        
        {isAdmin && filterUid === "all" ? (
          <>
            {summary.lateDaysOverThreshold > 0 && (
              <Chip
                size="small"
                label={`${summary.lateDaysOverThreshold} late day${summary.lateDaysOverThreshold > 1 ? "s" : ""} → 50% deduction each`}
                sx={{ bgcolor: `${red.main}22`, color: red.main, fontWeight: 600, fontSize: 11 }}
              />
            )}
            {summary.excessLeaves > 0 && (
              <Chip
                size="small"
                label={`${summary.excessLeaves} excess leave${summary.excessLeaves > 1 ? "s" : ""}`}
                sx={{ bgcolor: `${amber.main}22`, color: amber.main, fontWeight: 600, fontSize: 11 }}
              />
            )}
            {summary.deductionDays > 0 && (
              <Chip
                size="small"
                label={`Total deduction: ${summary.deductionDays} day${summary.deductionDays > 1 ? "s" : ""} salary`}
                sx={{ bgcolor: `${red.main}22`, color: red.main, fontWeight: 700, fontSize: 12 }}
              />
            )}
            {summary.overtimeDueMinutes !== undefined && summary.overtimeDueMinutes > 0 && (
              <Chip
                size="small"
                label={`Intern Overtime Due: ${formatHoursMinutes(summary.overtimeDueMinutes / 60)}`}
                sx={{ bgcolor: `${red.main}22`, color: red.main, fontWeight: 700, fontSize: 12 }}
              />
            )}
            {summary.deductionDays === 0 && (!summary.overtimeDueMinutes || summary.overtimeDueMinutes === 0) && summary.totalPresent > 0 && (
              <Chip
                size="small"
                label="No deductions ✓"
                sx={{ bgcolor: `${green.main}22`, color: green.main, fontWeight: 600, fontSize: 11 }}
              />
            )}
          </>
        ) : isTargetIntern ? (
          <>
            {summary.overtimeDueMinutes !== undefined && summary.overtimeDueMinutes > 0 ? (
              <Chip
                size="small"
                label={`Overtime Due: ${formatHoursMinutes(summary.overtimeDueMinutes / 60)}`}
                sx={{ bgcolor: `${red.main}22`, color: red.main, fontWeight: 700, fontSize: 12 }}
              />
            ) : (
              <Chip
                size="small"
                label="No Pending Overtime ✓"
                sx={{ bgcolor: `${green.main}22`, color: green.main, fontWeight: 600, fontSize: 11 }}
              />
            )}
          </>
        ) : (
          <>
            {summary.lateDaysOverThreshold > 0 && (
              <Chip
                size="small"
                label={`${summary.lateDaysOverThreshold} late day${summary.lateDaysOverThreshold > 1 ? "s" : ""} → 50% deduction each`}
                sx={{ bgcolor: `${red.main}22`, color: red.main, fontWeight: 600, fontSize: 11 }}
              />
            )}
            {summary.excessLeaves > 0 && (
              <Chip
                size="small"
                label={`${summary.excessLeaves} excess leave${summary.excessLeaves > 1 ? "s" : ""}`}
                sx={{ bgcolor: `${amber.main}22`, color: amber.main, fontWeight: 600, fontSize: 11 }}
              />
            )}
            {summary.deductionDays > 0 && (
              <Chip
                size="small"
                label={`Total deduction: ${summary.deductionDays} day${summary.deductionDays > 1 ? "s" : ""} salary`}
                sx={{ bgcolor: `${red.main}22`, color: red.main, fontWeight: 700, fontSize: 12 }}
              />
            )}
            {summary.deductionDays === 0 && summary.totalPresent > 0 && (
              <Chip
                size="small"
                label="No deductions ✓"
                sx={{ bgcolor: `${green.main}22`, color: green.main, fontWeight: 600, fontSize: 11 }}
              />
            )}
          </>
        )}
      </Box>
    </Paper>
  );
}
