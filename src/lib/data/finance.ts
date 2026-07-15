// Firestore data layer for the admin-only Finance section.
//
// Collections:
//   financeProjects/{id}  — commercial projects with worth / received money.
//   invoices/{id}         — generated invoices (items, currency, totals).
//   allotments/{id}       — monthly money-allotment entries (where money goes).
//   monthlyExpenses/{id}  — monthly sheet expense entries (salaries, utilities…).
//
// Everything is real-time: every section subscribes with onSnapshot, so a
// change in one section (e.g. money received on a project) instantly updates
// the dashboard and the monthly sheet's available balance.

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FinanceProjectStatus = "ongoing" | "completed";

export interface FinanceProject {
  id: string;
  name: string;
  worth: number; //          total contract value
  received: number; //       money received so far
  milestoneCount: number;
  status: FinanceProjectStatus;
  currency: string; //       "PKR" | "USD" | "EUR" etc.
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

// Pending is always derived so the numbers can never drift out of sync.
export function pendingOf(p: Pick<FinanceProject, "worth" | "received">): number {
  return p.worth - p.received;
}

export interface InvoiceItem {
  id: string;
  category: string; //       e.g. "Development", "Design", "Hosting"
  description: string;
  qty: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  number: string; //         e.g. INV-2026-001
  clientName: string;
  clientCompany: string;
  clientAddress: string;
  currency: string; //       ISO code from CURRENCIES
  items: InvoiceItem[];
  notes: string;
  paymentMethod: "ubl" | "wise";
  actualReceived: number | null;
  actualReceivedNote: string | null;
  exchangeRateToPkr: number | null;
  linkedInvoiceId: string | null;
  linkedInvoiceNumber: string | null;
  createdAt: Timestamp | null;
}

export function invoiceTotal(inv: Pick<Invoice, "items">): number {
  return inv.items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);
}

export interface Allotment {
  id: string;
  month: string; //          "yyyy-MM"
  label: string; //          where the money goes, e.g. "Marketing"
  amount: number; //         amount in PKR (converted from invoice using exchange rate)
  note: string;
  invoiceId: string | null; // which invoice funded this
  invoiceNumber: string | null;
  createdAt: Timestamp | null;
}

export interface MonthlyExpense {
  id: string;
  month: string; //          "yyyy-MM"
  type: string; //           "Salaries" | "Utilities" | ... (free-form allowed)
  label: string;
  amount: number; //         amount in PKR
  createdAt: Timestamp | null;
}

// Preset expense types for the monthly sheet (admin can type a custom one).
export const EXPENSE_TYPES = [
  "Salaries",
  "Utilities",
  "Rent",
  "Internet",
  "Software & Tools",
  "Marketing",
  "Equipment",
  "Miscellaneous",
];

// Currency options for invoices (symbol used in the UI and the PDF).
export const CURRENCIES: { code: string; symbol: string; label: string }[] = [
  { code: "PKR", symbol: "Rs", label: "Pakistani Rupee" },
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "AED", symbol: "د.إ", label: "UAE Dirham" },
  { code: "SAR", symbol: "﷼", label: "Saudi Riyal" },
  { code: "INR", symbol: "₹", label: "Indian Rupee" },
];

export function currencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

/** Format a number as money, e.g. 1234567.5 → "1,234,567.50". */
export function formatAmount(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/** Current month in the "yyyy-MM" key format used by allotments/expenses. */
export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

// ---------------------------------------------------------------------------
// financeProjects
// ---------------------------------------------------------------------------

const PROJECTS = "financeProjects";

export function subscribeToFinanceProjects(
  onData: (projects: FinanceProject[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, PROJECTS), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: (data.name as string) ?? "Untitled",
            worth: (data.worth as number) ?? 0,
            received: (data.received as number) ?? 0,
            milestoneCount: (data.milestoneCount as number) ?? 0,
            status: (data.status as FinanceProjectStatus) ?? "ongoing",
            currency: (data.currency as string) ?? "PKR",
            createdAt: (data.createdAt as Timestamp | null) ?? null,
            updatedAt: (data.updatedAt as Timestamp | null) ?? null,
          };
        }),
      ),
    (err) => onError?.(err),
  );
}

