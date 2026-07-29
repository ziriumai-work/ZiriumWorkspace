"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useAuth } from "@/lib/firebase/auth-context";
import SalariesPage from "@/app/(app)/finance/salaries/page";

export default function EmployeeSalaryPage() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAdmin) {
      router.replace("/finance/salaries");
    }
  }, [isAdmin, loading, router]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box sx={{ borderBottom: 1, borderColor: "divider", px: 4, pt: 3, pb: 2 }}>
        <Typography variant="h2" sx={{ mb: 0.5 }}>
          My Salary
        </Typography>
        <Typography variant="body2" color="text.secondary">
          View your monthly salary details and confirm payment receipts.
        </Typography>
      </Box>
      <Box sx={{ flex: 1, overflowY: "auto" }}>
        <SalariesPage />
      </Box>
    </Box>
  );
}
