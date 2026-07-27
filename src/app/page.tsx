"use client";

// Landing route ("/"): send signed-out visitors to login and signed-in users
// to their role's home screen (admin/employee → dashboard, intern → My Space).
// Auth state only exists on the client (Firebase SDK), so this redirect
// happens client-side, and it waits for the role to resolve so nobody is
// bounced to the wrong screen mid-load.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { useAuth } from "@/lib/firebase/auth-context";
import { ROLE_HOME } from "@/lib/data/types";

export default function Home() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (role) router.replace(ROLE_HOME[role]);
  }, [user, role, loading, router]);

  return (
    <Box
      component="main"
      sx={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <CircularProgress size={22} />
    </Box>
  );
}
