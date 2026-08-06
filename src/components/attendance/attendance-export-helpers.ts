import {
  type Employee,
  type AttendanceRecord,
  type DailyTask,
  type OfficeSettings,
  DEFAULT_OFFICE_SETTINGS,
} from "@/lib/data/types";
import {
  getWeeklyOvertimeDueMap,
  getDailyPenaltyMap,
  resolveODHAndPenalties,
  computeMonthlySummary,
  formatODH,
} from "@/lib/data/attendance";
import { fmtTime } from "./attendance-utils";

export interface ExportEmployeeRow {
  date: string;
  dayName: string;
  status: string;
  checkIn: string;
  checkOut: string;
  hoursWorked: string;
  flags: string;
}

export interface ExportEmployeeReport {
  emp: Employee;
  summary: {
    totalPresent: number;
    totalLate: number;
    totalAbsent: number;
    totalLeave: number;
    totalHoursWorked: string;
    deductionDays: string;
  };
  totalODHMinutes: number;
  rows: ExportEmployeeRow[];
}

export interface AttendanceExportData {
  overall: {
    totalPresent: number;
    totalLate: number;
    totalAbsent: number;
    totalLeave: number;
    totalHoursWorked: string;
    totalDeductionDays: string;
  };
  monthReports: {
    monthStr: string;
    label: string;
    empRecords: ExportEmployeeReport[];
  }[];
}

export function getPascalCaseFileName(
  months: string[],
  ext: string,
  uid: string,
  empList: Employee[]
): string {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const formattedMonths = months
    .slice()
    .sort()
    .map((m) => {
      const [year, month] = m.split("-");
      const idx = parseInt(month, 10) - 1;
      return `${monthNames[idx] || "Month"}${year}`;
    })
    .join("");

  const targetName =
    uid === "ALL"
      ? "AllEmployees"
      : (empList.find((e) => e.uid === uid || e.id === uid)?.name || "Employee").replace(
          /[^a-zA-Z0-9]/g,
          ""
        );

  return `ZiriumAttendanceReport${targetName}${formattedMonths}.${ext}`;
}

