"use client";

// A Select styled as a soft colored pill/badge — the inline status editor used
// in tables and cards (tasks, projects, employees). The pill color follows the
// currently selected value via the shared chipSx helper.

import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { chipSx } from "@/components/projectMeta";

export function PillSelect<T extends string>({
  value,
  options,
  color,
  disabled,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  color: string;
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
      variant="standard"
      disableUnderline
      sx={[
        {
          borderRadius: 999,
          fontSize: 11,
          "& .MuiSelect-select": {
            py: 0.25,
            pl: 1.25,
            borderRadius: 999,
          },
          // Hide the dropdown arrow so it reads as a badge until interacted with.
          "& .MuiSelect-icon": { fontSize: 16, mr: 0.25 },
          "&.Mui-disabled .MuiSelect-icon": { display: "none" },
        },
        chipSx(color),
      ]}
    >
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value} sx={{ fontSize: 13 }}>
          {o.label}
        </MenuItem>
      ))}
    </Select>
  );
}
