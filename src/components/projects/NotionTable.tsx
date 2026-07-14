"use client";

// A Notion-style database table: customizable columns with types, a column
// header menu (rename, change type, sort, insert, delete), typed cell editing,
// select/status options with colors, and add row / add column. The parent owns
// persistence — every change calls onColumnsChange / onRowsChange, which write
// the full arrays back to Firestore.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Popover from "@mui/material/Popover";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import { chipSx } from "@/components/projectMeta";
import { optionColors } from "@/lib/theme/colors";
import {
  OPTION_COLOR_CYCLE,
  type CellValue,
  type ColumnType,
  type DbColumn,
  type DbRow,
  type OptionColor,
  type SelectOption,
} from "@/lib/data/types";

const uuid = () => crypto.randomUUID();

const ALL_COLORS: OptionColor[] = [
  "gray",
  "blue",
  "green",
  "yellow",
  "orange",
  "red",
  "purple",
  "pink",
];

const TYPE_LABELS: Record<ColumnType, string> = {
  text: "Text",
  number: "Number",
  select: "Select",
  multi_select: "Multi-select",
  status: "Status",
  date: "Date",
  url: "URL",
  email: "Email",
  phone: "Phone",
  checkbox: "Checkbox",
};

const TYPE_ICONS: Record<ColumnType, string> = {
  text: "Aa",
  number: "#",
  select: "▽",
  multi_select: "≣",
  status: "◉",
  date: "📅",
  url: "🔗",
  email: "✉",
  phone: "✆",
  checkbox: "☑",
};

// Order shown in the "Change type" list.
const TYPE_ORDER: ColumnType[] = [
  "text",
  "number",
  "select",
  "multi_select",
  "status",
  "date",
  "url",
  "email",
  "phone",
  "checkbox",
];

// Which types use coloured options.
const OPTION_TYPES: ColumnType[] = ["select", "multi_select", "status"];

// Soft badge chip for select/status options. Legacy options may carry a color
// name outside the palette — fall back to gray instead of crashing.
function OptionBadge({ option }: { option: SelectOption }) {
  const base = optionColors[option.color] ?? optionColors.gray;
  return (
    <Chip label={option.label} sx={[chipSx(base), { height: 20, fontSize: 11 }]} />
  );
}

