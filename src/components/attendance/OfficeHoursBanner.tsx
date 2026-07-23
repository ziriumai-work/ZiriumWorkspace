import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import { type OfficeSettings } from "@/lib/data/types";
import { pad } from "./attendance-utils";

interface OfficeHoursBannerProps {
  settings: OfficeSettings;
  canClock: boolean;
}

export function OfficeHoursBanner({ settings, canClock }: OfficeHoursBannerProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        px: 3,
        py: 1.5,
        mb: 2,
        borderRadius: 3,
        display: "flex",
        alignItems: "center",
        gap: 2,
        flexWrap: "wrap",
        bgcolor: "surface",
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Office Hours
      </Typography>
      <Chip
        size="small"
        label={`${pad(settings.startHour)}:${pad(settings.startMinute)} – ${pad(settings.endHour)}:${pad(settings.endMinute)}`}
        sx={{ fontWeight: 600, fontSize: 12 }}
      />
      <Chip
        size="small"
        label={`${settings.graceMinutes} min grace`}
        variant="outlined"
        sx={{ fontSize: 11 }}
      />
      <Chip
        size="small"
        label={canClock ? "Open" : "Closed"}
        sx={{
          fontWeight: 600,
          fontSize: 11,
          bgcolor: canClock ? "#22c55e22" : "#ef444422",
          color: canClock ? "#22c55e" : "#ef4444",
        }}
      />
    </Paper>
  );
}
