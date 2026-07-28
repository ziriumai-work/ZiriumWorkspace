import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { CompanyDocument } from "@/lib/data/types";
import { logAdminAction } from "./logs";

export const DOCUMENTS_COLLECTION = "documents";

// Pre-defined document IDs for guidelines
export const GUIDELINES_EMPLOYEE_ID = "guidelines_employee";
export const GUIDELINES_INTERN_ID = "guidelines_intern";

export function subscribeToDocument(
  docId: string,
  onData: (doc: CompanyDocument | null) => void,
  onError?: (err: Error) => void
) {
  return onSnapshot(
    doc(db, DOCUMENTS_COLLECTION, docId),
    (snap) => {
      if (snap.exists()) {
        onData({ id: snap.id, ...snap.data() } as CompanyDocument);
      } else {
        onData(null);
      }
    },
    (err) => onError?.(err)
  );
}

// Get a specific document once
export async function getCompanyDocument(docId: string): Promise<CompanyDocument | null> {
  const snap = await getDoc(doc(db, DOCUMENTS_COLLECTION, docId));
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as CompanyDocument;
  }
  return null;
}

// Update or create a document (Admin only)
export async function updateCompanyDocument(docId: string, data: Partial<Omit<CompanyDocument, "id" | "updatedAt">>) {
  await setDoc(doc(db, DOCUMENTS_COLLECTION, docId), {
    ...data,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await logAdminAction("Updated Company Document", `Updated document: ${docId}`);
}
