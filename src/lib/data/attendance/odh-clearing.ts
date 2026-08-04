import type { AttendanceRecord, DailyTask, OfficeSettings } from "@/lib/data/types";
import type { DatePenaltyChip } from "./calculations";

export interface ODHClearingResult {
  odhMap: Record<string, number>; // resolved ODH balances in minutes by date
  originalOdhMap?: Record<string, number>; // original ODH balances before task absorption for UI traceability
  penaltyMap: Record<string, DatePenaltyChip[]>; // original penalty chips + green clearing chips by date
  clearedDeductionDays: number; // total salary deduction days cleared by Compensatory+ODH tasks
  totalResolvedODHMinutes: number; // total ODH minutes paid down
}

function getMondayOfWeek(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return mon.toISOString().slice(0, 10);
}

export function resolveODHAndPenalties(
  records: AttendanceRecord[],
  tasks: DailyTask[],
  employee: any,
  settings: OfficeSettings,
  initialOdhMap: Record<string, number>,
  initialPenaltyMap: Record<string, DatePenaltyChip[]>,
  targetMonthStr?: string,
): ODHClearingResult {
  const odhMap: Record<string, number> = { ...initialOdhMap };
  const originalOdhMap: Record<string, number> = { ...initialOdhMap };
  const penaltyMap: Record<string, DatePenaltyChip[]> = {};
  for (const [k, v] of Object.entries(initialPenaltyMap)) {
    penaltyMap[k] = [...v];
  }

  const isIntern = employee?.accessLevel === "intern";
  const isPaid = Number(employee?.monthlySalary) > 0;
  const treatAsUnpaidIntern = isIntern && !isPaid;
  const dailyHours = (Number(employee?.officeHours) || (isIntern ? 30 : 40)) / 5;
  const dailyMinutes = Math.round(dailyHours * 60);

  let clearedDeductionDays = 0;
  let totalResolvedODHMinutes = 0;

  const empId = employee?.id || employee?.uid;
  const filteredRecords = empId
    ? records.filter((r) => r.uid === empId || r.uid === employee?.uid || r.uid === employee?.id)
    : records;

  // Group records by date for fast status check
  const recordByDate: Record<string, AttendanceRecord> = {};
  for (const r of filteredRecords) {
    recordByDate[r.date] = r;
  }

  // Filter relevant tasks: completed, overtime, and either ODH or compensatory for this employee
  const relevantTasks = (tasks || []).filter((t) => {
    if (t.status !== "done") return false;
    if (!t.isOvertime) return false;
    if (!t.resolvesODH && !t.compensatesWeeklyHours) return false;
    if (targetMonthStr && !t.date.startsWith(targetMonthStr)) return false;
    if (empId && t.assigneeId !== empId && t.assigneeId !== employee?.uid) return false;
    return true;
  });

  // Sort tasks chronologically by date
  relevantTasks.sort((a, b) => a.date.localeCompare(b.date));

  for (const t of relevantTasks) {
    let taskMins = Math.round((Number(t.assignedHours) || 0) * 60);
    if (taskMins <= 0) continue;

    const taskDate = t.date;
    const taskMonth = taskDate.slice(0, 7);
    const mondayOfTaskWeek = getMondayOfWeek(taskDate);

    // Collect all candidate dates in the same month up to taskDate
    const allDatesInMonth: string[] = [];
    const dateSet = new Set<string>([
      ...Object.keys(odhMap),
      ...Object.keys(penaltyMap),
      ...Object.keys(recordByDate),
    ]);
    for (const d of dateSet) {
      if (d.startsWith(taskMonth) && d <= taskDate) {
        allDatesInMonth.push(d);
      }
    }
    allDatesInMonth.sort((a, b) => b.localeCompare(a)); // latest to earliest

    // Build ordered search queue (§3):
    // 1. Same day first
    // 2. Backward search same week (Monday to taskDate-1)
    // 3. Backward search earlier weeks in same month
    const sameDayQueue = allDatesInMonth.filter((d) => d === taskDate);
    const sameWeekQueue = allDatesInMonth.filter((d) => d < taskDate && d >= mondayOfTaskWeek);
    const earlierMonthQueue = allDatesInMonth.filter((d) => d < mondayOfTaskWeek);
    const orderedQueue = [...sameDayQueue, ...sameWeekQueue, ...earlierMonthQueue];

    let lastMatchedDay: string | null = null;

    for (const d of orderedQueue) {
      if (taskMins <= 0) break;

      const rec = recordByDate[d];
      const isAbsent = rec?.status === "absent";

      const isLeave =
        rec?.status === "on_leave" ||
        rec?.status === "sick_leave" ||
        penaltyMap[d]?.some((c) => c.type === "leave");
      const dayOfWeek = new Date(d + "T12:00:00").getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // §4: When searching automatically across other days (d !== taskDate), we MUST ALWAYS skip
      // absent days, leave days, and weekends! They can only be cleared if the task is assigned
      // EXACTLY on that absent/leave date (d === taskDate).
      if (d !== taskDate) {
        if (isAbsent || isLeave || isWeekend) {
          continue;
        }
      }

      let dayNeeded = odhMap[d] || 0;
      // For an absent or leave day targeted with Compensatory Task = true, standard daily hours is the ODH target if 0
      if ((isAbsent || isLeave) && dayNeeded === 0 && t.compensatesWeeklyHours) {
        dayNeeded = dailyMinutes;
      }

      let didAbsorbODH = false;
      let absorbedOnDay = 0;
      if (dayNeeded > 0) {
        lastMatchedDay = d;
        absorbedOnDay = Math.min(taskMins, dayNeeded);
        odhMap[d] = Math.max(0, dayNeeded - absorbedOnDay);
        taskMins -= absorbedOnDay;
        totalResolvedODHMinutes += absorbedOnDay;
        didAbsorbODH = true;
      }

      const canClearPenalty =
        (odhMap[d] || 0) === 0 && t.compensatesWeeklyHours;

      let clearedAnyOnDay = false;
      if (canClearPenalty) {
        const chips = penaltyMap[d] || [];
        const newChips: DatePenaltyChip[] = [...chips];

        for (const chip of chips) {
          if (chip.isClearingChip) continue;
          const alreadyCleared = chips.some(
            (c) => c.isClearingChip && c.clearedPenaltyType === chip.type
          );
          if (alreadyCleared) continue;

          let chipCost = chip.minutes || 0;
          if (!chipCost) {
            if (
              chip.type === "intern_late_odh" ||
              chip.type === "late" ||
              chip.type === "half_day" ||
              chip.type === "employee_late_deduction"
            ) {
              chipCost = dailyMinutes / 2;
            } else {
              chipCost = dailyMinutes;
            }
          }

          if (!didAbsorbODH && taskMins < chipCost) continue;

          if (treatAsUnpaidIntern) {
            if (
              chip.type === "intern_late_odh" ||
              chip.type === "intern_leave_odh" ||
              chip.type === "intern_absent_odh" ||
              chip.type === "odh"
            ) {
              newChips.push({
                type: "clearing_intern_odh",
                label: "ODH Resolved (Task Cleared)",
                tooltip: `ODH penalty resolved by Compensatory + ODH Task (${t.title})`,
                color: "#22c55e",
                bgcolor: "#22c55e20",
                isClearingChip: true,
                clearedPenaltyType: chip.type,
              });
              clearedAnyOnDay = true;
              if (!didAbsorbODH) taskMins = Math.max(0, taskMins - chipCost);
              break;
            }
          } else {
            if (
              chip.type === "late" ||
              chip.type === "half_day" ||
              chip.type === "employee_late_deduction"
            ) {
              newChips.push({
                type: "clearing_late",
                label: "+0.5d Salary (Task Cleared)",
                tooltip: `Late-day penalty cleared by Compensatory Task (${t.title})`,
                color: "#22c55e",
                bgcolor: "#22c55e20",
                isClearingChip: true,
                clearedPenaltyType: chip.type,
              });
              clearedDeductionDays += 0.5;
              clearedAnyOnDay = true;
              if (!didAbsorbODH) taskMins = Math.max(0, taskMins - chipCost);
              break;
            } else if (
              chip.type === "absent" ||
              chip.type === "employee_absent_deduction" ||
              chip.type === "employee_leave_deduction" ||
              chip.type === "leave" ||
              chip.type === "full_day"
            ) {
              newChips.push({
                type: "clearing_absent",
                label: "+1.0d Salary (Task Cleared)",
                tooltip: `Salary deduction cleared by Compensatory Task (${t.title})`,
                color: "#22c55e",
                bgcolor: "#22c55e20",
                isClearingChip: true,
                clearedPenaltyType: chip.type,
              });
              clearedDeductionDays += 1.0;
              clearedAnyOnDay = true;
              if (!didAbsorbODH) taskMins = Math.max(0, taskMins - chipCost);
              break;
            }
          }
        }

        if (clearedAnyOnDay) {
          penaltyMap[d] = newChips;
        }
      }

      if (absorbedOnDay > 0 && d !== taskDate && !clearedAnyOnDay) {
        const hrs = Math.floor(absorbedOnDay / 60);
        const mins = absorbedOnDay % 60;
        const timeStr = mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h 0m`;
        const chipLabel = `+${timeStr} OT (${t.date} Task)`;
        const chipTooltip = `Overtime Due (${timeStr}) absorbed by task on ${t.date} (${t.title})`;

        if (!penaltyMap[d]) penaltyMap[d] = [];
        const alreadyHasChip = penaltyMap[d].some(
          (c) => c.type === "clearing_odh_absorbed" && c.label === chipLabel
        );
        if (!alreadyHasChip) {
          penaltyMap[d].push({
            type: "clearing_odh_absorbed",
            label: chipLabel,
            tooltip: chipTooltip,
            color: "#22c55e",
            bgcolor: "#22c55e20",
            isClearingChip: true,
            clearedPenaltyType: "odh",
          });
        }
      }
    }
  }

  return {
    odhMap,
    penaltyMap,
    clearedDeductionDays,
    totalResolvedODHMinutes,
  };
}
