import { useState } from "react";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Popover from "@mui/material/Popover";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { DbColumn } from "@/lib/data/types";
import { OptionBadge } from "./utils";

export function OptionPopover({
  open,
  anchorEl,
  onClose,
  column,
  multi,
  value,
  selected,
  onPick,
  onToggle,
  onCreate,
}: {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  column: DbColumn;
  multi?: boolean;
  value?: string | null;
  selected?: string[];
  onPick?: (id: string) => void;
  onToggle?: (id: string) => void;
  onCreate: (label: string) => void;
}) {
  const [q, setQ] = useState("");
  const options = column.options ?? [];
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const exact = options.some(
    (o) => o.label.toLowerCase() === q.trim().toLowerCase(),
  );

  return (
    <Popover
      open={open && Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      slotProps={{ paper: { sx: { width: 208, borderRadius: 3, p: 0.5 } } }}
    >
      <TextField
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && q.trim() && !exact) {
            onCreate(q.trim());
            setQ("");
          }
        }}
        placeholder="Search or create…"
        fullWidth
        sx={{ mb: 0.5, "& .MuiInputBase-input": { fontSize: 14, py: 0.75 } }}
      />
      <MenuList sx={{ maxHeight: 220, overflowY: "auto", p: 1, gap: 0.5, display: "flex", flexDirection: "column" }}>
        {!multi && value && (
          <MenuItem
            onClick={() => onPick?.("")}
            sx={{ borderRadius: 1.5, fontSize: 13, color: "text.secondary", minHeight: 32 }}
          >
            Clear
          </MenuItem>
        )}
        {filtered.map((o) => (
          <MenuItem
            key={o.id}
            onClick={() => (multi ? onToggle?.(o.id) : onPick?.(o.id))}
            sx={{ borderRadius: 1.5, justifyContent: "space-between", minHeight: 36 }}
          >
            <OptionBadge option={o} />
            {multi && selected?.includes(o.id) && (
              <Typography variant="caption" color="primary">
                ✓
              </Typography>
            )}
          </MenuItem>
        ))}
        {q.trim() && !exact && (
          <MenuItem
            onClick={() => {
              onCreate(q.trim());
              setQ("");
            }}
            sx={{ borderRadius: 1.5, fontSize: 13, color: "primary.main", minHeight: 36 }}
          >
            Create &quot;{q}&quot;
          </MenuItem>
        )}
      </MenuList>
    </Popover>
  );
}
