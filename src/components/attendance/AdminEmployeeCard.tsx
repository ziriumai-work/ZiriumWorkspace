import { useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { ATTENDANCE_STATUSES, type AttendanceRecord, type DailyTask, type Employee } from "@/lib/data/types";
import { STATUS_COLORS, calcHours, fmtTime } from "./attendance-utils";

export function AdminEmployeeCard({
  employee,
  todayRecord,
  monthRecords,
  monthTasks,
  onMarkAttendance,
}: {
  employee: Employee;
  todayRecord: AttendanceRecord | null;
  monthRecords: AttendanceRecord[];
  monthTasks: DailyTask[];
  onMarkAttendance: (uid: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Paper 
      variant="outlined" 
      sx={{ 
        p: { xs: 2, sm: 3 }, 
        borderRadius: 4, 
        display: "flex", 
        flexDirection: "column", 
        gap: { xs: 1.5, sm: 2 },
        transition: "all 0.2s ease-in-out",
        "&:hover": {
          boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
          borderColor: "primary.main",
          transform: "translateY(-2px)"
        }
      }}
    >
      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: { xs: 1.5, sm: 2 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1.5, sm: 2 } }}>
          <Avatar src={employee.photoURL || undefined} sx={{ bgcolor: "accentSoft", color: "primary.main", width: { xs: 40, sm: 48 }, height: { xs: 40, sm: 48 }, fontWeight: 700 }}>
            {employee.name.charAt(0).toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: { xs: 15, sm: 16 } }}>{employee.name}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ textTransform: "capitalize", fontSize: { xs: 13, sm: 14 } }}>
              {employee.accessLevel} • {employee.department === "custom" && employee.customDepartment ? employee.customDepartment : employee.department}
            </Typography>
          </Box>
        </Box>
        
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, pl: { xs: 6.5, sm: 0 } }}>
          {todayRecord ? (
            <Box sx={{ textAlign: { xs: "left", sm: "right" }, display: "flex", flexDirection: { xs: "row", sm: "column" }, alignItems: { xs: "center", sm: "flex-end" }, gap: { xs: 1.5, sm: 0 } }}>
              <Chip
                label={ATTENDANCE_STATUSES.find(s => s.value === todayRecord.status)?.label ?? todayRecord.status}
                size="small"
                sx={{ bgcolor: `${STATUS_COLORS[todayRecord.status]}22`, color: STATUS_COLORS[todayRecord.status], fontWeight: 600, mb: { xs: 0, sm: 0.5 } }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                In: {fmtTime(todayRecord.checkIn)} {todayRecord.checkOut ? `• Out: ${fmtTime(todayRecord.checkOut)}` : "• Active"}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: 13, sm: 14 } }}>No Record</Typography>
              <Button size="small" variant="outlined" onClick={() => onMarkAttendance(employee.uid!)} sx={{ px: { xs: 1.5, sm: 2 } }}>Mark</Button>
            </Box>
          )}
          
          <IconButton size="small" onClick={() => setExpanded(!expanded)} sx={{ bgcolor: "action.hover", width: 32, height: 32 }}>
            {expanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
          </IconButton>
        </Box>
      </Box>
      
      <Collapse in={expanded}>
        <Divider sx={{ my: 2 }} />
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>In</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>Out</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>Hours</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>Flags</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {monthRecords.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ color: "text.secondary", py: 3 }}>No other records this month</TableCell></TableRow>
              ) : (
                monthRecords.map(r => (
                  <TableRow 
                    key={r.id}
                    hover
                    sx={{
                      transition: "all 0.2s ease-in-out",
                      position: "relative",
                      "&:hover": {
                        bgcolor: "action.hover",
                        "& td": { color: "primary.main" },
                        "& td:first-of-type": {
                          boxShadow: "inset 3px 0 0 0 var(--mui-palette-primary-main)"
                        }
                      }
                    }}
                  >
                    <TableCell>{new Date(r.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</TableCell>
                    <TableCell>
                      <Chip
                        label={ATTENDANCE_STATUSES.find((s) => s.value === r.status)?.label ?? r.status}
                        size="small"
                        sx={{ bgcolor: `${STATUS_COLORS[r.status]}22`, color: STATUS_COLORS[r.status], fontWeight: 600, fontSize: 11 }}
                      />
                    </TableCell>
                    <TableCell>{fmtTime(r.checkIn)}</TableCell>
                    <TableCell>{fmtTime(r.checkOut)}</TableCell>
                    <TableCell>{calcHours(r.checkIn, r.checkOut)}</TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                        {r.isLate && <Chip size="small" label="Late" sx={{ height: 20, fontSize: 10, bgcolor: "#f59e0b22", color: "#f59e0b", fontWeight: 600 }} />}
                        {(() => {
                          const dailyTasksForRecord = monthTasks.filter(t => t.date === r.date && t.assigneeId === employee.id && t.status === "done" && t.isOvertime && t.compensatesWeeklyHours);
                          const taskOvertimeMinutes = dailyTasksForRecord.reduce((acc, t) => acc + (Number(t.assignedHours) || 0) * 60, 0);
                          const totalOtMinutes = (r.isOvertime ? r.overtimeMinutes : 0) + taskOvertimeMinutes;
                          
                          if (totalOtMinutes > 0) {
                            return (
                              <Chip size="small" label={`+${totalOtMinutes < 60 ? `${totalOtMinutes}m` : `${Math.floor(totalOtMinutes / 60)}h ${totalOtMinutes % 60}m`} OT`} sx={{ height: 20, fontSize: 10, bgcolor: "#3b82f622", color: "#3b82f6", fontWeight: 600 }} />
                            );
                          }
                          return null;
                        })()}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Collapse>
    </Paper>
  );
}
