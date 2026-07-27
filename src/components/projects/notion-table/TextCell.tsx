import { useState } from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";

// Text/number cell with a local buffer; persists on blur or Enter so we don't
// write to Firestore on every keystroke.
export function TextCell({
  value,
  numeric,
  htmlType,
  onCommit,
}: {
  value: string;
  numeric?: boolean;
  htmlType?: string;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  // keep in sync when the underlying value changes externally
  const [lastValue, setLastValue] = useState(value);
  const [modalOpen, setModalOpen] = useState(false);

  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }

  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
        <InputBase
          type={htmlType ?? "text"}
          value={draft}
          inputProps={{ inputMode: numeric ? "numeric" : undefined }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== value && onCommit(draft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          placeholder="Empty"
          fullWidth
          sx={{ fontSize: 14 }}
        />
        {!numeric && !htmlType && (
          <IconButton
            size="small"
            onClick={() => setModalOpen(true)}
            sx={{
              p: 0.25,
              ml: 0.5,
              opacity: { xs: 0.7, md: 0 },
              ".MuiBox-root:hover &, .MuiInputBase-root:focus-within ~ &": { opacity: 0.7 },
              "&:hover": { opacity: 1 },
            }}
            title="Open in modal"
          >
            <Box component="span" sx={{ fontSize: 12 }}>↗</Box>
          </IconButton>
        )}
      </Box>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, pt: 2, pb: 1, borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Edit Details</Typography>
          <IconButton size="small" onClick={() => setModalOpen(false)} sx={{ p: 0.5 }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
        <DialogContent sx={{ p: 2, pb: 4 }}>
          <TextField
            multiline
            fullWidth
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => draft !== value && onCommit(draft)}
            variant="standard"
            slotProps={{ input: { disableUnderline: true, sx: { fontSize: 16, lineHeight: 1.5 } } }}
            placeholder="Empty..."
            autoFocus
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
