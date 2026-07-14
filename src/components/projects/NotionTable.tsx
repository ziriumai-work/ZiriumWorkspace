"use client";

// A Notion-style database table: customizable columns with types, a column
// header menu (rename, change type, sort, insert, delete), typed cell editing,
// select/status options with colors, and add row / add column. The parent owns
// persistence — every change calls onColumnsChange / onRowsChange, which write
// the full arrays back to Firestore.

import { useMemo, useState } from "react";
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

const OPTION_BADGE: Record<OptionColor, string> = {
  gray: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  green: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  pink: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
};

// Solid swatch colours for the option color picker.
const OPTION_DOT: Record<OptionColor, string> = {
  gray: "bg-neutral-400",
  blue: "bg-blue-400",
  green: "bg-green-500",
  yellow: "bg-yellow-400",
  orange: "bg-orange-400",
  red: "bg-red-400",
  purple: "bg-purple-400",
  pink: "bg-pink-400",
};

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
  const [menuCol, setMenuCol] = useState<string | null>(null);
  const [openCell, setOpenCell] = useState<{ row: string; col: string } | null>(
    null,
  );
  const [sort, setSort] = useState<{ col: string; dir: "asc" | "desc" } | null>(
    null,
  );

  // ----- column ops -----
  function updateColumn(id: string, patch: Partial<DbColumn>) {
    onColumnsChange(columns.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function deleteColumn(id: string) {
    onColumnsChange(columns.filter((c) => c.id !== id));
    setMenuCol(null);
  }
  function insertColumn(index: number) {
    const col: DbColumn = { id: uuid(), name: "New column", type: "text" };
    const next = [...columns];
    next.splice(index, 0, col);
    onColumnsChange(next);
    setMenuCol(col.id);
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

  const anyOpen = menuCol !== null || openCell !== null;

  return (
    <div className="relative">
      {/* click-away backdrop for menus/popovers */}
      {anyOpen && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => {
            setMenuCol(null);
            setOpenCell(null);
          }}
        />
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              {columns.map((col, i) => (
                <th
                  key={col.id}
                  className="relative border-r border-border px-3 py-2 text-left font-medium"
                >
                  <button
                    onClick={() =>
                      setMenuCol(menuCol === col.id ? null : col.id)
                    }
                    className="flex w-full items-center gap-1.5 text-xs text-muted transition hover:text-foreground"
                  >
                    <span className="opacity-60">{TYPE_ICONS[col.type]}</span>
                    <span className="truncate">{col.name}</span>
                  </button>

                  {menuCol === col.id && (
                    <ColumnMenu
                      column={col}
                      canDelete={i !== 0 && columns.length > 1}
                      onRename={(name) => updateColumn(col.id, { name })}
                      onType={(type) => updateColumn(col.id, { type })}
                      onSortAsc={() => {
                        setSort({ col: col.id, dir: "asc" });
                        setMenuCol(null);
                      }}
                      onSortDesc={() => {
                        setSort({ col: col.id, dir: "desc" });
                        setMenuCol(null);
                      }}
                      onInsertLeft={() => insertColumn(i)}
                      onInsertRight={() => insertColumn(i + 1)}
                      onDelete={() => deleteColumn(col.id)}
                      onOptionsChange={(opts) =>
                        updateColumn(col.id, { options: opts })
                      }
                    />
                  )}
                </th>
              ))}
              <th className="w-10 px-2 py-2">
                <button
                  onClick={() => insertColumn(columns.length)}
                  title="Add column"
                  className="rounded px-1.5 text-muted transition hover:bg-card hover:text-foreground"
                >
                  +
                </button>
              </th>
            </tr>
          </thead>

          <tbody>
            {displayRows.map((row) => (
              <tr
                key={row.id}
                className="group border-b border-border last:border-0 hover:bg-surface/60"
              >
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className="border-r border-border px-3 py-1.5 align-top"
                  >
                    <Cell
                      column={col}
                      value={row.cells[col.id] ?? null}
                      open={
                        openCell?.row === row.id && openCell?.col === col.id
                      }
                      onOpen={() => setOpenCell({ row: row.id, col: col.id })}
                      onClose={() => setOpenCell(null)}
                      onChange={(v) => setCell(row.id, col.id, v)}
                      onAddOption={(label) => addOption(col.id, label)}
                    />
                  </td>
                ))}
                <td className="px-2 py-1.5 text-right align-top">
                  <button
                    onClick={() => deleteRow(row.id)}
                    className="rounded px-1 text-xs text-muted opacity-0 transition hover:text-red-600 group-hover:opacity-100"
                    title="Delete row"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}

            {/* New row */}
            <tr>
              <td
                colSpan={columns.length + 1}
                className="px-3 py-2 text-xs text-muted"
              >
                <button
                  onClick={addRow}
                  className="flex w-full items-center gap-1.5 text-left transition hover:text-foreground"
                >
                  <span className="text-base leading-none">+</span> New
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {sort && (
        <button
          onClick={() => setSort(null)}
          className="mt-2 text-xs text-accent hover:underline"
        >
          Clear sort ({columns.find((c) => c.id === sort.col)?.name} ·{" "}
          {sort.dir})
        </button>
      )}
    </div>
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
    <div className="absolute left-0 top-full z-30 mt-1 max-h-[70vh] w-64 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-xl animate-pop-in">
      <input
        autoFocus
        defaultValue={column.name}
        onChange={(e) => onRename(e.target.value)}
        className="mb-1 w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-accent"
      />

      {/* Change type — collapsible, Notion-style list */}
      <button
        onClick={() => setTypeOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition hover:bg-surface"
      >
        <span className="flex items-center gap-2 text-muted">
          <span className="w-4 text-center text-xs opacity-70">↻</span>
          Change type
        </span>
        <span className="flex items-center gap-1 text-xs text-muted">
          {TYPE_LABELS[column.type]} <span>{typeOpen ? "▾" : "▸"}</span>
        </span>
      </button>
      {typeOpen && (
        <div className="mb-1 max-h-56 overflow-y-auto rounded-lg bg-surface/60 p-1">
          {TYPE_ORDER.map((t) => (
            <button
              key={t}
              onClick={() => {
                onType(t);
                setTypeOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-card"
            >
              <span className="flex items-center gap-2">
                <span className="w-4 text-center text-xs opacity-70">
                  {TYPE_ICONS[t]}
                </span>
                {TYPE_LABELS[t]}
              </span>
              {column.type === t && (
                <span className="text-xs text-accent">✓</span>
              )}
            </button>
          ))}
        </div>
      )}

      {hasOptions && (
        <>
          <div className="my-1 border-t border-border" />
          <OptionsEditor
            options={column.options ?? []}
            onChange={onOptionsChange}
          />
        </>
      )}

      <div className="my-1 border-t border-border" />
      <MenuItem label="Sort ascending" onClick={onSortAsc} />
      <MenuItem label="Sort descending" onClick={onSortDesc} />
      <div className="my-1 border-t border-border" />
      <MenuItem label="Insert left" onClick={onInsertLeft} />
      <MenuItem label="Insert right" onClick={onInsertRight} />
      {canDelete && (
        <>
          <div className="my-1 border-t border-border" />
          <MenuItem label="Delete column" danger onClick={onDelete} />
        </>
      )}
    </div>
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
    <div className="px-1 pb-1">
      <p className="px-1 py-1 text-[11px] font-medium uppercase tracking-wide text-muted">
        Options
      </p>

      <div className="flex flex-col gap-1">
        {options.map((o) => (
          <div key={o.id} className="relative">
            <div className="flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-surface">
              {/* color swatch -> opens palette */}
              <button
                onClick={() => setColorFor(colorFor === o.id ? null : o.id)}
                className={`h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10 ${OPTION_DOT[o.color]}`}
                title="Change colour"
              />
              <input
                value={o.label}
                onChange={(e) => update(o.id, { label: e.target.value })}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <button
                onClick={() => remove(o.id)}
                className="shrink-0 text-xs text-muted transition hover:text-red-600"
                title="Delete option"
              >
                ✕
              </button>
            </div>

            {colorFor === o.id && (
              <div className="ml-5 mt-1 flex flex-wrap gap-1.5 rounded-lg border border-border bg-card p-2">
                {ALL_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      update(o.id, { color: c });
                      setColorFor(null);
                    }}
                    title={c}
                    className={`h-5 w-5 rounded-full ring-1 ring-black/10 transition hover:scale-110 ${OPTION_DOT[c]} ${
                      o.color === c ? "ring-2 ring-accent" : ""
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* add option */}
      <div className="mt-1 flex items-center gap-1">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add an option…"
          className="min-w-0 flex-1 rounded-md border border-border bg-transparent px-2 py-1 text-sm outline-none focus:border-accent"
        />
        <button
          onClick={add}
          disabled={!newLabel.trim()}
          className="rounded-md bg-accent px-2 py-1 text-xs font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`block w-full rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-surface ${
        danger ? "text-red-600" : ""
      }`}
    >
      {label}
    </button>
  );
}

// --------------------------------------------------------------------------

function Cell({
  column,
  value,
  open,
  onOpen,
  onClose,
  onChange,
  onAddOption,
}: {
  column: DbColumn;
  value: CellValue;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChange: (v: CellValue) => void;
  onAddOption: (label: string) => string;
}) {
  if (column.type === "checkbox") {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--accent)]"
      />
    );
  }

  if (column.type === "date") {
    return (
      <input
        type="date"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full bg-transparent text-sm outline-none"
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
      <div className="relative">
        <button
          onClick={open ? onClose : onOpen}
          className="flex min-h-[1.5rem] w-full flex-wrap items-center gap-1"
        >
          {chosen.length ? (
            chosen.map((o) => (
              <span
                key={o.id}
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${OPTION_BADGE[o.color]}`}
              >
                {o.label}
              </span>
            ))
          ) : (
            <span className="text-xs text-muted">Empty</span>
          )}
        </button>
        {open && (
          <MultiSelectPopover
            column={column}
            selected={ids}
            onToggle={(id) =>
              onChange(
                ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
              )
            }
            onCreate={(label) => onChange([...ids, onAddOption(label)])}
          />
        )}
      </div>
    );
  }

  if (column.type === "select" || column.type === "status") {
    const opt = column.options?.find((o) => o.id === value) ?? null;
    return (
      <div className="relative">
        <button
          onClick={open ? onClose : onOpen}
          className="flex min-h-[1.5rem] w-full items-center"
        >
          {opt ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${OPTION_BADGE[opt.color]}`}
            >
              {opt.label}
            </span>
          ) : (
            <span className="text-xs text-muted">Empty</span>
          )}
        </button>
        {open && (
          <SelectPopover
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
        )}
      </div>
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
    <input
      type={htmlType ?? "text"}
      value={draft}
      inputMode={numeric ? "numeric" : undefined}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
      placeholder="Empty"
    />
  );
}

function MultiSelectPopover({
  column,
  selected,
  onToggle,
  onCreate,
}: {
  column: DbColumn;
  selected: string[];
  onToggle: (id: string) => void;
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
    <div className="absolute left-0 top-full z-30 mt-1 w-52 rounded-xl border border-border bg-card p-1 shadow-xl animate-pop-in">
      <input
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
        className="mb-1 w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-accent"
      />
      <div className="max-h-48 overflow-y-auto">
        {filtered.map((o) => (
          <button
            key={o.id}
            onClick={() => onToggle(o.id)}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition hover:bg-surface"
          >
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${OPTION_BADGE[o.color]}`}
            >
              {o.label}
            </span>
            {selected.includes(o.id) && (
              <span className="text-xs text-accent">✓</span>
            )}
          </button>
        ))}
        {q.trim() && !exact && (
          <button
            onClick={() => {
              onCreate(q.trim());
              setQ("");
            }}
            className="block w-full rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-surface"
          >
            Create{" "}
            <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] dark:bg-neutral-700">
              {q.trim()}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

function SelectPopover({
  column,
  value,
  onPick,
  onCreate,
}: {
  column: DbColumn;
  value: string | null;
  onPick: (id: string) => void;
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
    <div className="absolute left-0 top-full z-30 mt-1 w-52 rounded-xl border border-border bg-card p-1 shadow-xl animate-pop-in">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && q.trim() && !exact) onCreate(q.trim());
        }}
        placeholder="Search or create…"
        className="mb-1 w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-accent"
      />
      <div className="max-h-48 overflow-y-auto">
        {value && (
          <button
            onClick={() => onPick("")}
            className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-muted transition hover:bg-surface"
          >
            Clear
          </button>
        )}
        {filtered.map((o) => (
          <button
            key={o.id}
            onClick={() => onPick(o.id)}
            className="block w-full rounded-md px-2 py-1.5 text-left transition hover:bg-surface"
          >
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${OPTION_BADGE[o.color]}`}
            >
              {o.label}
            </span>
          </button>
        ))}
        {q.trim() && !exact && (
          <button
            onClick={() => onCreate(q.trim())}
            className="block w-full rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-surface"
          >
            Create{" "}
            <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] dark:bg-neutral-700">
              {q.trim()}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
