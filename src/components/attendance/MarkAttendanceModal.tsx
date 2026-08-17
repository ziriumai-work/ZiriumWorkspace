import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Divider from "@mui/material/Divider";
import { type AttendanceStatus, type Employee } from "@/lib/data/types";

export function MarkAttendanceModal({
  open,
  onClose,
  employees,
  markUid,
  setMarkUid,
  markDate,
  setMarkDate,
  markStatus,
  setMarkStatus,
  handleMark,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  employees: Employee[];
  markUid: string;
  setMarkUid: (uid: string) => void;
  markDate: string;
  setMarkDate: (date: string) => void;
  markStatus: AttendanceStatus;
  setMarkStatus: (status: AttendanceStatus) => void;
  handleMark: () => void;
  busy: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 4,
            m: { xs: 2, sm: 3 },
            width: { xs: "calc(100% - 32px)", sm: "auto" },
          },
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 600, px: { xs: 2.5, sm: 3 }, pt: { xs: 2.5, sm: 3 } }}>
        Mark Attendance
      </DialogTitle>
      <DialogContent
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2.25,
          pt: "8px !important",
          px: { xs: 2.5, sm: 3 },
        }}
      >
        <Select
          value={markUid}
          onChange={(e) => setMarkUid(e.target.value)}
          fullWidth
          size="small"
          displayEmpty
          sx={{ borderRadius: 2, fontSize: 14 }}
        >
          <MenuItem value="" disabled>
            Select staff / bulk group
          </MenuItem>
          <MenuItem value="bulk_interns" sx={{ fontWeight: 600 }}>
            All Interns
          </MenuItem>
          <MenuItem value="bulk_employees" sx={{ fontWeight: 600 }}>
            All Employees
          </MenuItem>
          <MenuItem value="bulk_all" sx={{ fontWeight: 600 }}>
            All Staff
          </MenuItem>
          <Divider sx={{ my: 0.5 }} />
          {employees
            .filter((e) => e.uid)
            .map((e) => (
              <MenuItem key={e.uid!} value={e.uid!}>
                {e.name}
              </MenuItem>
            ))}
        </Select>
        <TextField
          label="Date"
          type="date"
          value={markDate}
          onChange={(e) => {
            const newDate = e.target.value;
            setMarkDate(newDate);
            const today = new Date().toISOString().slice(0, 10);
            if (newDate > today && markStatus !== "on_leave") {
              setMarkStatus("on_leave");
            } else if (newDate !== today && markStatus === "clock_out") {
              setMarkStatus("on_leave");
            }
          }}
          fullWidth
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              transition: "all 0.2s ease-in-out",
              "&:hover": {
                boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.08)",
              },
              "&.Mui-focused": {
                boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.15)",
              },
            },
          }}
        />
        <Select
          value={markStatus}
          onChange={(e) =>
            setMarkStatus(e.target.value as AttendanceStatus)
          }
          fullWidth
          size="small"
          sx={{
            borderRadius: 2,
            fontSize: 14,
            transition: "all 0.2s ease-in-out",
            "&:hover": {
              boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.08)",
            },
            "&.Mui-focused": {
              boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.15)",
            },
          }}
        >
          <MenuItem value="on_leave">On Leave</MenuItem>
          <MenuItem value="absent">Absent</MenuItem>
          <MenuItem
            value="clock_out"
            disabled={markDate !== new Date().toISOString().slice(0, 10)}
          >
            Clock Out Today (Active Shift)
          </MenuItem>
        </Select>
      </DialogContent>
      <DialogActions
        sx={{
          px: { xs: 2.5, sm: 3 },
          pb: { xs: 2.5, sm: 3 },
          pt: 1,
          display: "flex",
          flexDirection: { xs: "column-reverse", sm: "row" },
          gap: { xs: 1.25, sm: 1 },
          "& .MuiButton-root": {
            width: { xs: "100%", sm: "auto" },
            m: "0 !important",
            py: { xs: 1, sm: 0.75 },
          },
        }}
      >
        <Button
          onClick={onClose}
          variant="outlined"
          color="inherit"
          sx={{ borderRadius: 3, fontWeight: 600 }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleMark}
          disabled={busy || !markUid}
          sx={{ borderRadius: 3, fontWeight: 600, px: 3 }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
