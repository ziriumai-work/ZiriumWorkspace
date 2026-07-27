import React from "react";
import Link from "next/link";
import MuiLink from "@mui/material/Link";
import Box from "@mui/material/Box";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import KeyboardBackspaceIcon from "@mui/icons-material/KeyboardBackspace";

export function AnimatedActionLink({ 
  href, 
  children, 
  direction = "forward" 
}: { 
  href: string; 
  children: React.ReactNode;
  direction?: "forward" | "backward";
}) {
  return (
    <MuiLink
      component={Link}
      href={href}
      variant="caption"
      underline="none"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        fontWeight: 600,
        color: "text.secondary",
        px: 1.5,
        py: 0.5,
        borderRadius: "100px",
        transition: "all 0.2s ease",
        "&:hover": {
          bgcolor: "primary.main",
          color: "primary.contrastText",
          "& .arrow-icon-forward": {
            width: 14,
            opacity: 1,
            transform: "translateX(2px)",
            ml: 0.5,
          },
          "& .arrow-icon-backward": {
            width: 14,
            opacity: 1,
            transform: "translateX(-2px)",
            mr: 0.5,
          },
        },
      }}
    >
      {direction === "backward" && (
        <Box
          component="span"
          className="arrow-icon-backward"
          sx={{
            display: "inline-flex",
            width: 0,
            opacity: 0,
            transform: "translateX(4px)",
            transition: "all 0.2s ease",
            overflow: "hidden",
          }}
        >
          <KeyboardBackspaceIcon sx={{ fontSize: 14 }} />
        </Box>
      )}
      
      {children}
      
      {direction === "forward" && (
        <Box
          component="span"
          className="arrow-icon-forward"
          sx={{
            display: "inline-flex",
            width: 0,
            opacity: 0,
            transform: "translateX(-4px)",
            transition: "all 0.2s ease",
            overflow: "hidden",
          }}
        >
          <ArrowForwardIcon sx={{ fontSize: 14 }} />
        </Box>
      )}
    </MuiLink>
  );
}