export function NotionTable({
  columns,
  rows,
  onColumnsChange,
  onRowsChange,
}: {
  columns: DbColumn[];
  rows: DbRow[];
  onColumnsChange: (next: DbColumn[]) => void;
  onRowsChange: (next: DbRow[]) => void;
}) {
  const [menuAnchor, setMenuAnchor] = useState<{
    colId: string;
    el: HTMLElement;
  } | null>(null);
  const [cellAnchor, setCellAnchor] = useState<{
    row: string;
    col: string;
    el: HTMLElement;
  } | null>(null);
  const [sort, setSort] = useState<{ col: string; dir: "asc" | "desc" } | null>(
    null,
  );

  // ----- column ops -----
  function updateColumn(id: string, patch: Partial<DbColumn>) {
    onColumnsChange(columns.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function deleteColumn(id: string) {
    onColumnsChange(columns.filter((c) => c.id !== id));
    setMenuAnchor(null);
  }
  function insertColumn(index: number) {
    const col: DbColumn = { id: uuid(), name: "New column", type: "text" };
    const next = [...columns];
    next.splice(index, 0, col);
    onColumnsChange(next);
    setMenuAnchor(null);
  }
  function addOption(colId: string, label: string): string {
    const col = columns.find((c) => c.id === colId);
    const opts = col?.options ?? [];
    const color: OptionColor =
      OPTION_COLOR_CYCLE[opts.length % OPTION_COLOR_CYCLE.length];
    const opt: SelectOption = { id: uuid(), label, color };
    updateColumn(colId, { options: [...opts, opt] });
    return opt.id;
  }

  // ----- row ops -----
  function setCell(rowId: string, colId: string, value: CellValue) {
    onRowsChange(
      rows.map((r) =>
        r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r,
      ),
    );
  }
  function addRow() {
    const maxOrder = rows.reduce((m, r) => Math.max(m, r.order), -1);
    onRowsChange([...rows, { id: uuid(), order: maxOrder + 1, cells: {} }]);
  }
  function deleteRow(rowId: string) {
    onRowsChange(rows.filter((r) => r.id !== rowId));
  }

  // ----- sorted view -----
  const displayRows = useMemo(() => {
    const copy = [...rows];
    if (!sort) return copy.sort((a, b) => a.order - b.order);
    const col = columns.find((c) => c.id === sort.col);
    const text = (r: DbRow): string => {
      const v = r.cells[sort.col];
      if (col && (col.type === "select" || col.type === "status")) {
        return col.options?.find((o) => o.id === v)?.label ?? "";
      }
      if (col && col.type === "multi_select" && Array.isArray(v)) {
        return v
          .map((id) => col.options?.find((o) => o.id === id)?.label ?? "")
          .join(", ");
      }
      return v == null ? "" : String(v);
    };
    copy.sort((a, b) =>
      sort.dir === "asc"
        ? text(a).localeCompare(text(b))
        : text(b).localeCompare(text(a)),
    );
    return copy;
  }, [rows, sort, columns]);

  const menuColumn = menuAnchor
    ? (columns.find((c) => c.id === menuAnchor.colId) ?? null)
    : null;
  const menuColIndex = menuAnchor
    ? columns.findIndex((c) => c.id === menuAnchor.colId)
    : -1;

  return (
    <Box>
      <Paper variant="outlined" sx={{ borderRadius: 3, overflowX: "auto" }}>
        <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <Box component="thead">
            <Box
              component="tr"
              sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "surface" }}
            >
              {columns.map((col) => (
                <Box
                  component="th"
                  key={col.id}
                  sx={{
                    borderRight: 1,
                    borderColor: "divider",
                    px: 1.5,
                    py: 1,
                    textAlign: "left",
                    fontWeight: 500,
                  }}
                >
                  <Box
                    component="button"
                    onClick={(e: React.MouseEvent<HTMLElement>) =>
                      setMenuAnchor(
                        menuAnchor?.colId === col.id
                          ? null
                          : { colId: col.id, el: e.currentTarget },
                      )
                    }
                    sx={{
                      display: "flex",
                      width: "100%",
                      alignItems: "center",
                      gap: 0.75,
                      border: 0,
                      bgcolor: "transparent",
                      p: 0,
                      fontSize: 12,
                      fontFamily: "inherit",
                      color: "text.secondary",
                      cursor: "pointer",
                      transition: "color 0.15s",
                      "&:hover": { color: "text.primary" },
                    }}
                  >
                    <Box component="span" sx={{ opacity: 0.6 }}>
                      {TYPE_ICONS[col.type]}
                    </Box>
                    <Box
                      component="span"
                      sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {col.name}
                    </Box>
                  </Box>
                </Box>
              ))}
              <Box component="th" sx={{ width: 40, px: 1, py: 1 }}>
                <IconButton
                  size="small"
                  onClick={() => insertColumn(columns.length)}
                  title="Add column"
                  sx={{ color: "text.secondary" }}
                >
                  +
                </IconButton>
              </Box>
            </Box>
          </Box>

          <Box component="tbody">
            {displayRows.map((row) => (
              <Box
                component="tr"
                key={row.id}
                sx={{
                  borderBottom: 1,
                  borderColor: "divider",
                  "&:last-child": { borderBottom: 0 },
                  "& .row-delete": { opacity: 0 },
                  "&:hover .row-delete": { opacity: 1 },
                  "&:hover": { bgcolor: "surface" },
                }}
              >
                {columns.map((col) => (
                  <Box
                    component="td"
                    key={col.id}
                    sx={{
                      borderRight: 1,
                      borderColor: "divider",
                      px: 1.5,
                      py: 0.75,
                      verticalAlign: "top",
                    }}
                  >
                    <Cell
                      column={col}
                      value={row.cells[col.id] ?? null}
                      open={
                        cellAnchor?.row === row.id && cellAnchor?.col === col.id
                      }
                      anchorEl={
                        cellAnchor?.row === row.id && cellAnchor?.col === col.id
                          ? cellAnchor.el
                          : null
                      }
                      onOpen={(el) =>
                        setCellAnchor({ row: row.id, col: col.id, el })
                      }
                      onClose={() => setCellAnchor(null)}
                      onChange={(v) => setCell(row.id, col.id, v)}
                      onAddOption={(label) => addOption(col.id, label)}
                    />
                  </Box>
                ))}
                <Box component="td" sx={{ px: 1, py: 0.75, textAlign: "right", verticalAlign: "top" }}>
                  <IconButton
                    className="row-delete"
                    size="small"
                    onClick={() => deleteRow(row.id)}
                    title="Delete row"
                    sx={{
                      color: "text.secondary",
                      transition: "opacity 0.15s",
                      "&:hover": { color: "error.main" },
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              </Box>
            ))}

            {/* New row */}
            <Box component="tr">
              <Box component="td" colSpan={columns.length + 1} sx={{ px: 1.5, py: 1 }}>
                <Box
                  component="button"
                  onClick={addRow}
                  sx={{
                    display: "flex",
                    width: "100%",
                    alignItems: "center",
                    gap: 0.75,
                    border: 0,
                    bgcolor: "transparent",
                    p: 0,
                    textAlign: "left",
                    fontSize: 12,
                    fontFamily: "inherit",
                    color: "text.secondary",
                    cursor: "pointer",
                    "&:hover": { color: "text.primary" },
                  }}
                >
                  <Box component="span" sx={{ fontSize: 16, lineHeight: 1 }}>
                    +
                  </Box>{" "}
                  New
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </Paper>

      {sort && (
        <MuiLink
          component="button"
          variant="caption"
          underline="hover"
          onClick={() => setSort(null)}
          sx={{ mt: 1 }}
        >
          Clear sort ({columns.find((c) => c.id === sort.col)?.name} · {sort.dir})
        </MuiLink>
      )}

      {/* Column menu */}
      <Popover
        open={Boolean(menuAnchor && menuColumn)}
        anchorEl={menuAnchor?.el ?? null}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { sx: { width: 256, maxHeight: "70vh", borderRadius: 3, p: 0.5 } } }}
      >
        {menuColumn && (
          <ColumnMenu
            column={menuColumn}
            canDelete={menuColIndex !== 0 && columns.length > 1}
            onRename={(name) => updateColumn(menuColumn.id, { name })}
            onType={(type) => updateColumn(menuColumn.id, { type })}
            onSortAsc={() => {
              setSort({ col: menuColumn.id, dir: "asc" });
              setMenuAnchor(null);
            }}
            onSortDesc={() => {
              setSort({ col: menuColumn.id, dir: "desc" });
              setMenuAnchor(null);
            }}
            onInsertLeft={() => insertColumn(menuColIndex)}
            onInsertRight={() => insertColumn(menuColIndex + 1)}
            onDelete={() => deleteColumn(menuColumn.id)}
            onOptionsChange={(opts) =>
              updateColumn(menuColumn.id, { options: opts })
            }
          />
        )}
      </Popover>
    </Box>
  );
}

