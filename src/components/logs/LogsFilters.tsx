"use client";

import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import { alpha } from "@mui/material/styles";

interface LogsFiltersProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  dateFilter: string;
  setDateFilter: (val: string) => void;
}

export function LogsFilters({
  searchQuery,
  setSearchQuery,
  dateFilter,
  setDateFilter,
}: LogsFiltersProps) {
  return (
    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 3 }}>
      <TextField
        placeholder="Search action or admin..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        size="small"
        sx={{
          minWidth: 280,
          "& .MuiOutlinedInput-root": {
            bgcolor: "background.paper",
            borderRadius: 3,
            transition: "all 0.2s ease",
            "& fieldset": { borderColor: (theme) => alpha(theme.palette.divider, 0.8) },
            "&:hover fieldset": { borderColor: "primary.main" },
            "&.Mui-focused fieldset": { borderColor: "primary.main", borderWidth: 2 },
          },
        }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: "text.secondary" }} />
              </InputAdornment>
            ),
          },
        }}
      />
      <TextField
        type="date"
        size="small"
        value={dateFilter}
        onChange={(e) => setDateFilter(e.target.value)}
        sx={{
          minWidth: 170,
          "& .MuiOutlinedInput-root": {
            bgcolor: "background.paper",
            borderRadius: 3,
            transition: "all 0.2s ease",
            "& fieldset": { borderColor: (theme) => alpha(theme.palette.divider, 0.8) },
            "&:hover fieldset": { borderColor: "primary.main" },
            "&.Mui-focused fieldset": { borderColor: "primary.main", borderWidth: 2 },
          },
          "& input": {
            colorScheme: (theme) => theme.palette.mode,
            cursor: "pointer",
          },
        }}
      />
    </Box>
  );
}
