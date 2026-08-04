import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import DownloadIcon from "@mui/icons-material/Download";
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
  onOpenExportAttendance?: () => void;
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
  onOpenExportAttendance,
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
          {employees.map((emp) => (
            <MenuItem key={emp.uid || emp.id} value={emp.uid || emp.id}>
              {emp.name}
            </MenuItem>
          ))}
        </Select>
        <Select
          size="small"
          value={filterDepartment}
          onChange={(e) => setFilterDepartment(e.target.value)}
          sx={{ minWidth: 130, borderRadius: 2, fontSize: 14 }}
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
      <Box
        sx={{
          display: "flex",
          gap: 1.5,
          flexWrap: "wrap",
          width: { xs: "100%", md: "auto" },
          "& .MuiButton-root": {
            flex: { xs: "1 1 100%", sm: "0 0 auto" },
          },
        }}
      >
        {onOpenExportAttendance && (
          <Button
            variant="outlined"
            onClick={onOpenExportAttendance}
            sx={{ borderRadius: 3, px: 3 }}
          >
            <DownloadIcon sx={{ mr: 0.8, fontSize: 18 }} />
            Export Attendance
          </Button>
        )}
        <Button
          variant="contained"
          onClick={onOpenMarkAttendance}
          sx={{ borderRadius: 3, px: 3 }}
        >
          Mark Attendance
        </Button>
      </Box>
    </Box>
  );
}