// --------------------------------------------------------------------------

function ColumnMenu({
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
function OptionsEditor({
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

// --------------------------------------------------------------------------

function Cell({
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

// Text/number cell with a local buffer; persists on blur or Enter so we don't
// write to Firestore on every keystroke.
function TextCell({
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
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }
  return (
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
  );
}

// Search-or-create popover for select / multi-select / status cells. In single
// mode picking closes the popover (via onPick); in multi mode it stays open so
// several options can be toggled.
function OptionPopover({
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
      <Box sx={{ maxHeight: 192, overflowY: "auto" }}>
        {!multi && value && (
          <MenuItem
            onClick={() => onPick?.("")}
            sx={{ borderRadius: 1.5, fontSize: 12, color: "text.secondary" }}
          >
            Clear
          </MenuItem>
        )}
        {filtered.map((o) => (
          <MenuItem
            key={o.id}
            onClick={() => (multi ? onToggle?.(o.id) : onPick?.(o.id))}
            sx={{ borderRadius: 1.5, justifyContent: "space-between" }}
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
            sx={{ borderRadius: 1.5, fontSize: 14, gap: 0.75 }}
          >
            Create
            <Chip label={q.trim()} sx={{ height: 20, fontSize: 11, bgcolor: "surface" }} />
          </MenuItem>
        )}
      </Box>
    </Popover>
  );
}
