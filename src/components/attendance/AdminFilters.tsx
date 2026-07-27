import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import { type Employee } from "@/lib/data/types";

interface AdminFiltersProps {
  employees: Employee[];
  filterUid: string;
  setFilterUid: (val: string) => void;
  filterDepartment: string;
  setFilterDepartment: (val: string) => void;
  filterRole: string;
  setFilterRole: (val: string) => void;
  onOpenMarkAttendance: () => void;
}

export function AdminFilters({
  employees,
  filterUid,
  setFilterUid,
  filterDepartment,
  setFilterDepartment,
  filterRole,
  setFilterRole,
  onOpenMarkAttendance,
}: AdminFiltersProps) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 2,
        mb: 4,
        mt: 6,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          Filter:
        </Typography>
        <Select
          size="small"
          value={filterUid}
          onChange={(e) => setFilterUid(e.target.value)}
          sx={{ minWidth: 150, borderRadius: 2, fontSize: 14 }}
        >
          <MenuItem value="all">All Employees</MenuItem>
          {employees
            .filter((e) => e.uid)
            .map((e) => (
              <MenuItem key={e.id} value={e.uid!}>
                {e.name}
              </MenuItem>
            ))}
        </Select>
        <Select
          size="small"
          value={filterDepartment}
          onChange={(e) => setFilterDepartment(e.target.value)}
          sx={{ minWidth: 120, borderRadius: 2, fontSize: 14 }}
        >
          <MenuItem value="all">All Depts</MenuItem>
          <MenuItem value="web">Web</MenuItem>
          <MenuItem value="ai">AI</MenuItem>
          <MenuItem value="app">App</MenuItem>
          <MenuItem value="custom">Custom</MenuItem>
        </Select>
        <Select
          size="small"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          sx={{ minWidth: 120, borderRadius: 2, fontSize: 14 }}
        >
          <MenuItem value="all">All Roles</MenuItem>
          <MenuItem value="employee">Employee</MenuItem>
          <MenuItem value="intern">Intern</MenuItem>
        </Select>
      </Box>
      <Button
        variant="contained"
        onClick={onOpenMarkAttendance}
        sx={{ borderRadius: 3, px: 3 }}
      >
        Mark Attendance
      </Button>
    </Box>
  );
}
