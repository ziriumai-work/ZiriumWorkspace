"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Popover from "@mui/material/Popover";
import CloseIcon from "@mui/icons-material/Close";
import {
  OPTION_COLOR_CYCLE,
  type CellValue,
  type DbColumn,
  type DbRow,
  type OptionColor,
  type SelectOption,
} from "@/lib/data/types";

import { TYPE_ICONS, uuid } from "./utils";
import { Cell } from "./Cell";
import { ColumnMenu } from "./ColumnMenu";

export function NotionTable({
  columns,
  rows,
  onColumnsChange,
  onRowsChange,
  readonly,
}: {
  columns: DbColumn[];
  rows: DbRow[];
  onColumnsChange: (next: DbColumn[]) => void;
  onRowsChange: (next: DbRow[]) => void;
  readonly?: boolean;
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
                    onClick={(e: React.MouseEvent<HTMLElement>) => {
                      if (readonly) return;
                      setMenuAnchor(
                        menuAnchor?.colId === col.id
                          ? null
                          : { colId: col.id, el: e.currentTarget },
                      );
                    }}
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
                      cursor: readonly ? "default" : "pointer",
                      transition: "color 0.15s",
                      "&:hover": { color: readonly ? "text.secondary" : "text.primary" },
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
              {!readonly && (
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
              )}
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
                      onOpen={(el) => {
                        if (readonly && col.type !== "status") return;
                        setCellAnchor({ row: row.id, col: col.id, el });
                      }}
                      onClose={() => setCellAnchor(null)}
                      onChange={(v) => setCell(row.id, col.id, v)}
                      onAddOption={(label) => addOption(col.id, label)}
                    />
                  </Box>
                ))}
                {!readonly && (
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
                )}
              </Box>
            ))}

            {/* New row */}
            {!readonly && (
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
            )}
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
