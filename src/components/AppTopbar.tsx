"use client";

// Slim top bar: a path-derived breadcrumb on the left and the global "Ask AI"
// trigger on the right (also reachable via ⌘K).

import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { useAi } from "@/components/ai/AiProvider";
import { useAuth } from "@/lib/firebase/auth-context";

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
  const { openAi } = useAi();
  const { isAdmin } = useAuth();

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
          }}
          startIcon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
            </svg>
          }
        >
          Ask AI
          <Box
            component="kbd"
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: 0.5,
              px: 0.5,
              fontSize: 10,
              fontWeight: 500,
              opacity: 0.7,
              fontFamily: "inherit",
            }}
          >
            ⌘K
          </Box>
        </Button>
      )}
    </Box>
  );
}
