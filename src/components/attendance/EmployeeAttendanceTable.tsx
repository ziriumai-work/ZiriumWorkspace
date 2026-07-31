import { useMemo } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import {
  type AttendanceRecord,
  type Employee,
  type DailyTask,
  type OfficeSettings,
  DEFAULT_OFFICE_SETTINGS,
  ATTENDANCE_STATUSES,
} from "@/lib/data/types";
import {
  getWeeklyOvertimeDueMap,
  getDailyPenaltyMap,
  formatODH,
  type DatePenaltyChip,
} from "@/lib/data/attendance";
import { STATUS_COLORS, calcHours, fmtTime } from "./attendance-utils";

interface EmployeeAttendanceTableProps {
  isAdmin: boolean;
  displayed: AttendanceRecord[];
  employees: Employee[];
  monthTasks: DailyTask[];
  settings?: OfficeSettings;
}

export function EmployeeAttendanceTable({
  isAdmin,
  displayed,
  employees,
  monthTasks,
  settings,
}: EmployeeAttendanceTableProps) {
  const odhMapByUid: Record<string, Record<string, number>> = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    const uids = Array.from(new Set(displayed.map((r) => r.uid)));
    for (const uid of uids) {
      const emp = employees.find((e) => e.uid === uid || e.id === uid);
      const empRecords = displayed.filter((r) => r.uid === uid);
      map[uid] = getWeeklyOvertimeDueMap(
        empRecords,
        emp,
        settings || DEFAULT_OFFICE_SETTINGS,
        monthTasks,
      );
    }
    return map;
  }, [displayed, employees, monthTasks, settings]);

  const penaltyMapByUid: Record<string, Record<string, DatePenaltyChip[]>> = useMemo(() => {
    const map: Record<string, Record<string, DatePenaltyChip[]>> = {};
    const uids = Array.from(new Set(displayed.map((r) => r.uid)));
    for (const uid of uids) {
      const emp = employees.find((e) => e.uid === uid || e.id === uid);
      const empRecords = displayed.filter((r) => r.uid === uid);
      map[uid] = getDailyPenaltyMap(
        empRecords,
        emp,
        settings || DEFAULT_OFFICE_SETTINGS,
      );
    }
    return map;
  }, [displayed, employees, settings]);

  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ borderRadius: 4, overflowX: "auto" }}
    >
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: "surface" }}>
            {isAdmin && (
              <>
                <TableCell sx={{ fontWeight: 600, fontSize: 13, pl: 3 }}>Member</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>Role</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>Department</TableCell>
              </>
            )}
            <TableCell sx={{ fontWeight: 600, fontSize: 13, pl: isAdmin ? undefined : 3 }}>Date</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>Clock In</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>Clock Out</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>Hours</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: 13, pr: 3 }}>Flags</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {displayed.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={isAdmin ? 9 : 6}
                sx={{
                  textAlign: "center",
                  py: 4,
                  color: "text.secondary",
                }}
              >
                No attendance records found.
              </TableCell>
            </TableRow>
          ) : (
            displayed.map((r) => (
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
                {isAdmin && (
                  <>
                    <TableCell sx={{ pl: 3 }}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                        }}
                      >
                        <Avatar
                          sx={{
                            width: 24,
                            height: 24,
                            fontSize: 11,
                            bgcolor: "accentSoft",
                            color: "primary.main",
                          }}
                        >
                          {r.employeeName?.charAt(0).toUpperCase() ?? "?"}
                        </Avatar>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {r.employeeName}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ textTransform: "capitalize", color: "text.secondary" }}>
                        {employees.find(e => e.uid === r.uid || e.id === r.uid)?.accessLevel ?? "-"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ textTransform: "uppercase", color: "text.secondary" }}>
                        {(() => {
                          const emp = employees.find(e => e.uid === r.uid || e.id === r.uid);
                          if (!emp) return "-";
                          return emp.department === "custom" && emp.customDepartment ? emp.customDepartment : emp.department;
                        })()}
                      </Typography>
                    </TableCell>
                  </>
                )}
                <TableCell sx={{ pl: isAdmin ? undefined : 3 }}>
                  <Typography variant="body2">
                    {new Date(r.date + "T00:00:00").toLocaleDateString(
                      undefined,
                      { weekday: "short", month: "short", day: "numeric" },
                    )}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={
                      ATTENDANCE_STATUSES.find((s) => s.value === r.status)
                        ?.label ?? r.status
                    }
                    size="small"
                    sx={{
                      bgcolor: `${STATUS_COLORS[r.status]}22`,
                      color: STATUS_COLORS[r.status],
                      fontWeight: 600,
                      fontSize: 11,
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {fmtTime(r.checkIn)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {fmtTime(r.checkOut)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {calcHours(r.checkIn, r.checkOut)}
                  </Typography>
                </TableCell>
                <TableCell sx={{ pr: 3 }}>
                  <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                    {r.isLate && (
                      <Chip
                        size="small"
                        label="Late"
                        sx={{
                          height: 20,
                          fontSize: 10,
                          bgcolor: "#f59e0b22",
                          color: "#f59e0b",
                          fontWeight: 600,
                        }}
                      />
                    )}
                    {(() => {
                      const odhMins = odhMapByUid[r.uid]?.[r.date] || 0;
                      if (odhMins > 0) {
                        return (
                          <Tooltip title="Overtime Due (Short daily/weekly hours)">
                            <Chip
                              size="small"
                              label={formatODH(odhMins)}
                              sx={{
                                height: 20,
                                fontSize: 10,
                                bgcolor: "#ef444422",
                                color: "#ef4444",
                                fontWeight: 600,
                              }}
                            />
                          </Tooltip>
                        );
                      }
                      return null;
                    })()}
                    {(() => {
                      const emp = employees.find(e => e.uid === r.uid || e.id === r.uid);
                      const dailyTasksForRecord = monthTasks.filter(t => t.date === r.date && (t.assigneeId === emp?.id || t.assigneeId === emp?.uid || t.assigneeId === r.uid) && t.status === "done" && (t.isOvertime || t.compensatesWeeklyHours));
                      const taskOvertimeMinutes = dailyTasksForRecord.reduce((acc, t) => acc + (Number(t.assignedHours) || 0) * 60, 0);
                      const totalOtMinutes = (r.isOvertime ? r.overtimeMinutes : 0) + taskOvertimeMinutes;
                      
                      if (totalOtMinutes > 0) {
                        return (
                          <Chip
                            size="small"
                            label={`+${totalOtMinutes < 60 ? `${totalOtMinutes}m` : `${Math.floor(totalOtMinutes / 60)}h ${totalOtMinutes % 60}m`} OT`}
                            sx={{
                              height: 20,
                              fontSize: 10,
                              bgcolor: "#3b82f622",
                              color: "#3b82f6",
                              fontWeight: 600,
                            }}
                          />
                        );
                      }
                      return null;
                    })()}
                    {penaltyMapByUid[r.uid]?.[r.date]?.map((p, idx) => (
                      <Tooltip key={idx} title={p.tooltip}>
                        <Chip
                          size="small"
                          label={p.label}
                          sx={{
                            height: 20,
                            fontSize: 10,
                            bgcolor: p.bgcolor,
                            color: p.color,
                            fontWeight: 600,
                          }}
                        />
                      </Tooltip>
                    ))}
                  </Box>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
