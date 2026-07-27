import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import { type AttendanceRecord } from "@/lib/data/types";
import { calcHours, fmtTime } from "./attendance-utils";

interface ClockInOutCardProps {
  myTodayRecord: AttendanceRecord | null;
  canClock: boolean;
  busy: boolean;
  handleClockIn: () => void;
  handleClockOut: () => void;
}

export function ClockInOutCard({
  myTodayRecord,
  canClock,
  busy,
  handleClockIn,
  handleClockOut,
}: ClockInOutCardProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        mb: 3,
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 2,
      }}
    >
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Today —{" "}
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </Typography>
        {myTodayRecord ? (
          <Box sx={{ mt: 0.5, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography variant="body2" color="text.secondary">
              In at {fmtTime(myTodayRecord.checkIn)}
              {myTodayRecord.checkOut
                ? ` · Out at ${fmtTime(myTodayRecord.checkOut)} · ${calcHours(myTodayRecord.checkIn, myTodayRecord.checkOut)}`
                : " · Still working"}
            </Typography>
            {myTodayRecord.isLate && (
              <Chip size="small" label="Late" sx={{ bgcolor: "#f59e0b22", color: "#f59e0b", fontWeight: 600, fontSize: 10, height: 20 }} />
            )}
            {myTodayRecord.isOvertime && (
              <Chip size="small" label={`+${myTodayRecord.overtimeMinutes}min OT`} sx={{ bgcolor: "#3b82f622", color: "#3b82f6", fontWeight: 600, fontSize: 10, height: 20 }} />
            )}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            You have not clocked in yet.
          </Typography>
        )}
      </Box>
      <Box sx={{ display: "flex", gap: 1 }}>
        {!myTodayRecord ? (
          <Button
            variant="contained"
            onClick={handleClockIn}
            disabled={busy || !canClock}
            sx={{ borderRadius: 3, px: 3 }}
          >
            {canClock ? "Clock In" : "Office Closed"}
          </Button>
        ) : !myTodayRecord.checkOut ? (
          <Button
            variant="outlined"
            color="error"
            onClick={handleClockOut}
            disabled={busy}
            sx={{ borderRadius: 3, px: 3 }}
          >
            Clock Out
          </Button>
        ) : (
          <Chip
            label="Day Complete ✓"
            sx={{ bgcolor: "#22c55e22", color: "#22c55e", fontWeight: 600 }}
          />
        )}
      </Box>
    </Paper>
  );
}
