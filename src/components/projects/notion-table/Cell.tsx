import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import InputBase from "@mui/material/InputBase";
import Typography from "@mui/material/Typography";
import type { DbColumn, CellValue } from "@/lib/data/types";
import { OptionBadge } from "./utils";
import { OptionPopover } from "./OptionPopover";
import { TextCell } from "./TextCell";

export function Cell({
  column,
  value,
  open,
  anchorEl,
  onOpen,
  onClose,
  onChange,
  onAddOption,
}: {
  column: DbColumn;
  value: CellValue;
  open: boolean;
  anchorEl: HTMLElement | null;
  onOpen: (el: HTMLElement) => void;
  onClose: () => void;
  onChange: (v: CellValue) => void;
  onAddOption: (label: string) => string;
}) {
  if (column.type === "checkbox") {
    return (
      <Checkbox
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
        size="small"
        sx={{ p: 0.25 }}
      />
    );
  }

  if (column.type === "date") {
    return (
      <InputBase
        type="date"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value || null)}
        fullWidth
        sx={{ fontSize: 14 }}
      />
    );
  }

  if (column.type === "number") {
    return (
      <TextCell
        value={value == null ? "" : String(value)}
        numeric
        onCommit={(v) => onChange(v === "" ? null : Number(v))}
      />
    );
  }

  if (
    column.type === "url" ||
    column.type === "email" ||
    column.type === "phone"
  ) {
    const htmlType =
      column.type === "url" ? "url" : column.type === "email" ? "email" : "tel";
    return (
      <TextCell
        value={typeof value === "string" ? value : ""}
        htmlType={htmlType}
        onCommit={(v) => onChange(v || null)}
      />
    );
  }

  if (column.type === "multi_select") {
    const ids = Array.isArray(value) ? value : [];
    const chosen = (column.options ?? []).filter((o) => ids.includes(o.id));
    return (
      <>
        <Box
          component="button"
          onClick={(e: React.MouseEvent<HTMLElement>) =>
            open ? onClose() : onOpen(e.currentTarget)
          }
          sx={{
            display: "flex",
            minHeight: 24,
            width: "100%",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 0.5,
            border: 0,
            bgcolor: "transparent",
            p: 0,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          {chosen.length ? (
            chosen.map((o) => <OptionBadge key={o.id} option={o} />)
          ) : (
            <Typography variant="caption" color="text.disabled">
              Empty
            </Typography>
          )}
        </Box>
        <OptionPopover
          open={open}
          anchorEl={anchorEl}
          onClose={onClose}
          column={column}
          multi
          selected={ids}
          onToggle={(id) =>
            onChange(
              ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
            )
          }
          onCreate={(label) => onChange([...ids, onAddOption(label)])}
        />
      </>
    );
  }

  if (column.type === "select" || column.type === "status") {
    const opt = column.options?.find((o) => o.id === value) ?? null;
    return (
      <>
        <Box
          component="button"
          onClick={(e: React.MouseEvent<HTMLElement>) =>
            open ? onClose() : onOpen(e.currentTarget)
          }
          sx={{
            display: "flex",
            minHeight: 24,
            width: "100%",
            alignItems: "center",
            border: 0,
            bgcolor: "transparent",
            p: 0,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          {opt ? (
            <OptionBadge option={opt} />
          ) : (
            <Typography variant="caption" color="text.disabled">
              Empty
            </Typography>
          )}
        </Box>
        <OptionPopover
          open={open}
          anchorEl={anchorEl}
          onClose={onClose}
          column={column}
          value={typeof value === "string" ? value : null}
          onPick={(id) => {
            onChange(id);
            onClose();
          }}
          onCreate={(label) => {
            const id = onAddOption(label);
            onChange(id);
            onClose();
          }}
        />
      </>
    );
  }

  // text
  return (
    <TextCell
      value={typeof value === "string" ? value : value == null ? "" : String(value)}
      onCommit={(v) => onChange(v)}
    />
  );
}
