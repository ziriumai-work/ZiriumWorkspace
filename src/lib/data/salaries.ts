import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  type SalaryRecord,
  type SalaryLineItem,
  type OfficeSettings,
  type Developer,
  type AttendanceRecord,
  type DailyTask,
  DEFAULT_OFFICE_SETTINGS,
} from "./types";
import { dailySalary } from "@/lib/utils/salaryMath";
import { computeMonthlySummary } from "./attendance";

export const SALARIES_COL = "salaries";

export async function generateSalariesForMonth(month: string): Promise<void> {
  const [yearStr, monthStr] = month.split("-");
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);

  // 1. Get office settings
  let settings = DEFAULT_OFFICE_SETTINGS;
  const setSnap = await getDoc(doc(db, "settings", "office"));
  if (setSnap.exists()) settings = setSnap.data() as OfficeSettings;

  // 2. Get all employees with a monthly salary and uid, filtered by start/end dates
  const empSnap = await getDocs(collection(db, "developers"));
  const employees: Developer[] = [];
  empSnap.forEach((d) => {
    const data = d.data() as Developer;
    data.id = d.id; // Important: inject the document ID!
    
    if (data.monthlySalary && data.uid) {
      // Check start date (YYYY-MM-DD)
      if (data.startDate) {
        const startMonth = data.startDate.substring(0, 7);
        if (startMonth > month) return; // Skip if started after this month
      }
      
      // Check end date (YYYY-MM-DD)
      if (data.endDate) {
        const endMonth = data.endDate.substring(0, 7);
        if (endMonth < month) return; // Skip if ended before this month
      }

      employees.push(data);
    }
  });

  // 3. Get all attendance for the month
  // Since we don't have a direct month index, we can fetch all attendance for these users 
  // or just fetch all attendance and filter. Filtering all is fine for small/medium teams.
  const attSnap = await getDocs(collection(db, "attendance"));
  const allAttendance: AttendanceRecord[] = [];
  attSnap.forEach(d => allAttendance.push(d.data() as AttendanceRecord));

  // 4. Get all tasks for the month (for overtime)
  const taskSnap = await getDocs(collection(db, "tasks"));
  const allTasks: DailyTask[] = [];
  taskSnap.forEach(d => allTasks.push(d.data() as DailyTask));

  // 5. Generate salary record for each employee
  for (const emp of employees) {
    const base = emp.monthlySalary!;
    const dailyRate = dailySalary(base, y, m);

    // Filter attendance
    const myAtt = allAttendance.filter(a => (a.uid === emp.uid || a.uid === emp.id) && a.date.startsWith(month));
    // Filter tasks
    const myTasks = allTasks.filter(t => t.assigneeId === emp.id && t.date.startsWith(month) && t.isOvertime && t.overtimeCost);

    const lineItems: SalaryLineItem[] = [];
    let deductionsTotal = 0;
    let overtimeTotal = 0;

    const isIntern = emp.accessLevel === "intern";
    const summary = computeMonthlySummary(myAtt, allTasks.filter(t => t.assigneeId === emp.id && t.date.startsWith(month)), settings, isIntern, emp, allAttendance, month);

    if (summary.deductionDays > 0) {
      const penalty = Math.round(summary.deductionDays * dailyRate);
      deductionsTotal += penalty;
      lineItems.push({
        description: `Attendance Deductions (${summary.deductionDays} days)`,
        amount: -penalty,
        dateStr: month,
      });
    }

    // Process explicitly paid Overtime Tasks
    for (const task of myTasks) {
      const cost = Math.round(task.overtimeCost || 0);
      if (cost > 0) {
        overtimeTotal += cost;
        lineItems.push({
          description: `Overtime (${task.title})`,
          amount: cost,
          dateStr: task.date,
        });
      }
    }

    const netSalary = Math.round(base + overtimeTotal - deductionsTotal);

    const recordId = `${emp.id}_${month}`;
    const docRef = doc(db, SALARIES_COL, recordId);
    const existing = await getDoc(docRef);

    if (existing.exists()) {
      const current = existing.data() as SalaryRecord;
      // Do not overwrite if already paid/fulfilled
      if (current.status !== "due") continue; 
    }

    const salaryRecord: SalaryRecord = {
      id: recordId,
      month,
      employeeId: emp.id,
      employeeName: emp.name,
      baseSalary: base,
      overtimeTotal,
      deductionsTotal,
      netSalary,
      lineItems,
      status: "due",
      createdAt: serverTimestamp(),
      paidAt: null,
      fulfilledAt: null,
    };

    await setDoc(docRef, salaryRecord, { merge: true });
  }
}

export function subscribeToSalariesByMonth(
  month: string,
  onData: (records: SalaryRecord[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(collection(db, SALARIES_COL), where("month", "==", month));
  return onSnapshot(q, (snap) => {
    const list: SalaryRecord[] = [];
    snap.forEach((d) => list.push(d.data() as SalaryRecord));
    // Sort alphabetically by name
    list.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
    onData(list);
  }, (err) => {
    console.error("subscribeToSalariesByMonth error:", err);
    if (onError) onError(err);
  });
}

export function subscribeToMySalaries(
  employeeId: string,
  onData: (records: SalaryRecord[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(collection(db, SALARIES_COL), where("employeeId", "==", employeeId));
  return onSnapshot(q, (snap) => {
    const list: SalaryRecord[] = [];
    snap.forEach((d) => list.push(d.data() as SalaryRecord));
    // Sort descending by month
    list.sort((a, b) => b.month.localeCompare(a.month));
    onData(list);
  }, (err) => {
    console.error("subscribeToMySalaries error:", err);
    if (onError) onError(err);
  });
}

export async function markSalaryPaid(salaryId: string, receiptUrl: string): Promise<void> {
  await updateDoc(doc(db, SALARIES_COL, salaryId), {
    status: "paid",
    receiptUrl,
    paidAt: serverTimestamp(),
  });
}

export async function markSalaryFulfilled(salaryId: string): Promise<void> {
  const docRef = doc(db, SALARIES_COL, salaryId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return;
  const salary = snap.data() as SalaryRecord;

  // Mark fulfilled
  await updateDoc(docRef, {
    status: "fulfilled",
    fulfilledAt: serverTimestamp(),
  });

  // Automatically create a monthly expense record
  const expensesCol = collection(db, "monthlyExpenses");
  await setDoc(doc(expensesCol), {
    month: salary.month,
    type: "Salaries",
    label: `Salary - ${salary.employeeName}`,
    amount: salary.netSalary,
    createdAt: serverTimestamp(),
  });
}