export function generateAttendanceExportData(
  selectedUid: string,
  selectedMonths: string[],
  employees: Employee[],
  allRecords: AttendanceRecord[],
  allTasks: DailyTask[],
  settings: OfficeSettings | undefined,
  availableMonths: { key: string; label: string }[]
): AttendanceExportData {
  const targetEmployees =
    selectedUid === "ALL"
      ? employees.filter((e) => e.uid)
      : employees.filter((e) => e.uid === selectedUid || e.id === selectedUid);

  const sortedMonths = [...selectedMonths].sort();

  let totalPresent = 0;
  let totalLate = 0;
  let totalAbsent = 0;
  let totalLeave = 0;
  let totalHoursWorked = 0;
  let totalDeductionDays = 0;

  const monthReports = sortedMonths.map((monthStr) => {
    const label = availableMonths.find((m) => m.key === monthStr)?.label || monthStr;

    const empRecords = targetEmployees.map((emp) => {
      const empId = emp.id || emp.uid;
      const monthRecords = allRecords.filter(
        (r) =>
          r.date.startsWith(monthStr) &&
          (r.uid === empId || r.uid === emp.uid || r.uid === emp.id)
      );
      const monthTasks = allTasks.filter(
        (t) =>
          t.date.startsWith(monthStr) &&
          (t.assigneeId === empId || t.assigneeId === emp.uid || t.assigneeId === emp.id)
      );

      const isIntern = emp.accessLevel === "intern";
      const summary = computeMonthlySummary(
        monthRecords,
        monthTasks,
        settings || DEFAULT_OFFICE_SETTINGS,
        isIntern,
        emp,
        allRecords,
        monthStr
      );

      totalPresent += summary.totalPresent;
      totalLate += summary.totalLate;
      totalAbsent += summary.totalAbsent;
      totalLeave += summary.totalLeaves;
      totalHoursWorked += summary.totalHoursWorked;
      totalDeductionDays += summary.deductionDays;

      const rawPenaltyMap = getDailyPenaltyMap(
        monthRecords,
        emp,
        settings || DEFAULT_OFFICE_SETTINGS,
        undefined
      );
      const rawOdhMap = getWeeklyOvertimeDueMap(
        monthRecords,
        emp,
        settings || DEFAULT_OFFICE_SETTINGS,
        monthTasks,
        rawPenaltyMap
      );
      const cleared = resolveODHAndPenalties(
        monthRecords,
        monthTasks,
        emp,
        settings || DEFAULT_OFFICE_SETTINGS,
        rawOdhMap,
        rawPenaltyMap
      );

      const odhMapToUse = cleared.originalOdhMap || rawOdhMap;
      const totalODHMinutes = Object.values(odhMapToUse).reduce(
        (sum, val) => sum + (val || 0),
        0
      );

      const rows: ExportEmployeeRow[] = [];
      const [yyyy, mm] = monthStr.split("-").map(Number);
      const daysInMonth = new Date(yyyy, mm, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${monthStr}-${String(day).padStart(2, "0")}`;
        const dateObj = new Date(dateStr + "T12:00:00");
        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
        if (isWeekend) {
          continue; // Exclude weekends from the attendance sheet
        }

        const rec = monthRecords.find((r) => r.date === dateStr);
        const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });

        let statusLabel = rec?.status || "unmarked";
        if (statusLabel === "on_leave") statusLabel = "On Leave";
        if (statusLabel === "sick_leave") statusLabel = "Sick Leave";

        const cin = rec?.checkIn ? fmtTime(rec.checkIn) : "—";
        const cout = rec?.checkOut ? fmtTime(rec.checkOut) : "—";
        const hrs =
          rec?.hoursWorked && rec.hoursWorked > 0
            ? `${rec.hoursWorked.toFixed(2)}h`
            : "—";

        // Build complete audit trail flags exactly matching original attendance sheet
        const flags: string[] = [];
        if (rec?.isLate) {
          flags.push("Late (+flex)");
        }
        const odhVal = odhMapToUse[dateStr];
        if (odhVal && odhVal > 0) {
          flags.push(formatODH(odhVal));
        }

        const dailyTasksForRecord = monthTasks.filter(
          (t) =>
            t.date === dateStr &&
            (t.assigneeId === emp.id ||
              t.assigneeId === emp.uid ||
              t.assigneeId === rec?.uid) &&
            t.status === "done" &&
            (t.isOvertime || t.compensatesWeeklyHours)
        );
        const isIntern = emp?.accessLevel === "intern";
        const compensatoryTasks = dailyTasksForRecord.filter(t => t.compensatesWeeklyHours || t.resolvesODH);
        const paidTasks = dailyTasksForRecord.filter(t => !(t.compensatesWeeklyHours || t.resolvesODH));

        let compensatoryOtMinutes = compensatoryTasks.reduce((acc, t) => acc + (Number(t.assignedHours) || 0) * 60, 0);
        let paidOtMinutes = paidTasks.reduce((acc, t) => acc + (Number(t.assignedHours) || 0) * 60, 0) + (rec?.isOvertime ? (rec.overtimeMinutes || 0) : 0);

        if (isIntern) {
          compensatoryOtMinutes += paidOtMinutes;
          paidOtMinutes = 0;
        }

        if (compensatoryOtMinutes > 0) {
          const otLabel =
            compensatoryOtMinutes < 60
              ? `+${compensatoryOtMinutes}m OT`
              : `+${Math.floor(compensatoryOtMinutes / 60)}h ${compensatoryOtMinutes % 60}m OT`;
          flags.push(otLabel);
        }

        if (paidOtMinutes > 0) {
          const potLabel =
            paidOtMinutes < 60
              ? `+${paidOtMinutes}m POT`
              : `+${Math.floor(paidOtMinutes / 60)}h ${paidOtMinutes % 60}m POT`;
          flags.push(potLabel);
        }

        const penaltyChips = cleared.penaltyMap[dateStr];
        if (penaltyChips && penaltyChips.length > 0) {
          const seen = new Set<string>();
          penaltyChips.forEach((p) => {
            const key = `${p.type}-${p.label}`;
            if (!seen.has(key)) {
              seen.add(key);
              flags.push(p.label);
            }
          });
        }

        const flagsStr = flags.length > 0 ? flags.join(" | ") : "None";

        rows.push({
          date: dateStr,
          dayName,
          status: statusLabel.toUpperCase(),
          checkIn: cin,
          checkOut: cout,
          hoursWorked: hrs,
          flags: flagsStr,
        });
      }

      return {
        emp,
        summary: {
          totalPresent: summary.totalPresent,
          totalLate: summary.totalLate,
          totalAbsent: summary.totalAbsent,
          totalLeave: summary.totalLeaves,
          totalHoursWorked: summary.totalHoursWorked.toFixed(1),
          deductionDays: summary.deductionDays.toFixed(2),
        },
        totalODHMinutes,
        rows,
      };
    });

    return {
      monthStr,
      label,
      empRecords,
    };
  });

  return {
    monthReports,
    overall: {
      totalPresent,
      totalLate,
      totalAbsent,
      totalLeave,
      totalHoursWorked: totalHoursWorked.toFixed(1),
      totalDeductionDays: totalDeductionDays.toFixed(2),
    },
  };
}

export function downloadAttendanceExcel(
  exportData: AttendanceExportData,
  selectedName: string,
  selectedMonths: string[],
  fileName: string
) {
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <style>
        table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
        th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; font-size: 13px; }
        th { background-color: #1e293b; color: #ffffff; font-weight: bold; }
        .title { font-size: 18px; font-weight: bold; color: #1e293b; background-color: #f1f5f9; }
        .summary-header { background-color: #e2e8f0; font-weight: bold; }
        .emp-header { background-color: #3b82f6; color: #ffffff; font-weight: bold; font-size: 14px; }
        .emp-sub { background-color: #eff6ff; font-weight: bold; }
      </style>
    </head>
    <body>
      <table>
        <tr><td colspan="7" class="title">ZIRIUM ATTENDANCE & WORKSPACE EXPORT REPORT</td></tr>
        <tr><td><b>Generated On:</b></td><td colspan="6">${new Date().toLocaleString()}</td></tr>
        <tr><td><b>Selected Employee(s):</b></td><td colspan="6">${selectedName}</td></tr>
        <tr><td><b>Months Selected:</b></td><td colspan="6">${selectedMonths.sort().join(", ")}</td></tr>
        <tr><td colspan="7"></td></tr>
        <tr class="summary-header">
          <td>Total Days Present</td><td>Total Late Days</td><td>Total Absent Days</td>
          <td>Total Leave Days</td><td>Total Hours Worked</td><td colspan="2">Total Salary Deduction Days</td>
        </tr>
        <tr>
          <td>${exportData.overall.totalPresent} days</td><td>${exportData.overall.totalLate} days</td><td>${exportData.overall.totalAbsent} days</td>
          <td>${exportData.overall.totalLeave} days</td><td>${exportData.overall.totalHoursWorked} hrs</td><td colspan="2"><b>${exportData.overall.totalDeductionDays} days</b></td>
        </tr>
        <tr><td colspan="7"></td></tr>
      </table>
  `;

  for (const report of exportData.monthReports) {
    html += `
      <table>
        <tr><td colspan="7" class="title" style="background-color: #334155; color: white;">MONTHLY ATTENDANCE: ${report.label.toUpperCase()}</td></tr>
        <tr><td colspan="7"></td></tr>
    `;

    for (const empData of report.empRecords) {
      const odhHrs = Math.floor(Math.abs(empData.totalODHMinutes || 0) / 60);
      const odhMins = Math.abs(empData.totalODHMinutes || 0) % 60;
      const odhStr = `${odhHrs}h ${odhMins}m`;

      html += `
        <tr class="emp-header"><td colspan="7">EMPLOYEE: ${empData.emp.name} (${empData.emp.accessLevel === "intern" ? "Intern" : "Employee"} - ${empData.emp.department || "General"})</td></tr>
        <tr class="emp-sub"><td colspan="7">Month Summary: Present: ${empData.summary.totalPresent} | Late: ${empData.summary.totalLate} | Absent: ${empData.summary.totalAbsent} | ODH Shortfall: ${odhStr} | Salary Deduction: ${empData.summary.deductionDays}d</td></tr>
        <tr>
          <th>Date</th><th>Day</th><th>Status</th><th>Check In</th><th>Check Out</th><th>Hours Worked</th><th>Flags & Audit Trail</th>
        </tr>
      `;

      for (const r of empData.rows) {
        html += `
          <tr>
            <td>${r.date}</td>
            <td>${r.dayName}</td>
            <td>${r.status}</td>
            <td>${r.checkIn}</td>
            <td>${r.checkOut}</td>
            <td>${r.hoursWorked}</td>
            <td>${r.flags}</td>
          </tr>
        `;
      }
      html += `<tr><td colspan="7"></td></tr>`;
    }
    html += `</table><br/>`;
  }

  html += `</body></html>`;

  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
