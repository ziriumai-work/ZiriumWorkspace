import Chip from "@mui/material/Chip";
import { chipSx } from "@/components/projectMeta";
import { optionColors } from "@/lib/theme/colors";
import { type ColumnType, type OptionColor, type SelectOption } from "@/lib/data/types";

export const uuid = () => crypto.randomUUID();

export const ALL_COLORS: OptionColor[] = [
  "gray",
  "blue",
  "green",
  "yellow",
  "orange",
  "red",
  "purple",
  "pink",
];

export const TYPE_LABELS: Record<ColumnType, string> = {
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

export const TYPE_ICONS: Record<ColumnType, string> = {
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

export const TYPE_ORDER: ColumnType[] = [
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

export const OPTION_TYPES: ColumnType[] = ["select", "multi_select", "status"];

export function OptionBadge({ option }: { option: SelectOption }) {
  const base = optionColors[option.color] ?? optionColors.gray;
  return (
    <Chip label={option.label} sx={[chipSx(base), { height: 20, fontSize: 11 }]} />
  );
}