export async function addFinanceProject(input: {
  name: string;
  worth: number;
  received: number;
  milestoneCount: number;
  status: FinanceProjectStatus;
  currency: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, PROJECTS), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateFinanceProject(
  id: string,
  patch: Partial<Omit<FinanceProject, "id" | "createdAt" | "updatedAt">>,
): Promise<void> {
  await updateDoc(doc(db, PROJECTS, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteFinanceProject(id: string): Promise<void> {
  await deleteDoc(doc(db, PROJECTS, id));
}

// ---------------------------------------------------------------------------
// invoices
// ---------------------------------------------------------------------------

const INVOICES = "invoices";

export function subscribeToInvoices(
  onData: (invoices: Invoice[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, INVOICES), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            number: (data.number as string) ?? "",
            clientName: (data.clientName as string) ?? "",
            clientCompany: (data.clientCompany as string) ?? "",
            clientAddress: (data.clientAddress as string) ?? "",
            currency: (data.currency as string) ?? "PKR",
            items: (data.items as InvoiceItem[]) ?? [],
            notes: (data.notes as string) ?? "",
            paymentMethod: (data.paymentMethod as "ubl" | "wise") ?? "ubl",
            actualReceived: (data.actualReceived as number | null) ?? null,
            actualReceivedNote: (data.actualReceivedNote as string | null) ?? null,
            exchangeRateToPkr: (data.exchangeRateToPkr as number | null) ?? null,
            linkedInvoiceId: (data.linkedInvoiceId as string | null) ?? null,
            linkedInvoiceNumber: (data.linkedInvoiceNumber as string | null) ?? null,
            createdAt: (data.createdAt as Timestamp | null) ?? null,
          };
        }),
      ),
    (err) => onError?.(err),
  );
}

export async function addInvoice(
  input: Omit<Invoice, "id" | "createdAt">,
): Promise<string> {
  const ref = await addDoc(collection(db, INVOICES), {
    ...input,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateInvoice(
  id: string,
  patch: Partial<Omit<Invoice, "id" | "createdAt">>,
): Promise<void> {
  await updateDoc(doc(db, INVOICES, id), patch);
}

export async function deleteInvoice(id: string): Promise<void> {
  await deleteDoc(doc(db, INVOICES, id));
}

/** Generate the next invoice number, e.g. INV-2026-001 */
export function nextInvoiceNumber(existingCount: number): string {
  const year = new Date().getFullYear();
  const num = String(existingCount + 1).padStart(3, '0');
  return `INV-${year}-${num}`;
}

// ---------------------------------------------------------------------------
// allotments (money allotment: where the money goes each month)
// ---------------------------------------------------------------------------

const ALLOTMENTS = "allotments";

export function subscribeToAllotments(
  onData: (allotments: Allotment[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, ALLOTMENTS), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            month: (data.month as string) ?? currentMonth(),
            label: (data.label as string) ?? "",
            amount: (data.amount as number) ?? 0,
            note: (data.note as string) ?? "",
            invoiceId: (data.invoiceId as string | null) ?? null,
            invoiceNumber: (data.invoiceNumber as string | null) ?? null,
            createdAt: (data.createdAt as Timestamp | null) ?? null,
          };
        }),
      ),
    (err) => onError?.(err),
  );
}

export async function addAllotment(input: {
  month: string;
  label: string;
  amount: number;
  note: string;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
}): Promise<string> {
  const ref = await addDoc(collection(db, ALLOTMENTS), {
    ...input,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateAllotment(
  id: string,
  patch: Partial<Omit<Allotment, "id" | "createdAt">>,
): Promise<void> {
  await updateDoc(doc(db, ALLOTMENTS, id), patch);
}

export async function deleteAllotment(id: string): Promise<void> {
  await deleteDoc(doc(db, ALLOTMENTS, id));
}

// ---------------------------------------------------------------------------
// monthlyExpenses (the monthly sheet)
// ---------------------------------------------------------------------------

const EXPENSES = "monthlyExpenses";

export function subscribeToMonthlyExpenses(
  onData: (expenses: MonthlyExpense[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, EXPENSES), orderBy("createdAt", "asc"));
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            month: (data.month as string) ?? currentMonth(),
            type: (data.type as string) ?? "Miscellaneous",
            label: (data.label as string) ?? "",
            amount: (data.amount as number) ?? 0,
            createdAt: (data.createdAt as Timestamp | null) ?? null,
          };
        }),
      ),
    (err) => onError?.(err),
  );
}

export async function addMonthlyExpense(input: {
  month: string;
  type: string;
  label: string;
  amount: number;
}): Promise<string> {
  const ref = await addDoc(collection(db, EXPENSES), {
    ...input,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateMonthlyExpense(
  id: string,
  patch: Partial<Omit<MonthlyExpense, "id" | "createdAt">>,
): Promise<void> {
  await updateDoc(doc(db, EXPENSES, id), patch);
}

export async function deleteMonthlyExpense(id: string): Promise<void> {
  await deleteDoc(doc(db, EXPENSES, id));
}

// ---------------------------------------------------------------------------
// Shared balance math — the single formula every section displays.
// ---------------------------------------------------------------------------

export interface BalanceBreakdown {
  totalReceived: number; //   money in (all finance projects)
  totalAllotted: number; //   money in via allotments (all months)
  totalExpenses: number; //   money out via the monthly sheet (all months)
  available: number; //       received + allotted − expenses
}

export function computeBalance(
  projects: FinanceProject[],
  allotments: Allotment[],
  expenses: MonthlyExpense[],
): BalanceBreakdown {
  const totalReceived = projects.reduce((s, p) => s + p.received, 0);
  const totalAllotted = allotments.reduce((s, a) => s + a.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  return {
    totalReceived,
    totalAllotted,
    totalExpenses,
    available: totalReceived + totalAllotted - totalExpenses,
  };
}
