import Snackbar from "@mui/material/Snackbar";
import Alert, { AlertColor } from "@mui/material/Alert";

interface ToastProps {
  open: boolean;
  message: string;
  type?: AlertColor; // "success" | "info" | "warning" | "error"
  onClose: () => void;
  autoHideDuration?: number;
}

export function Toast({ open, message, type = "success", onClose, autoHideDuration = 3000 }: ToastProps) {
  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Alert onClose={onClose} severity={type} sx={{ width: "100%", color: "white" }} variant="filled">
        {message}
      </Alert>
    </Snackbar>
  );
}
