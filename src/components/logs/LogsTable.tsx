"use client";

import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Paper from "@mui/material/Paper";
import type { AdminLog } from "@/lib/data/types";
import { alpha } from "@mui/material/styles";

interface LogsTableProps {
  logs: AdminLog[];
}

export function LogsTable({ logs }: LogsTableProps) {
  if (logs.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: "center", borderRadius: 3, bgcolor: "background.paper" }}>
        <Typography color="text.secondary">No logs found matching your filters.</Typography>
      </Paper>
    );
  }

  return (
    <TableContainer
      component={Paper}
      sx={{
        borderRadius: 3,
        maxHeight: "68vh",
        overflowY: "auto",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        animation: "pop-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "&::-webkit-scrollbar": { width: 8, height: 8 },
        "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
        "&::-webkit-scrollbar-thumb": {
          bgcolor: (theme) => alpha(theme.palette.text.secondary, 0.2),
          borderRadius: 4,
          transition: "background-color 0.2s ease",
          "&:hover": {
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.5),
          },
        },
        scrollbarWidth: "thin",
      }}
    >
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow
            sx={{
              "& th": {
                bgcolor: (theme) =>
                  theme.palette.mode === "dark"
                    ? alpha("#121824", 0.95)
                    : alpha(theme.palette.primary.main, 0.05),
                backdropFilter: "blur(8px)",
                fontSize: "0.75rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "text.secondary",
                py: 1.75,
                borderBottom: "2px solid",
                borderColor: (theme) => alpha(theme.palette.primary.main, 0.12),
              },
            }}
          >
            <TableCell sx={{ width: "22%" }}>Timestamp</TableCell>
            <TableCell sx={{ width: "28%" }}>Admin</TableCell>
            <TableCell>Action & Details</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {logs.map((log) => {
            const dateStr = log.timestamp && typeof (log.timestamp as any).toDate === "function"
              ? (log.timestamp as any).toDate().toLocaleString()
              : log.timestamp instanceof Date
                ? log.timestamp.toLocaleString()
                : "Pending...";

            return (
              <TableRow
                key={log.id}
                hover
                sx={{
                  transition: "all 0.2s ease-in-out",
                  position: "relative",
                  "&:hover": {
                    bgcolor: "action.hover",
                    "& td": { color: "primary.main" },
                    "& td:first-of-type": {
                      boxShadow: "inset 3px 0 0 0 var(--mui-palette-primary-main)",
                    },
                  },
                }}
              >
                <TableCell>
                  <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
                    {dateStr}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Avatar
                      src={log.adminPhotoUrl || undefined}
                      alt={log.adminName}
                      sx={{ width: 28, height: 28, fontSize: 12, bgcolor: "primary.main" }}
                    >
                      {log.adminName.charAt(0).toUpperCase()}
                    </Avatar>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {log.adminName}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: "text.primary" }}>
                    {log.action}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", mt: 0.5, display: "block" }}>
                    {log.details}
                  </Typography>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
