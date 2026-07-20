"use client";

// Slim top bar: a path-derived breadcrumb on the left and the global "Ask AI"
// trigger on the right (also reachable via ⌘K).

import { usePathname, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Badge from "@mui/material/Badge";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import Tooltip from "@mui/material/Tooltip";
import { useAi } from "@/components/ai/AiProvider";
import { useAuth } from "@/lib/firebase/auth-context";
import { subscribeToPendingLeaveRequests } from "@/lib/data/leaves";
import { useEffect, useState } from "react";

function crumbFromPath(pathname: string): string {
  const seg = pathname.split("/").filter(Boolean)[0] ?? "dashboard";
  if (seg === "projects") return "Projects";
  if (seg === "dashboard") return "Dashboard";
  if (seg === "intern") return "My Space";
  if (seg === "zirium") return "Zirium AI";
  if (seg === "team") return "Employees";
  if (seg === "tasks") return "Tasks";
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}

export function AppTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { openAi } = useAi();
  const { isAdmin } = useAuth();
  const [pendingLeaves, setPendingLeaves] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = subscribeToPendingLeaveRequests((reqs) => {
      setPendingLeaves(reqs.length);
    });
    return unsub;
  }, [isAdmin]);

  return (
    <Box
      component="header"
      sx={{
        height: 48,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: 1,
        borderColor: "divider",
        px: 3,
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {crumbFromPath(pathname)}
      </Typography>

      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        {isAdmin && (
          <Tooltip title="Approvals required">
            <IconButton 
              onClick={() => router.push("/attendance/leaves")} 
              sx={{
                color: pendingLeaves > 0 ? "primary.main" : "inherit",
                "&:hover": {
                  bgcolor: "action.hover",
                }
              }}
            >
              <Badge 
                badgeContent={pendingLeaves} 
                sx={{ 
                  "& .MuiBadge-badge": { 
                    bgcolor: pendingLeaves > 0 ? "#22c55e" : "transparent", 
                    color: "white",
                    fontWeight: "bold",
                    fontSize: "0.65rem",
                    minWidth: "16px",
                    height: "16px",
                    padding: "0 4px",
                  } 
                }}
              >
                <TaskAltIcon sx={{ fontSize: 28 }} />
              </Badge>
            </IconButton>
          </Tooltip>
        )}
        
        {/* AI is admin-only (see the role matrix) — hide the trigger otherwise. */}
        {isAdmin && (
        <Button
          onClick={() => openAi()}
          variant="outlined"
          sx={{
            bgcolor: "accentSoft",
            borderColor: "divider",
            fontSize: 12,
            gap: 1,
            color: "text.primary",
            "&:hover": {
              bgcolor: "action.hover",
            }
          }}
          startIcon={
            <img src="/logo.png" alt="Zirium AI" style={{ width: 16, height: 16, borderRadius: 4 }} />
          }
        >
          Ask AI
        </Button>
      )}
      </Box>
    </Box>
  );
}
