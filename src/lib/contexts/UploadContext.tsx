"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase/client";
import type { TaskFile } from "@/lib/data/types";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import { keyframes } from "@mui/system";

interface UploadState {
  id: string;
  fileName: string;
  progress: number;
}

interface UploadContextType {
  uploadFile: (path: string, file: File) => Promise<TaskFile>;
}

const UploadContext = createContext<UploadContextType | null>(null);

const slideUp = keyframes`
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

export function UploadProvider({ children }: { children: ReactNode }) {
  const [uploads, setUploads] = useState<UploadState[]>([]);

  const uploadFile = (path: string, file: File): Promise<TaskFile> => {
    return new Promise((resolve, reject) => {
      const uploadId = Math.random().toString(36).substring(7);
      
      setUploads((prev) => [
        ...prev,
        { id: uploadId, fileName: file.name, progress: 0 },
      ]);

      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploads((prev) =>
            prev.map((u) => (u.id === uploadId ? { ...u, progress } : u))
          );
        },
        (error) => {
          setUploads((prev) => prev.filter((u) => u.id !== uploadId));
          reject(error);
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          setUploads((prev) => prev.filter((u) => u.id !== uploadId));
          resolve({ name: file.name, url });
        }
      );
    });
  };

  return (
    <UploadContext.Provider value={{ uploadFile }}>
      {children}
      {uploads.length > 0 && (
        <Box
          sx={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            animation: `${slideUp} 0.3s ease-out`,
          }}
        >
          {uploads.map((u) => (
            <Paper
              key={u.id}
              elevation={8}
              sx={{
                p: 2,
                minWidth: 280,
                bgcolor: "background.paper",
                borderRadius: 2,
                border: "1px solid",
                borderColor: "primary.main",
                boxShadow: "0 4px 20px rgba(0, 229, 255, 0.2)",
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }} noWrap>
                Uploading: {u.fileName}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={u.progress}
                  sx={{
                    flexGrow: 1,
                    height: 6,
                    borderRadius: 3,
                    bgcolor: "action.hover",
                    "& .MuiLinearProgress-bar": {
                      borderRadius: 3,
                      backgroundImage: "linear-gradient(90deg, #00E5FF, #2979FF)",
                    },
                  }}
                />
                <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 32 }}>
                  {Math.round(u.progress)}%
                </Typography>
              </Box>
            </Paper>
          ))}
        </Box>
      )}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error("useUpload must be used within an UploadProvider");
  }
  return context;
}
