import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import type { DbColumn, ColumnType, SelectOption } from "@/lib/data/types";
import { optionColors } from "@/lib/theme/colors";
import { TYPE_LABELS, TYPE_ORDER, TYPE_ICONS, OPTION_TYPES, ALL_COLORS, uuid } from "./utils";
import { OPTION_COLOR_CYCLE } from "@/lib/data/types";

export function ColumnMenu({
  column,
  canDelete,
  onRename,
  onType,
  onSortAsc,
  onSortDesc,
  onInsertLeft,
  onInsertRight,
  onDelete,
  onOptionsChange,
}: {
  column: DbColumn;
  canDelete: boolean;
  onRename: (name: string) => void;
  onType: (type: ColumnType) => void;
  onSortAsc: () => void;
  onSortDesc: () => void;
  onInsertLeft: () => void;
  onInsertRight: () => void;
  onDelete: () => void;
  onOptionsChange: (opts: SelectOption[]) => void;
}) {
  const [typeOpen, setTypeOpen] = useState(false);
  const hasOptions = OPTION_TYPES.includes(column.type);
  return (
    <Box>
      <Box sx={{ px: 1, pb: 0.5 }}>
        <TextField
          autoFocus
          defaultValue={column.name}
          onChange={(e) => onRename(e.target.value)}
          fullWidth
          sx={{ mb: 0.5, "& .MuiInputBase-input": { fontSize: 14, py: 0.75 } }}
        />
      </Box>

      <MenuList dense sx={{ px: 0.5, py: 0 }}>
        {/* Change type — collapsible, Notion-style list */}
        <MenuItem
          onClick={() => setTypeOpen((v) => !v)}
          sx={{ borderRadius: 1.5, justifyContent: "space-between", fontSize: 14 }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary" }}>
            <Box component="span" sx={{ width: 16, textAlign: "center", fontSize: 12, opacity: 0.7 }}>
              ↻
            </Box>
            Change type
          </Box>
          <Typography variant="caption" color="text.secondary">
            {TYPE_LABELS[column.type]} {typeOpen ? "▾" : "▸"}
          </Typography>
        </MenuItem>
        <Collapse in={typeOpen}>
          <Box
            sx={{
              mb: 0.5,
              maxHeight: 224,
              overflowY: "auto",
              borderRadius: 2,
              bgcolor: "surface",
              p: 0.5,
            }}
          >
            {TYPE_ORDER.map((t) => (
              <MenuItem
                key={t}
                onClick={() => {
                  onType(t);
                  setTypeOpen(false);
                }}
                sx={{ borderRadius: 1.5, justifyContent: "space-between", fontSize: 14 }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box component="span" sx={{ width: 16, textAlign: "center", fontSize: 12, opacity: 0.7 }}>
                    {TYPE_ICONS[t]}
                  </Box>
                  {TYPE_LABELS[t]}
                </Box>
                {column.type === t && (
                  <Typography variant="caption" color="primary">
                    ✓
                  </Typography>
                )}
              </MenuItem>
            ))}
          </Box>
        </Collapse>

        {hasOptions && (
          <>
            <Divider sx={{ my: 0.5 }} />
            <OptionsEditor
              options={column.options ?? []}
              onChange={onOptionsChange}
            />
          </>
        )}

        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={onSortAsc} sx={{ borderRadius: 1.5, fontSize: 14 }}>
          Sort ascending
        </MenuItem>
        <MenuItem onClick={onSortDesc} sx={{ borderRadius: 1.5, fontSize: 14 }}>
          Sort descending
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={onInsertLeft} sx={{ borderRadius: 1.5, fontSize: 14 }}>
          Insert left
        </MenuItem>
        <MenuItem onClick={onInsertRight} sx={{ borderRadius: 1.5, fontSize: 14 }}>
          Insert right
        </MenuItem>
        {canDelete && (
          <>
            <Divider sx={{ my: 0.5 }} />
            <MenuItem
              onClick={onDelete}
              sx={{ borderRadius: 1.5, fontSize: 14, color: "error.main" }}
            >
              Delete column
            </MenuItem>
          </>
        )}
      </MenuList>
    </Box>
  );
}

// Edit a select/status column's options: add, rename, recolor, delete.
export function OptionsEditor({
  options,
  onChange,
}: {
  options: SelectOption[];
  onChange: (opts: SelectOption[]) => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [colorFor, setColorFor] = useState<string | null>(null);

  function add() {
    const label = newLabel.trim();
    if (!label) return;
    const color = OPTION_COLOR_CYCLE[options.length % OPTION_COLOR_CYCLE.length];
    onChange([...options, { id: uuid(), label, color }]);
    setNewLabel("");
  }
  function update(id: string, patch: Partial<SelectOption>) {
    onChange(options.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }
  function remove(id: string) {
    onChange(options.filter((o) => o.id !== id));
    setColorFor(null);
  }

  return (
    <Box sx={{ px: 0.5, pb: 0.5 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          px: 0.5,
          py: 0.5,
          display: "block",
          fontSize: 11,
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        Options
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        {options.map((o) => (
          <Box key={o.id}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                borderRadius: 1.5,
                px: 0.5,
                py: 0.25,
                "&:hover": { bgcolor: "surface" },
              }}
            >
              {/* color swatch -> opens palette */}
              <Box
                component="button"
                onClick={() => setColorFor(colorFor === o.id ? null : o.id)}
                title="Change colour"
                sx={{
                  width: 16,
                  height: 16,
                  flexShrink: 0,
                  borderRadius: "50%",
                  border: 0,
                  cursor: "pointer",
                  bgcolor: optionColors[o.color],
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)",
                }}
              />
              <InputBase
                value={o.label}
                onChange={(e) => update(o.id, { label: e.target.value })}
                sx={{ minWidth: 0, flex: 1, fontSize: 14 }}
              />
              <IconButton
                size="small"
                onClick={() => remove(o.id)}
                title="Delete option"
                sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
              >
                <CloseIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Box>

            <Collapse in={colorFor === o.id}>
              <Paper
                variant="outlined"
                sx={{
                  ml: 2.5,
                  mt: 0.5,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 0.75,
                  borderRadius: 2,
                  p: 1,
                }}
              >
                {ALL_COLORS.map((c) => (
                  <Box
                    component="button"
                    key={c}
                    onClick={() => {
                      update(o.id, { color: c });
                      setColorFor(null);
                    }}
                    title={c}
                    sx={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      border: 0,
                      cursor: "pointer",
                      bgcolor: optionColors[c],
                      boxShadow:
                        o.color === c
                          ? (theme) =>
                              `0 0 0 2px ${theme.palette.primary.main}`
                          : "inset 0 0 0 1px rgba(0,0,0,0.1)",
                      transition: "transform 0.1s",
                      "&:hover": { transform: "scale(1.1)" },
                    }}
                  />
                ))}
              </Paper>
            </Collapse>
          </Box>
        ))}
      </Box>

      {/* add option */}
      <Box sx={{ mt: 0.5, display: "flex", alignItems: "center", gap: 0.5 }}>
        <TextField
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add an option…"
          fullWidth
          sx={{ "& .MuiInputBase-input": { fontSize: 14, py: 0.5 } }}
        />
        <Button
          onClick={add}
          disabled={!newLabel.trim()}
          variant="contained"
          sx={{ flexShrink: 0, fontSize: 12, minWidth: 0, px: 1.5 }}
        >
          Add
        </Button>
      </Box>
    </Box>
  );
}
