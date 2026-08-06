import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import { StatCard } from "./StatCard";
import { formatHoursMinutes } from "./attendance-utils";
import { type Employee } from "@/lib/data/types";

interface EmployeeStatsDashboardProps {
  myStats: {
    totalWeeklyHours: number;
    requiredHours: number;
    remainingHours: number;
    flexRemaining: number;
    allowedFlex: number;
    latesAllowed: number;
    leavesAllowed: number;
    rolloverLeaves?: number;
    monthlyLates: number;
    monthlyLeaves: number;
    monthlySickLeaves: number;
    isPenaltyActive: boolean;
  };
  employee: Employee | null;
}

export function EmployeeStatsDashboard({ myStats, employee }: EmployeeStatsDashboardProps) {
  if (!myStats) return null;

  return (
    <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 4 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
        My Statistics
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 2, mt: 2 }}>
        <StatCard 
          label={`Total Weekly Hours (Target: ${formatHoursMinutes(myStats.requiredHours)})`} 
          value={formatHoursMinutes(myStats.totalWeeklyHours)} 
          color="#3b82f6" 
        />
        <StatCard 
          label="Weekly Hours Remaining" 
          value={myStats.remainingHours <= 0 ? "0h 0m" : formatHoursMinutes(myStats.remainingHours)} 
          color={myStats.remainingHours > 0 ? "#f97316" : "#22c55e"} 
        />
        <StatCard 
          label="Flexibility Remaining" 
          value={myStats.flexRemaining <= 0 ? "0h 0m" : formatHoursMinutes(myStats.flexRemaining / 60)} 
          color={myStats.flexRemaining >= 0 ? "#3b82f6" : "#ef4444"} 
        />
        <StatCard 
          label={`Lates (Max: ${myStats.latesAllowed})`} 
          value={myStats.monthlyLates} 
          color={myStats.monthlyLates > myStats.latesAllowed ? "#ef4444" : "#22c55e"} 
        />
        <StatCard 
          label={`Leaves (Max: ${myStats.leavesAllowed})`} 
          value={myStats.monthlyLeaves} 
          color={myStats.monthlyLeaves > myStats.leavesAllowed ? "#ef4444" : "#22c55e"} 
        />
        <StatCard 
          label={`Sick Leaves`} 
          value={myStats.monthlySickLeaves} 
          color="#ec4899" 
        />
      </Box>
      <Divider sx={{ my: 2 }} />
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" }}>
        <Typography variant="body2" color="text.secondary">
          Total Weekly Hours Required: <strong>{myStats.requiredHours}h</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Allowed Flexibility: <strong>{formatHoursMinutes(myStats.allowedFlex / 60)}</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Monthly Lates Threshold: <strong>{myStats.latesAllowed} days</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Leaves Threshold: <strong>{myStats.leavesAllowed} days{myStats.rolloverLeaves ? ` (+${myStats.rolloverLeaves} roll)` : ""}</strong>
        </Typography>
      </Box>

      {/* Warning chips if penalty conditions active */}
      <Box sx={{ display: "flex", gap: 1, mt: 2, flexWrap: "wrap" }}>
        {myStats.isPenaltyActive && (
          <Chip
            size="small"
            label="50% Salary Deduction Active (Exhausted Flexibility & Max Lates)"
            sx={{ bgcolor: "#ef444422", color: "#ef4444", fontWeight: 700, fontSize: 12 }}
          />
        )}
        {!myStats.isPenaltyActive && myStats.monthlyLates > myStats.latesAllowed && myStats.remainingHours === 0 && (
          <Chip
            size="small"
            label="Penalty Averted (Compensated Weekly Hours)"
            sx={{ bgcolor: "#22c55e22", color: "#22c55e", fontWeight: 700, fontSize: 12 }}
          />
        )}
      </Box>
    </Paper>
  );
}
