import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

export function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 3,
        textAlign: "center",
        borderColor: `${color}44`,
        bgcolor: `${color}08`,
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        cursor: "default",
        position: "relative",
        overflow: "hidden",
        "&:hover": {
          borderColor: color,
          bgcolor: `${color}15`,
          transform: "translateY(-4px)",
          boxShadow: `0 12px 24px -8px ${color}60`,
        },
      }}
    >
      <Typography
        variant="h5"
        sx={{ fontWeight: 700, color, lineHeight: 1 }}
      >
        {value}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontWeight: 600, display: "block", mt: 1, textTransform: "uppercase" }}
      >
        {label}
      </Typography>
    </Paper>
  );
}
