import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { type OfficeSettings } from "@/lib/data/types";
import { pad } from "./attendance-utils";

export function AttendanceSettingsModal({
  open,
  onClose,
  editSettings,
  setEditSettings,
  handleSaveSettings,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  editSettings: OfficeSettings;
  setEditSettings: React.Dispatch<React.SetStateAction<OfficeSettings>>;
  handleSaveSettings: () => void;
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
      <DialogTitle sx={{ fontWeight: 600 }}>
        Office Settings
      </DialogTitle>
      <DialogContent
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2.5,
          pt: "8px !important",
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
          Office Hours
        </Typography>
        <Box sx={{ display: "flex", gap: 2 }}>
          <TextField
            label="Start time"
            type="time"
            value={`${pad(editSettings.startHour)}:${pad(editSettings.startMinute)}`}
            onChange={(e) => {
              const [h, m] = e.target.value.split(":").map(Number);
              setEditSettings((s) => ({
                ...s,
                startHour: h,
                startMinute: m,
              }));
            }}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="End time"
            type="time"
            value={`${pad(editSettings.endHour)}:${pad(editSettings.endMinute)}`}
            onChange={(e) => {
              const [h, m] = e.target.value.split(":").map(Number);
              setEditSettings((s) => ({
                ...s,
                endHour: h,
                endMinute: m,
              }));
            }}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Box>

        <Divider />

        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
          Policy
        </Typography>
        <TextField
          label="Grace period (minutes)"
          type="number"
          value={editSettings.graceMinutes}
          onChange={(e) =>
            setEditSettings((s) => ({
              ...s,
              graceMinutes: Number(e.target.value),
            }))
          }
          fullWidth
          helperText="Check-in within this time after start is considered on time."
        />
        <TextField
          label="Late threshold (days/month)"
          type="number"
          value={editSettings.lateThresholdDays}
          onChange={(e) =>
            setEditSettings((s) => ({
              ...s,
              lateThresholdDays: Number(e.target.value),
            }))
          }
          fullWidth
          helperText="After this many late days, salary deduction starts."
        />
        <Box sx={{ display: "flex", gap: 2 }}>
          <TextField
            label="Employee leaves/month"
            type="number"
            value={editSettings.employeeLeavesPerMonth}
            onChange={(e) =>
              setEditSettings((s) => ({
                ...s,
                employeeLeavesPerMonth: Number(e.target.value),
              }))
            }
            fullWidth
          />
          <TextField
            label="Intern leaves/month"
            type="number"
            value={editSettings.internLeavesPerMonth}
            onChange={(e) =>
              setEditSettings((s) => ({
                ...s,
                internLeavesPerMonth: Number(e.target.value),
              }))
            }
            fullWidth
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSaveSettings}
          disabled={busy}
          sx={{ borderRadius: 3 }}
        >
          Save Settings
        </Button>
      </DialogActions>
    </Dialog>
  );
}
