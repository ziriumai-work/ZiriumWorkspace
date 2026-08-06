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

    const taskDateRec = recordByDate[taskDate];
    const isTaskDateAbsent = taskDateRec?.status === "absent";
    const isTaskDateLeave =
      taskDateRec?.status === "on_leave" ||
      taskDateRec?.status === "sick_leave" ||
      (penaltyMap[taskDate] && penaltyMap[taskDate].some((c) => c.type === "leave"));
    const canClearOtherAbsences = t.compensatesWeeklyHours && (isTaskDateAbsent || isTaskDateLeave);

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
      // EXACTLY on that absent/leave date (d === taskDate), AND then it can propagate.
      if (d !== taskDate) {
        if (!canClearOtherAbsences && (isAbsent || isLeave)) {
          continue;
        }
        if (isWeekend) {
          continue;
        }
      }
      // No need to inject ghost ODH here. Interns already have an intern_absent_odh penalty chip.
      
      let penaltyNeeded = 0;
      let penaltyTypeToClear = "";
      let hasUnclearedPenalty = false;

      if (treatAsUnpaidIntern && t.compensatesWeeklyHours) {
        const chips = penaltyMap[d] || [];
        for (const chip of chips) {
          if (chip.isClearingChip) continue;
          const alreadyCleared = chips.some(
            (c) => c.isClearingChip && c.clearedPenaltyType === chip.type
          );
          if (alreadyCleared) continue;
          if (
            chip.type === "intern_late_odh" ||
            chip.type === "intern_leave_odh" ||
            chip.type === "intern_absent_odh" ||
            chip.type === "odh"
          ) {
            penaltyNeeded = chip.minutes || (chip.type === "intern_late_odh" ? dailyMinutes / 2 : dailyMinutes);
            penaltyTypeToClear = chip.type;
            hasUnclearedPenalty = true;
            break;
          }
        }
      }

      if (treatAsUnpaidIntern && hasUnclearedPenalty) {
        const totalOTAbsorbed = (penaltyMap[d] || []).filter(c => c.type === "clearing_odh_absorbed").reduce((sum, c) => sum + (c.minutes || 0), 0);
        const originalOdhNeeded = initialOdhMap[d] || 0;
        const otTowardsPenalties = Math.max(0, totalOTAbsorbed - originalOdhNeeded);
        penaltyNeeded = Math.max(0, penaltyNeeded - otTowardsPenalties);
      }

      // The total debt for this day is the current ODH shortfall (tracked live in odhMap) PLUS any uncleared penalty.
      // For employees, we only absorb ODH shortfall here.
      const currentOdhNeeded = odhMap[d] || 0;
      const totalDebt = treatAsUnpaidIntern ? (currentOdhNeeded + penaltyNeeded) : currentOdhNeeded;
      let remainingDebt = totalDebt;

      let didAbsorbODH = false;
      let absorbedOnDay = 0;
      
      if (remainingDebt > 0 && taskMins > 0) {
        lastMatchedDay = d;
        absorbedOnDay = Math.min(taskMins, remainingDebt);
        
        // Update odhMap[d] (which tracks the remaining ODH shortfall for the UI)
        odhMap[d] = Math.max(0, currentOdhNeeded - absorbedOnDay);
        
        taskMins -= absorbedOnDay;
        totalResolvedODHMinutes += absorbedOnDay;
        didAbsorbODH = true;
        
        // Check if ODH shortfall was just fully paid off in this step
        if (
          treatAsUnpaidIntern && 
          currentOdhNeeded > 0 && 
          odhMap[d] === 0
        ) {
          const hrs = Math.floor(currentOdhNeeded / 60);
          const mins = currentOdhNeeded % 60;
          const timeStr = mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;

          if (!penaltyMap[d]) penaltyMap[d] = [];
          penaltyMap[d].push({
            type: "clearing_intern_odh",
            label: `${timeStr} ODH Resolved`,
            tooltip: `ODH shortfall (${timeStr}) resolved by task (${t.title})`,
            color: "#22c55e",
            bgcolor: "#22c55e20",
            isClearingChip: true,
            clearedPenaltyType: "odh",
          });
        }

        // Check if Penalty was just fully paid off in this step
        if (
          treatAsUnpaidIntern && 
          hasUnclearedPenalty && 
          absorbedOnDay >= penaltyNeeded // We only need to check if we absorbed enough to cover the remaining penaltyNeeded!
        ) {
          const p_hrs = Math.floor(penaltyNeeded / 60);
          const p_mins = penaltyNeeded % 60;
          const p_timeStr = p_mins > 0 ? `${p_hrs}h ${p_mins}m` : `${p_hrs}h`;

          if (!penaltyMap[d]) penaltyMap[d] = [];
          penaltyMap[d].push({
            type: "clearing_intern_odh",
            label: `${p_timeStr} Penalty Resolved`,
            tooltip: `Penalty (${p_timeStr}) resolved by task (${t.title})`,
            color: "#22c55e",
            bgcolor: "#22c55e20",
            isClearingChip: true,
            clearedPenaltyType: penaltyTypeToClear,
          });
        }
      }

      if (
        !treatAsUnpaidIntern &&
        (odhMap[d] || 0) === 0 &&
        t.compensatesWeeklyHours
      ) {
        const chips = penaltyMap[d] || [];
        const newChips: DatePenaltyChip[] = [...chips];
        let clearedAnyOnDay = false;

        let totalPenaltyCosts = 0;
        for (const c of chips) {
          if (c.isClearingChip) continue;
          const isCleared = chips.some(clearingChip => clearingChip.isClearingChip && clearingChip.clearedPenaltyType === c.type);
          if (isCleared) continue;
          let cost = c.minutes || 0;
          if (!cost) {
            cost = (c.type === "late" || c.type === "half_day" || c.type === "employee_late_deduction") ? dailyMinutes / 2 : dailyMinutes;
          }
          totalPenaltyCosts += cost;
        }
        const totalOTAbsorbed = chips.filter(c => c.type === "clearing_odh_absorbed").reduce((sum, c) => sum + (c.minutes || 0), 0);
        let remainingDebtForPenalties = Math.max(0, totalPenaltyCosts - totalOTAbsorbed);

        for (const chip of chips) {
          if (chip.isClearingChip) continue;
          const alreadyCleared = chips.some(
            (c) => c.isClearingChip && c.clearedPenaltyType === chip.type
          );
          if (alreadyCleared) continue;

          let chipCost = chip.minutes || 0;
          if (!chipCost) {
            if (
              chip.type === "late" ||
              chip.type === "half_day" ||
              chip.type === "employee_late_deduction"
            ) {
              chipCost = dailyMinutes / 2;
            } else {
              chipCost = dailyMinutes;
            }
          }

          const actualCost = Math.min(chipCost, remainingDebtForPenalties);
          if (actualCost <= 0) continue;

          if (!didAbsorbODH && taskMins < actualCost) {
            absorbedOnDay += taskMins;
            taskMins = 0;
            break;
          }

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
            if (!didAbsorbODH) {
              taskMins = Math.max(0, taskMins - actualCost);
              absorbedOnDay += actualCost;
              remainingDebtForPenalties = Math.max(0, remainingDebtForPenalties - actualCost);
            }
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
            if (!didAbsorbODH) {
              taskMins = Math.max(0, taskMins - actualCost);
              absorbedOnDay += actualCost;
              remainingDebtForPenalties = Math.max(0, remainingDebtForPenalties - actualCost);
            }
            break;
          }
        }

        if (clearedAnyOnDay) {
          penaltyMap[d] = newChips;
        }
      }

      if (absorbedOnDay > 0 && d !== taskDate) {
        if (!penaltyMap[d]) penaltyMap[d] = [];

        const hrs = Math.floor(absorbedOnDay / 60);
        const mins = absorbedOnDay % 60;
        const timeStr = mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
        
        const dObj = new Date(t.date + "T12:00:00");
        const dateStr = dObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        
        const chipLabel = `+${timeStr} OT (from ${dateStr})`;
        const chipTooltip = `Overtime Due (${timeStr}) absorbed by task on ${dateStr} (${t.title})`;

        penaltyMap[d].push({
          type: "clearing_odh_absorbed",
          label: chipLabel,
          tooltip: chipTooltip,
          color: "#22c55e",
          bgcolor: "#22c55e20",
          minutes: absorbedOnDay,
          isClearingChip: true,
          clearedPenaltyType: "odh",
        });
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
