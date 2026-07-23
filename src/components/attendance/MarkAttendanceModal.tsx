import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
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
      slotProps={{ paper: { sx: { borderRadius: 4 } } }}
    >
      <DialogTitle sx={{ fontWeight: 600 }}>Mark Attendance</DialogTitle>
      <DialogContent
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          pt: "8px !important",
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
            Select employee
          </MenuItem>
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
            if (newDate > new Date().toISOString().slice(0, 10) && markStatus !== "on_leave") {
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
        </Select>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleMark}
          disabled={busy || !markUid}
          sx={{ borderRadius: 3 }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
