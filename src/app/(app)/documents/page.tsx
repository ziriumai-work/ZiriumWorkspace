"use client";

import { useEffect, useState } from "react";
import { 
  Box, 
  Typography, 
  Paper, 
  CircularProgress,
  Tabs,
  Tab,
  Button,
  TextField,
  Divider,
  Chip
} from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import DeleteIcon from "@mui/icons-material/Delete";
import { useAuth } from "@/lib/firebase/auth-context";
import { 
  getCompanyDocument, 
  updateCompanyDocument, 
  GUIDELINES_EMPLOYEE_ID, 
  GUIDELINES_INTERN_ID,
  subscribeToDocument
} from "@/lib/data/documents";
import { uploadDocumentFile } from "@/lib/firebase/storage";
import type { CompanyDocument, TaskFile } from "@/lib/data/types";
import { Toast } from "@/components/ui/Toast";
import Markdown from "react-markdown";

export default function DocumentsPage() {
  const { role, isAdmin } = useAuth();
  
  // Admin state
  const [activeTab, setActiveTab] = useState(0); // 0 = Employee, 1 = Intern
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Toast state
  const [toastMsg, setToastMsg] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Data state
  const [employeeDoc, setEmployeeDoc] = useState<CompanyDocument | null>(null);
  const [internDoc, setInternDoc] = useState<CompanyDocument | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  useEffect(() => {
    let u1: () => void;
    let u2: () => void;

    if (isAdmin) {
      u1 = subscribeToDocument(GUIDELINES_EMPLOYEE_ID, (d) => {
        setEmployeeDoc(d);
        setLoading(false);
      }, (err) => {
        console.error(err);
        setLoading(false);
      });
      u2 = subscribeToDocument(GUIDELINES_INTERN_ID, (d) => {
        setInternDoc(d);
        setLoading(false);
      }, (err) => {
        console.error(err);
        setLoading(false);
      });
    } else {
      const docId = role === "intern" ? GUIDELINES_INTERN_ID : GUIDELINES_EMPLOYEE_ID;
      u1 = subscribeToDocument(docId, (d) => {
        if (role === "intern") setInternDoc(d);
        else setEmployeeDoc(d);
        setLoading(false);
      }, (err) => {
        console.error(err);
        setLoading(false);
      });
    }

    return () => {
      if (u1) u1();
      if (u2) u2();
    };
  }, [isAdmin, role]);

  const activeDocId = activeTab === 0 ? GUIDELINES_EMPLOYEE_ID : GUIDELINES_INTERN_ID;
  const currentDoc = isAdmin 
    ? (activeTab === 0 ? employeeDoc : internDoc)
    : (role === "intern" ? internDoc : employeeDoc);

const EMPLOYEE_TEMPLATE = `# Welcome to Zirium! 🎉

We are thrilled to have you on the team. Please review our core guidelines and regulations below.

## 🕒 Office Hours & Attendance
- **Standard Office Hours**: 10:00 AM - 6:00 PM.
- **Clock-In**: You are expected to clock in when you begin working. If you clock in after 11:00 AM, the system will mark you as **Late**.
- **Flexibility Time**: We understand that life happens! Each employee receives a designated amount of flexibility hours per week. If you are late, the system will automatically deduct from your flexibility pool. If you run out of flexibility hours, further late arrivals will be flagged.
- **Overtime**: Authorized overtime is tracked directly in your daily tasks. Overtime compensation is calculated based on your base monthly salary.

## ✅ Daily Tasks & Reporting
- Tasks are assigned to you by your team lead or administrator.
- You can view all your active tasks in the **My Tasks** section.
- You are required to update the status of your tasks and provide a **Task Report** (including relevant links or file attachments) upon completion.

## 🤝 Code of Conduct
1. **Communication**: Keep all project-related communication within official channels.
2. **Confidentiality**: Do not share proprietary code, project details, or internal files outside the company.
3. **Respect**: We foster an inclusive, respectful, and collaborative environment.

If you have any questions or require assistance, please reach out to your team admin.`;

const INTERN_TEMPLATE = `# Welcome to the Zirium Internship Program! 🚀

We are excited to help you grow and learn. Please review the guidelines for your internship below.

## 🕒 Office Hours & Attendance
- Your working hours are defined by your specific intern agreement.
- **Clock-In**: You must log your attendance daily. Timely attendance is a key metric in your internship evaluation.
- **Flexibility**: Please coordinate with your manager if you need to adjust your hours for academic or personal reasons.

## 📚 Learning & Tasks
- You will be assigned specific tasks and learning objectives via the **Tasks** section.
- Don't hesitate to ask questions! Your assigned tasks are as much about learning as they are about execution.
- Please provide detailed updates in your **Task Reports** so we can track your progress and provide constructive feedback.

## 🤝 Intern Regulations
1. **Mentorship**: Work closely with your assigned lead. We are here to support your growth.
2. **Confidentiality**: All project work, codebases, and internal documents are strictly confidential.
3. **Feedback**: We value your fresh perspective. Share your ideas and feedback openly!

Enjoy your time at Zirium, and let's build something great together!`;

  // Sync form state when editing starts
  useEffect(() => {
    if (editing && currentDoc) {
      setContent(currentDoc.content || (activeTab === 0 ? EMPLOYEE_TEMPLATE : INTERN_TEMPLATE));
      setFiles(currentDoc.files || []);
      setPendingFiles([]);
    } else if (editing && !currentDoc) {
      setContent(activeTab === 0 ? EMPLOYEE_TEMPLATE : INTERN_TEMPLATE);
      setFiles([]);
      setPendingFiles([]);
    }
  }, [editing, currentDoc, activeTab]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Upload pending files
      const uploadedFiles: TaskFile[] = [];
      for (const file of pendingFiles) {
        const tf = await uploadDocumentFile(activeDocId, file);
        uploadedFiles.push(tf);
      }

      const allFiles = [...files, ...uploadedFiles];

      await updateCompanyDocument(activeDocId, {
        content,
        files: allFiles,
      });

      // Optimistic update in case the background listener was detached due to previous errors
      const updatedDoc = {
        id: activeDocId,
        content,
        files: allFiles,
        links: currentDoc?.links || [],
        title: currentDoc?.title || "",
        updatedAt: currentDoc?.updatedAt || null
      };
      if (activeTab === 0) setEmployeeDoc(updatedDoc);
      else setInternDoc(updatedDoc);
      
      setEditing(false);
      setPendingFiles([]);
      setToastMsg({ message: "Document saved successfully!", type: "success" });
    } catch (err: any) {
      console.error("Failed to save document. Error details:", err);
      console.error("Error code:", err.code);
      console.error("Error message:", err.message);
      setToastMsg({ message: `Failed to save document: ${err.message}`, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const removeFile = (idx: number, isPending: boolean) => {
    if (isPending) {
      setPendingFiles(prev => prev.filter((_, i) => i !== idx));
    } else {
      setFiles(prev => prev.filter((_, i) => i !== idx));
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 860, mx: "auto", px: 4, py: 5 }}>
      <Box component="header" sx={{ mb: 4 }}>
        <Typography variant="h1">Documents & Guidelines</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {isAdmin 
            ? "Manage the rules, office hours, and onboarding documents for employees and interns."
            : "Review company rules, office hours, and your onboarding documents."}
        </Typography>
      </Box>

      {isAdmin && (
        <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
          <Tabs 
            value={activeTab} 
            onChange={(_, val) => {
              setActiveTab(val);
              setEditing(false);
            }}
          >
            <Tab label="Employee Guidelines" />
            <Tab label="Intern Guidelines" />
          </Tabs>
        </Box>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden", mb: 4 }}>
        {isAdmin && (
          <Box sx={{ px: 3, py: 2, bgcolor: "surface", borderBottom: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {activeTab === 0 ? "Employee Rules & NDAs" : "Intern Rules & NDAs"}
            </Typography>
            {!editing ? (
              <Button variant="outlined" size="small" onClick={() => setEditing(true)}>Edit Content</Button>
            ) : (
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button size="small" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
                <Button variant="contained" size="small" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </Box>
            )}
          </Box>
        )}

        <Box sx={{ p: 4 }}>
          {editing ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <TextField
                label="Guidelines Content (Markdown supported)"
                multiline
                minRows={8}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                fullWidth
                placeholder="Enter rules, office hours, etc..."
              />
              
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Attachments</Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
                  {files.map((f, i) => (
                    <Chip 
                      key={`existing-${i}`} 
                      label={f.name} 
                      onDelete={() => removeFile(i, false)}
                      deleteIcon={<DeleteIcon />}
                    />
                  ))}
                  {pendingFiles.map((f, i) => (
                    <Chip 
                      key={`pending-${i}`} 
                      label={f.name} 
                      onDelete={() => removeFile(i, true)}
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Box>
                <Button variant="outlined" component="label" startIcon={<AttachFileIcon />}>
                  Add File
                  <input 
                    type="file" 
                    hidden 
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        setPendingFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                      }
                      e.target.value = "";
                    }} 
                  />
                </Button>
              </Box>
            </Box>
          ) : (
            <Box>
              <Box sx={{ '& h1, & h2, & h3': { mt: 0, mb: 2 }, '& p': { mb: 2, lineHeight: 1.6 }, '& ul, & ol': { mt: 0, mb: 2, pl: 3 } }}>
                <Markdown>{currentDoc?.content || "*No guidelines provided yet.*"}</Markdown>
              </Box>
              
              {currentDoc?.files && currentDoc.files.length > 0 && (
                <>
                  <Divider sx={{ my: 3 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Attached Documents
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    {currentDoc.files.map((f, i) => (
                      <Chip
                        key={i}
                        icon={<AttachFileIcon sx={{ fontSize: "16px !important" }} />}
                        label={f.name}
                        component="a"
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        clickable
                        variant="outlined"
                        sx={{ fontWeight: 500 }}
                      />
                    ))}
                  </Box>
                </>
              )}
            </Box>
          )}
        </Box>
      </Paper>
      {/* Render Toast Message */}
      {toastMsg && (
        <Toast
          open={!!toastMsg}
          message={toastMsg.message}
          type={toastMsg.type}
          onClose={() => setToastMsg(null)}
        />
      )}
    </Box>
  );
}
