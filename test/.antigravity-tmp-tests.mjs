// test/test-runner.ts
import assert from "node:assert/strict";
var suites = [];
var currentSuite = null;
function describe(name, fn) {
  currentSuite = { name, tests: [] };
  suites.push(currentSuite);
  fn();
  currentSuite = null;
}
function it(name, fn) {
  if (!currentSuite) {
    throw new Error("it() must be called inside describe()");
  }
  currentSuite.tests.push({ name, fn });
}
function expect(actual) {
  return {
    toBe(expected) {
      assert.strictEqual(actual, expected);
    },
    toEqual(expected) {
      assert.deepStrictEqual(actual, expected);
    },
    toBeTruthy() {
      assert.ok(actual);
    },
    toBeFalsy() {
      assert.ok(!actual);
    },
    toBeGreaterThan(expected) {
      assert.ok(typeof actual === "number" && actual > expected, `Expected ${actual} > ${expected}`);
    },
    toBeLessThanOrEqual(expected) {
      assert.ok(typeof actual === "number" && actual <= expected, `Expected ${actual} <= ${expected}`);
    }
  };
}
async function runAllSuites() {
  let totalSuites = 0;
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  console.log("\n=======================================================");
  console.log("   \u{1F9EA} RUNNING ZIRIUM ATTENDANCE & WORKSPACE TEST SUITE");
  console.log("=======================================================\n");
  const startTime = Date.now();
  for (const suite of suites) {
    totalSuites++;
    console.log(`\u{1F4E6} Suite: ${suite.name}`);
    for (const test of suite.tests) {
      totalTests++;
      try {
        await test.fn();
        passedTests++;
        console.log(`   \u2705 PASS: ${test.name}`);
      } catch (err) {
        failedTests++;
        const errMsg = err instanceof Error ? err.message : String(err);
        console.log(`   \u274C FAIL: ${test.name}`);
        console.log(`      -> ${errMsg}`);
      }
    }
    console.log("");
  }
  const elapsedMs = Date.now() - startTime;
  console.log("=======================================================");
  console.log(`   \u{1F4CA} TEST SUMMARY:`);
  console.log(`      Suites: ${totalSuites}`);
  console.log(`      Tests:  ${totalTests} total | \u2705 ${passedTests} passed | \u274C ${failedTests} failed`);
  console.log(`      Time:   ${elapsedMs}ms`);
  console.log("=======================================================\n");
  return failedTests === 0;
}

// src/lib/data/attendance/settings.ts
import { doc as doc2, onSnapshot as onSnapshot2, setDoc } from "firebase/firestore";

// src/lib/firebase/client.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";
import {
  connectStorageEmulator,
  getStorage
} from "firebase/storage";
import {
  connectFunctionsEmulator,
  getFunctions
} from "firebase/functions";
var useEmulator = process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "true";
var firebaseConfig = {
  // With the emulator, real credentials aren't needed — fall back to harmless
  // placeholders so getAuth() doesn't reject an empty key.
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || (useEmulator ? "demo-api-key" : void 0),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || (useEmulator ? "demo-workspace" : void 0),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};
var firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
var isBrowser = typeof window !== "undefined";
var canInit = isBrowser || Boolean(firebaseConfig.apiKey);
function initFirestore(app) {
  if (!isBrowser) return getFirestore(app);
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch {
    return getFirestore(app);
  }
}
var auth = canInit ? getAuth(firebaseApp) : void 0;
var db = canInit ? initFirestore(firebaseApp) : void 0;
var storage = canInit ? getStorage(firebaseApp) : void 0;
var functions = canInit ? getFunctions(firebaseApp) : void 0;
if (isBrowser && useEmulator && // @ts-expect-error — custom flag we set after the first connection
!globalThis.__FIREBASE_EMULATORS_CONNECTED__) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  globalThis.__FIREBASE_EMULATORS_CONNECTED__ = true;
}
var googleProvider = new GoogleAuthProvider();

// src/lib/data/types.ts
var DEFAULT_OFFICE_SETTINGS = {
  startHour: 10,
  startMinute: 0,
  endHour: 18,
  endMinute: 0,
  graceMinutes: 60,
  lateThresholdDays: 3,
  employeeLeavesPerMonth: 2,
  internLeavesPerMonth: 1,
  appUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://zirium.vercel.app"
};

// src/lib/data/logs.ts
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  getDoc,
  doc,
  limit
} from "firebase/firestore";

// src/lib/data/attendance/settings.ts
function normalizeOfficeHours(settings3) {
  let startH = Number(settings3.startHour) || 10;
  const startM = Number(settings3.startMinute) || 0;
  let endH = Number(settings3.endHour) || 18;
  const endM = Number(settings3.endMinute) || 0;
  if (startH >= 1 && startH <= 6 && endH > startH && endH <= 11) {
    startH += 12;
    endH += 12;
  } else if (startH >= 7 && startH <= 12 && endH >= 1 && endH <= 9) {
    endH += 12;
  }
  return { startH, startM, endH, endM };
}
function isWithinOfficeHours(settings3, currentTime) {
  const now = currentTime ? new Date(currentTime) : /* @__PURE__ */ new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) {
    return false;
  }
  const { startH, startM, endH, endM } = normalizeOfficeHours(settings3);
  const start = new Date(now);
  start.setHours(startH, startM, 0, 0);
  const end = new Date(now);
  end.setHours(endH, endM, 59, 999);
  if (start > end) {
    return now >= start || now <= end;
  }
  return now >= start && now <= end;
}

// test/attendance-settings.test.ts
var defaultSettings = {
  startHour: 10,
  startMinute: 0,
  endHour: 18,
  endMinute: 0,
  graceMinutes: 30,
  lateThresholdDays: 3,
  employeeLeavesPerMonth: 2,
  internLeavesPerMonth: 1
};
function getWeekdayDate() {
  return new Date(2026, 7, 3);
}
describe("Office Settings: isWithinOfficeHours (Daytime Shift 10 AM to 6 PM)", () => {
  it("should return TRUE for check-in at 10:00 AM (exact start time)", () => {
    const d = getWeekdayDate();
    d.setHours(10, 0, 0, 0);
    expect(isWithinOfficeHours(defaultSettings, d)).toBeTruthy();
  });
  it("should return TRUE for check-in at 1:00 PM (13:00 - mid day intern check-in)", () => {
    const d = getWeekdayDate();
    d.setHours(13, 0, 0, 0);
    expect(isWithinOfficeHours(defaultSettings, d)).toBeTruthy();
  });
  it("should return TRUE for check-in at 6:00 PM (18:00 - exact end time)", () => {
    const d = getWeekdayDate();
    d.setHours(18, 0, 0, 0);
    expect(isWithinOfficeHours(defaultSettings, d)).toBeTruthy();
  });
  it("should return FALSE for check-in at 9:59 AM (before office start)", () => {
    const d = getWeekdayDate();
    d.setHours(9, 59, 0, 0);
    expect(isWithinOfficeHours(defaultSettings, d)).toBeFalsy();
  });
  it("should return FALSE for check-in at 6:01 PM (18:01 - after office end)", () => {
    const d = getWeekdayDate();
    d.setHours(18, 1, 0, 0);
    expect(isWithinOfficeHours(defaultSettings, d)).toBeFalsy();
  });
  it("should return FALSE on Saturday or Sunday (weekend - office closed)", () => {
    const sat = new Date(2026, 7, 8, 12, 0, 0);
    const sun = new Date(2026, 7, 9, 12, 0, 0);
    expect(isWithinOfficeHours(defaultSettings, sat)).toBeFalsy();
    expect(isWithinOfficeHours(defaultSettings, sun)).toBeFalsy();
  });
});
describe("Office Settings: isWithinOfficeHours (Overnight Shift 10 PM to 6 AM)", () => {
  const nightSettings2 = {
    ...defaultSettings,
    startHour: 22,
    // 10 PM
    endHour: 6
    // 6 AM
  };
  it("should return TRUE for check-in at 10:00 PM (22:00)", () => {
    const d = getWeekdayDate();
    d.setHours(22, 0, 0, 0);
    expect(isWithinOfficeHours(nightSettings2, d)).toBeTruthy();
  });
  it("should return TRUE for check-in at 11:30 PM (23:30)", () => {
    const d = getWeekdayDate();
    d.setHours(23, 30, 0, 0);
    expect(isWithinOfficeHours(nightSettings2, d)).toBeTruthy();
  });
  it("should return TRUE for check-in at 3:00 AM (03:00)", () => {
    const d = getWeekdayDate();
    d.setHours(3, 0, 0, 0);
    expect(isWithinOfficeHours(nightSettings2, d)).toBeTruthy();
  });
  it("should return TRUE for check-in at 6:00 AM (06:00)", () => {
    const d = getWeekdayDate();
    d.setHours(6, 0, 0, 0);
    expect(isWithinOfficeHours(nightSettings2, d)).toBeTruthy();
  });
  it("should return FALSE for check-in at 1:00 PM (13:00 - outside night shift)", () => {
    const d = getWeekdayDate();
    d.setHours(13, 0, 0, 0);
    expect(isWithinOfficeHours(nightSettings2, d)).toBeFalsy();
  });
  it("should return FALSE for check-in at 9:00 PM (21:00 - 1 hour before night shift start)", () => {
    const d = getWeekdayDate();
    d.setHours(21, 0, 0, 0);
    expect(isWithinOfficeHours(nightSettings2, d)).toBeFalsy();
  });
});
describe("Office Settings: 12-Hour Format Normalization (startHour: 10, endHour: 6)", () => {
  const pmSettings = {
    ...defaultSettings,
    startHour: 10,
    endHour: 6
    // 6 PM saved as 12-hour format '6'
  };
  it("should return TRUE for check-in at 1:22 PM (13:22) when endHour is saved as 6 (12-hour format)", () => {
    const d = getWeekdayDate();
    d.setHours(13, 22, 0, 0);
    expect(isWithinOfficeHours(pmSettings, d)).toBeTruthy();
  });
  it("should return TRUE for check-in at 5:59 PM (17:59) when endHour is saved as 6", () => {
    const d = getWeekdayDate();
    d.setHours(17, 59, 0, 0);
    expect(isWithinOfficeHours(pmSettings, d)).toBeTruthy();
  });
  it("should return FALSE for check-in at 6:05 PM (18:05) after office closes", () => {
    const d = getWeekdayDate();
    d.setHours(18, 5, 0, 0);
    expect(isWithinOfficeHours(pmSettings, d)).toBeFalsy();
  });
});

// src/lib/data/attendance/odh-clearing.ts
function getMondayOfWeek(isoDate) {
  const d = /* @__PURE__ */ new Date(`${isoDate}T00:00:00`);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return mon.toISOString().slice(0, 10);
}
function resolveODHAndPenalties(records, tasks, employee, settings3, initialOdhMap, initialPenaltyMap, targetMonthStr) {
  const odhMap = { ...initialOdhMap };
  const originalOdhMap = { ...initialOdhMap };
  const penaltyMap = {};
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
  const filteredRecords = empId ? records.filter((r) => r.uid === empId || r.uid === employee?.uid || r.uid === employee?.id) : records;
  const recordByDate = {};
  for (const r of filteredRecords) {
    recordByDate[r.date] = r;
  }
  const relevantTasks = (tasks || []).filter((t) => {
    if (t.status !== "done") return false;
    if (!t.isOvertime) return false;
    if (!t.resolvesODH && !t.compensatesWeeklyHours) return false;
    if (targetMonthStr && !t.date.startsWith(targetMonthStr)) return false;
    if (empId && t.assigneeId !== empId && t.assigneeId !== employee?.uid) return false;
    return true;
  });
  relevantTasks.sort((a, b) => a.date.localeCompare(b.date));
  for (const t of relevantTasks) {
    let taskMins = Math.round((Number(t.assignedHours) || 0) * 60);
    if (taskMins <= 0) continue;
    const taskDate = t.date;
    const taskMonth = taskDate.slice(0, 7);
    const mondayOfTaskWeek = getMondayOfWeek(taskDate);
    const allDatesInMonth = [];
    const dateSet = /* @__PURE__ */ new Set([
      ...Object.keys(odhMap),
      ...Object.keys(penaltyMap),
      ...Object.keys(recordByDate)
    ]);
    for (const d of dateSet) {
      if (d.startsWith(taskMonth) && d <= taskDate) {
        allDatesInMonth.push(d);
      }
    }
    allDatesInMonth.sort((a, b) => b.localeCompare(a));
    const sameDayQueue = allDatesInMonth.filter((d) => d === taskDate);
    const sameWeekQueue = allDatesInMonth.filter((d) => d < taskDate && d >= mondayOfTaskWeek);
    const earlierMonthQueue = allDatesInMonth.filter((d) => d < mondayOfTaskWeek);
    const orderedQueue = [...sameDayQueue, ...sameWeekQueue, ...earlierMonthQueue];
    const taskDateRec = recordByDate[taskDate];
    const isTaskDateAbsent = taskDateRec?.status === "absent";
    const isTaskDateLeave = taskDateRec?.status === "on_leave" || taskDateRec?.status === "sick_leave" || penaltyMap[taskDate] && penaltyMap[taskDate].some((c) => c.type === "leave");
    const canClearOtherAbsences = t.compensatesWeeklyHours && (isTaskDateAbsent || isTaskDateLeave);
    let lastMatchedDay = null;
    for (const d of orderedQueue) {
      if (taskMins <= 0) break;
      const rec = recordByDate[d];
      const isAbsent = rec?.status === "absent";
      const isLeave = rec?.status === "on_leave" || rec?.status === "sick_leave" || penaltyMap[d]?.some((c) => c.type === "leave");
      const dayOfWeek = (/* @__PURE__ */ new Date(d + "T12:00:00")).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (d !== taskDate) {
        if (!canClearOtherAbsences && (isAbsent || isLeave)) {
          continue;
        }
        if (isWeekend) {
          continue;
        }
      }
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
          if (chip.type === "intern_late_odh" || chip.type === "intern_leave_odh" || chip.type === "intern_absent_odh" || chip.type === "odh") {
            penaltyNeeded = chip.minutes || (chip.type === "intern_late_odh" ? dailyMinutes / 2 : dailyMinutes);
            penaltyTypeToClear = chip.type;
            hasUnclearedPenalty = true;
            break;
          }
        }
      }
      if (treatAsUnpaidIntern && hasUnclearedPenalty) {
        const totalOTAbsorbed = (penaltyMap[d] || []).filter((c) => c.type === "clearing_odh_absorbed").reduce((sum, c) => sum + (c.minutes || 0), 0);
        const originalOdhNeeded = initialOdhMap[d] || 0;
        const otTowardsPenalties = Math.max(0, totalOTAbsorbed - originalOdhNeeded);
        penaltyNeeded = Math.max(0, penaltyNeeded - otTowardsPenalties);
      }
      const currentOdhNeeded = odhMap[d] || 0;
      const totalDebt = treatAsUnpaidIntern ? currentOdhNeeded + penaltyNeeded : currentOdhNeeded;
      let remainingDebt = totalDebt;
      let didAbsorbODH = false;
      let absorbedOnDay = 0;
      if (remainingDebt > 0 && taskMins > 0) {
        lastMatchedDay = d;
        absorbedOnDay = Math.min(taskMins, remainingDebt);
        odhMap[d] = Math.max(0, currentOdhNeeded - absorbedOnDay);
        taskMins -= absorbedOnDay;
        totalResolvedODHMinutes += absorbedOnDay;
        didAbsorbODH = true;
        if (treatAsUnpaidIntern && currentOdhNeeded > 0 && odhMap[d] === 0) {
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
            clearedPenaltyType: "odh"
          });
        }
        if (treatAsUnpaidIntern && hasUnclearedPenalty && absorbedOnDay >= penaltyNeeded) {
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
            clearedPenaltyType: penaltyTypeToClear
          });
        }
      }
      if (!treatAsUnpaidIntern && (odhMap[d] || 0) === 0 && t.compensatesWeeklyHours) {
        const chips = penaltyMap[d] || [];
        const newChips = [...chips];
        let clearedAnyOnDay = false;
        let totalPenaltyCosts = 0;
        for (const c of chips) {
          if (c.isClearingChip) continue;
          const isCleared = chips.some((clearingChip) => clearingChip.isClearingChip && clearingChip.clearedPenaltyType === c.type);
          if (isCleared) continue;
          let cost = c.minutes || 0;
          if (!cost) {
            cost = c.type === "late" || c.type === "half_day" || c.type === "employee_late_deduction" ? dailyMinutes / 2 : dailyMinutes;
          }
          totalPenaltyCosts += cost;
        }
        const totalOTAbsorbed = chips.filter((c) => c.type === "clearing_odh_absorbed").reduce((sum, c) => sum + (c.minutes || 0), 0);
        let remainingDebtForPenalties = Math.max(0, totalPenaltyCosts - totalOTAbsorbed);
        for (const chip of chips) {
          if (chip.isClearingChip) continue;
          const alreadyCleared = chips.some(
            (c) => c.isClearingChip && c.clearedPenaltyType === chip.type
          );
          if (alreadyCleared) continue;
          let chipCost = chip.minutes || 0;
          if (!chipCost) {
            if (chip.type === "late" || chip.type === "half_day" || chip.type === "employee_late_deduction") {
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
          if (chip.type === "late" || chip.type === "half_day" || chip.type === "employee_late_deduction") {
            newChips.push({
              type: "clearing_late",
              label: "+0.5d Salary (Task Cleared)",
              tooltip: `Late-day penalty cleared by Compensatory Task (${t.title})`,
              color: "#22c55e",
              bgcolor: "#22c55e20",
              isClearingChip: true,
              clearedPenaltyType: chip.type
            });
            clearedDeductionDays += 0.5;
            clearedAnyOnDay = true;
            if (!didAbsorbODH) {
              taskMins = Math.max(0, taskMins - actualCost);
              absorbedOnDay += actualCost;
              remainingDebtForPenalties = Math.max(0, remainingDebtForPenalties - actualCost);
            }
            break;
          } else if (chip.type === "absent" || chip.type === "employee_absent_deduction" || chip.type === "employee_leave_deduction" || chip.type === "leave" || chip.type === "full_day") {
            newChips.push({
              type: "clearing_absent",
              label: "+1.0d Salary (Task Cleared)",
              tooltip: `Salary deduction cleared by Compensatory Task (${t.title})`,
              color: "#22c55e",
              bgcolor: "#22c55e20",
              isClearingChip: true,
              clearedPenaltyType: chip.type
            });
            clearedDeductionDays += 1;
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
        const dObj = /* @__PURE__ */ new Date(t.date + "T12:00:00");
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
          clearedPenaltyType: "odh"
        });
      }
    }
  }
  return {
    odhMap,
    penaltyMap,
    clearedDeductionDays,
    totalResolvedODHMinutes
  };
}

// src/lib/data/attendance/calculations.ts
function isCheckInLate(checkInIso, settings3) {
  const checkIn = new Date(checkInIso);
  const deadline = new Date(checkIn);
  deadline.setHours(settings3.startHour, settings3.startMinute, 0, 0);
  deadline.setMinutes(deadline.getMinutes() + settings3.graceMinutes);
  return checkIn > deadline;
}
function calcOvertimeMinutes(checkOutIso, settings3) {
  const checkOut = new Date(checkOutIso);
  const endTime = new Date(checkOut);
  endTime.setHours(settings3.endHour, settings3.endMinute, 0, 0);
  const diff = (checkOut.getTime() - endTime.getTime()) / 6e4;
  return Math.max(0, Math.round(diff));
}
function getLocalISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function getEmployeeStartYearMonth(employee) {
  if (employee?.startDate && typeof employee.startDate === "string" && employee.startDate.length >= 7) {
    return employee.startDate.slice(0, 7);
  }
  if (employee?.createdAt) {
    const dt = typeof employee.createdAt.toDate === "function" ? employee.createdAt.toDate() : new Date(employee.createdAt);
    if (!isNaN(dt.getTime())) {
      const yr = dt.getFullYear();
      const mo = String(dt.getMonth() + 1).padStart(2, "0");
      return `${yr}-${mo}`;
    }
  }
  const now = /* @__PURE__ */ new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
function getDynamicLeaveAllowance({
  employee,
  settings: settings3,
  targetMonthStr,
  allAttendanceRecords
}) {
  const baseAllowance = employee?.accessLevel === "intern" ? settings3.internLeavesPerMonth : settings3.employeeLeavesPerMonth;
  const startMonthStr = getEmployeeStartYearMonth(employee);
  if (!targetMonthStr || !allAttendanceRecords || targetMonthStr <= startMonthStr) {
    return {
      baseAllowance,
      rolloverLeaves: 0,
      totalAllowedLeaves: baseAllowance,
      startMonthStr
    };
  }
  let currentRollover = 0;
  const curr = /* @__PURE__ */ new Date(`${startMonthStr}-01T00:00:00`);
  const end = /* @__PURE__ */ new Date(`${targetMonthStr}-01T00:00:00`);
  while (curr < end) {
    const yr = curr.getFullYear();
    const mo = String(curr.getMonth() + 1).padStart(2, "0");
    const monthPrefix = `${yr}-${mo}`;
    const monthAllowed = baseAllowance + currentRollover;
    let usedLeaves = 0;
    allAttendanceRecords.forEach((r) => {
      if (r.uid === employee.uid && r.date.startsWith(monthPrefix) && r.status === "on_leave") {
        usedLeaves++;
      }
    });
    currentRollover = Math.max(0, monthAllowed - usedLeaves);
    curr.setMonth(curr.getMonth() + 1);
  }
  return {
    baseAllowance,
    rolloverLeaves: currentRollover,
    totalAllowedLeaves: baseAllowance + currentRollover,
    startMonthStr
  };
}
function calculateDynamicAllowedLeaves({
  employee,
  settings: settings3,
  targetMonthStr,
  allAttendanceRecords
}) {
  return getDynamicLeaveAllowance({
    employee,
    settings: settings3,
    targetMonthStr,
    allAttendanceRecords
  }).totalAllowedLeaves;
}
function computeMonthlySummary(records, tasks, settings3, isIntern, employee, allAttendanceRecords, targetMonthStr) {
  let totalPresent = 0;
  let totalLate = 0;
  let totalLeaves = 0;
  let totalSickLeaves = 0;
  let totalAbsent = 0;
  let totalHoursWorked = 0;
  let totalOvertimeMinutes = 0;
  let totalAdminLeaves = 0;
  for (const r of records) {
    switch (r.status) {
      case "present":
        totalPresent++;
        break;
      case "late":
        totalLate++;
        break;
      case "on_leave":
        if (r.adminApprovedLeave) {
          totalAdminLeaves++;
        } else {
          totalLeaves++;
        }
        break;
      case "sick_leave":
        totalSickLeaves++;
        break;
      case "absent":
        totalAbsent++;
        break;
    }
    let hw = r.hoursWorked || 0;
    let ot = r.overtimeMinutes || 0;
    if (hw === 0 && r.checkIn) {
      const outTime = r.checkOut ? new Date(r.checkOut) : /* @__PURE__ */ new Date();
      hw = Math.max(
        0,
        (outTime.getTime() - new Date(r.checkIn).getTime()) / 36e5
      );
      ot = r.checkOut ? calcOvertimeMinutes(r.checkOut, settings3) : 0;
    }
    totalHoursWorked += hw;
    totalOvertimeMinutes += ot;
  }
  const empId = employee?.id || employee?.uid || (records[0] ? records[0].uid : void 0);
  for (const t of tasks) {
    const isForEmployee = !empId || t.assigneeId === empId || t.assigneeId === employee?.id || t.assigneeId === employee?.uid;
    const isForMonth = !targetMonthStr || t.date.startsWith(targetMonthStr);
    if (isForEmployee && isForMonth && t.status === "done") {
      if (t.isOvertime || t.compensatesWeeklyHours) {
        totalHoursWorked += Number(t.assignedHours) || 0;
        if (isIntern) {
          totalOvertimeMinutes += (Number(t.assignedHours) || 0) * 60;
        } else if (!t.resolvesODH && !t.compensatesWeeklyHours) {
          totalOvertimeMinutes += (Number(t.assignedHours) || 0) * 60;
        }
      }
    }
  }
  const allowedLeaves = employee && allAttendanceRecords && targetMonthStr ? calculateDynamicAllowedLeaves({
    employee,
    settings: settings3,
    targetMonthStr,
    allAttendanceRecords
  }) : isIntern ? settings3.internLeavesPerMonth : settings3.employeeLeavesPerMonth;
  const excessLeaves = Math.max(0, totalLeaves - allowedLeaves);
  const grossLatePenalties = Math.max(
    0,
    totalLate - settings3.lateThresholdDays
  );
  const initialPenaltyMap = getDailyPenaltyMap(
    allAttendanceRecords || records,
    employee,
    settings3,
    targetMonthStr
  );
  const rawOdhMap = getWeeklyOvertimeDueMap(
    allAttendanceRecords || records,
    employee,
    settings3,
    [],
    initialPenaltyMap
  );
  const clearingResult = resolveODHAndPenalties(
    allAttendanceRecords || records,
    tasks,
    employee,
    settings3,
    rawOdhMap,
    initialPenaltyMap,
    targetMonthStr
  );
  const totalWeeklyODH = Object.entries(clearingResult.odhMap).filter(([date]) => !targetMonthStr || date.startsWith(targetMonthStr)).reduce((acc, [, m]) => acc + m, 0);
  const isPaid = Number(employee?.monthlySalary) > 0;
  const treatAsUnpaidIntern = isIntern && !isPaid;
  let unclearedLateCount = 0;
  let unclearedLeaveCount = 0;
  let unclearedAbsentCount = 0;
  Object.entries(clearingResult.penaltyMap).filter(([date]) => !targetMonthStr || date.startsWith(targetMonthStr)).forEach(([, chips]) => {
    chips.forEach((chip) => {
      if (chip.isClearingChip) return;
      const isCleared = chips.some(
        (c) => c.isClearingChip && c.clearedPenaltyType === chip.type
      );
      if (isCleared) return;
      if (chip.type === "late" || chip.type === "half_day" || chip.type === "employee_late_deduction" || chip.type === "intern_late_odh") {
        unclearedLateCount++;
      } else if (chip.type === "leave" || chip.type === "employee_leave_deduction" || chip.type === "intern_leave_odh") {
        unclearedLeaveCount++;
      } else if (chip.type === "absent" || chip.type === "employee_absent_deduction" || chip.type === "intern_absent_odh") {
        unclearedAbsentCount++;
      }
    });
  });
  const unclearedInternPenaltyMinutes = Object.entries(clearingResult.penaltyMap).filter(([date]) => !targetMonthStr || date.startsWith(targetMonthStr)).reduce((acc, [, chips]) => {
    return acc + chips.filter((c) => {
      if (c.isClearingChip || !c.minutes) return false;
      const isCleared = chips.some(
        (cl) => cl.isClearingChip && cl.clearedPenaltyType === c.type
      );
      return !isCleared;
    }).reduce((s, c) => s + (c.minutes || 0), 0);
  }, 0);
  if (treatAsUnpaidIntern) {
    return {
      totalPresent,
      totalLate,
      totalLeaves,
      totalAdminLeaves,
      totalSickLeaves,
      totalAbsent: unclearedAbsentCount,
      totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
      totalOvertimeMinutes,
      lateDaysOverThreshold: 0,
      excessLeaves: 0,
      deductionDays: 0,
      overtimeDueMinutes: totalWeeklyODH + unclearedInternPenaltyMinutes,
      penaltyODHMinutes: unclearedInternPenaltyMinutes
    };
  } else {
    const lateDaysOverThreshold = grossLatePenalties;
    const rawDeductionDays = lateDaysOverThreshold * 0.5 + excessLeaves + totalAbsent;
    const deductionDays = Math.max(
      0,
      rawDeductionDays - clearingResult.clearedDeductionDays
    );
    return {
      totalPresent,
      totalLate,
      totalLeaves,
      totalAdminLeaves,
      totalSickLeaves,
      totalAbsent: unclearedAbsentCount,
      totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
      totalOvertimeMinutes,
      lateDaysOverThreshold: unclearedLateCount,
      excessLeaves: unclearedLeaveCount,
      deductionDays,
      overtimeDueMinutes: totalWeeklyODH,
      penaltyODHMinutes: unclearedInternPenaltyMinutes
    };
  }
}
function getWeeklyOvertimeDueMap(records, employee, settings3, tasks = [], penaltyMap) {
  const odhMap = {};
  if (!records || records.length === 0) return odhMap;
  const empId = employee?.id || employee?.uid;
  const filteredRecords = empId ? records.filter((r) => r.uid === empId || r.uid === employee?.uid || r.uid === employee?.id) : records;
  const weekGroups = {};
  for (const r of filteredRecords) {
    if (!r.date) continue;
    const d = /* @__PURE__ */ new Date(r.date + "T12:00:00");
    const dayOfWeek = d.getDay();
    const diffToMonday = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const mon = new Date(d);
    mon.setDate(diffToMonday);
    const weekKey = getLocalISODate(mon);
    if (!weekGroups[weekKey]) weekGroups[weekKey] = [];
    weekGroups[weekKey].push(r);
  }
  const todayStr = getLocalISODate(/* @__PURE__ */ new Date());
  const now = /* @__PURE__ */ new Date();
  const closingTimeToday = new Date(now);
  closingTimeToday.setHours(settings3.endHour || 18, settings3.endMinute || 0, 0, 0);
  const defaultWeeklyHours = Number(employee?.officeHours) || (employee?.accessLevel === "intern" ? 30 : 40);
  const dailyRequiredHours = defaultWeeklyHours / 5;
  const dailyRequiredMinutes = Math.round(dailyRequiredHours * 60);
  for (const [weekKey, weekRecords] of Object.entries(weekGroups)) {
    const mon = /* @__PURE__ */ new Date(weekKey + "T12:00:00");
    const fri = new Date(mon);
    fri.setDate(fri.getDate() + 4);
    const friStr = getLocalISODate(fri);
    const friRec = weekRecords.find((r) => r.date === friStr);
    const isFriClosed = friStr < todayStr || friRec && (friRec.checkOut !== null || friRec.status === "absent" || friRec.status === "on_leave" || friRec.status === "sick_leave") || todayStr === friStr && now >= closingTimeToday;
    if (!isFriClosed) {
      continue;
    }
    let leaveDaysCount = 0;
    for (let i = 0; i < 5; i++) {
      const dayDate = new Date(mon);
      dayDate.setDate(dayDate.getDate() + i);
      const dayStr = getLocalISODate(dayDate);
      if (employee?.startDate && dayStr < employee.startDate) {
        leaveDaysCount++;
        continue;
      }
      const rec = weekRecords.find((r) => r.date === dayStr);
      if (rec && (rec.status === "on_leave" || rec.status === "sick_leave" || rec.status === "absent")) {
        leaveDaysCount++;
      }
    }
    const requiredWeekMinutes = Math.max(
      0,
      (5 - leaveDaysCount) * dailyRequiredMinutes
    );
    let totalWeekWorkedMinutes = 0;
    const dayWorkedMap = {};
    for (const r of weekRecords) {
      let hw = r.hoursWorked || 0;
      if (hw === 0 && r.checkIn) {
        const outTime = r.checkOut ? new Date(r.checkOut) : /* @__PURE__ */ new Date();
        hw = Math.max(
          0,
          (outTime.getTime() - new Date(r.checkIn).getTime()) / 36e5
        );
      }
      const empId2 = employee?.id || employee?.uid || r.uid;
      const dayTasks = tasks.filter(
        (t) => t.date === r.date && (t.assigneeId === empId2 || t.assigneeId === r.uid) && t.status === "done" && (t.isOvertime || t.compensatesWeeklyHours)
      );
      const taskMins = dayTasks.reduce(
        (acc, t) => acc + Math.round((Number(t.assignedHours) || 0) * 60),
        0
      );
      const dayMins = Math.round(hw * 60) + taskMins;
      dayWorkedMap[r.date] = dayMins;
      totalWeekWorkedMinutes += dayMins;
    }
    let weeklyOvertimeDueMinutes = Math.max(
      0,
      requiredWeekMinutes - totalWeekWorkedMinutes
    );
    const allowedFlexMinutes = (Number(employee?.flexibilityHours) || 0) * 60;
    if (weeklyOvertimeDueMinutes > 0 && allowedFlexMinutes > 0) {
      const usedFlexMinutesInWeek = weekRecords.reduce(
        (acc, r) => acc + (Number(r.flexibilityUsed) || 0),
        0
      );
      const remainingFlexMinutes = Math.max(
        0,
        allowedFlexMinutes - usedFlexMinutesInWeek
      );
      if (remainingFlexMinutes > 0) {
        const flexCovered = Math.min(
          weeklyOvertimeDueMinutes,
          remainingFlexMinutes
        );
        weeklyOvertimeDueMinutes -= flexCovered;
        if (penaltyMap && flexCovered > 0) {
          const sortedWeekRecords = [...weekRecords].sort((a, b) => b.date.localeCompare(a.date));
          if (sortedWeekRecords.length > 0) {
            const lastDate = sortedWeekRecords[0].date;
            if (!penaltyMap[lastDate]) penaltyMap[lastDate] = [];
            const hrs = Math.floor(flexCovered / 60);
            const mins = flexCovered % 60;
            const timeStr = mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h 0m`;
            penaltyMap[lastDate].push({
              type: "flex_used",
              label: `+${timeStr} Flex Used`,
              tooltip: `Remaining weekly flexibility (${timeStr}) used to cover weekly ODH`,
              color: "#3b82f6",
              bgcolor: "#3b82f622"
            });
          }
        }
      }
    }
    if (weeklyOvertimeDueMinutes > 0) {
      const shortDays = [];
      for (const r of weekRecords) {
        if (r.status === "on_leave" || r.status === "sick_leave" || r.status === "absent")
          continue;
        const worked = dayWorkedMap[r.date] || 0;
        if (worked < dailyRequiredMinutes) {
          shortDays.push({
            date: r.date,
            shortfall: dailyRequiredMinutes - worked
          });
        }
      }
      shortDays.sort((a, b) => a.date.localeCompare(b.date));
      let remainingODH = weeklyOvertimeDueMinutes;
      for (const sd of shortDays) {
        if (remainingODH <= 0) break;
        const alloc = Math.min(remainingODH, sd.shortfall);
        if (alloc > 0) {
          odhMap[sd.date] = (odhMap[sd.date] || 0) + alloc;
          remainingODH -= alloc;
        }
      }
    }
  }
  return odhMap;
}
function getDailyPenaltyMap(records, employee, settings3, targetMonthStr) {
  const penaltyMap = {};
  if (!records || records.length === 0) return penaltyMap;
  const empId = employee?.id || employee?.uid;
  const filteredRecords = empId ? records.filter((r) => r.uid === empId || r.uid === employee?.uid || r.uid === employee?.id) : records;
  const monthGroups = {};
  for (const r of filteredRecords) {
    if (!r.date) continue;
    const mo = r.date.slice(0, 7);
    if (targetMonthStr && !r.date.startsWith(targetMonthStr)) continue;
    if (!monthGroups[mo]) monthGroups[mo] = [];
    monthGroups[mo].push(r);
  }
  const isIntern = employee?.accessLevel === "intern";
  const isPaid = Number(employee?.monthlySalary) > 0;
  const treatAsUnpaidIntern = isIntern && !isPaid;
  const dailyHours = (Number(employee?.officeHours) || (isIntern ? 30 : 40)) / 5;
  const halfDayHours = dailyHours / 2;
  const lateThreshold = settings3?.lateThresholdDays ?? 3;
  for (const [mo, moRecords] of Object.entries(monthGroups)) {
    moRecords.sort((a, b) => a.date.localeCompare(b.date));
    let lateCount = 0;
    let leaveCount = 0;
    const allowedLeaves = calculateDynamicAllowedLeaves({
      employee,
      settings: settings3,
      targetMonthStr: mo,
      allAttendanceRecords: records
    });
    for (const r of moRecords) {
      if (!penaltyMap[r.date]) penaltyMap[r.date] = [];
      if (r.isLate) {
        lateCount++;
        if (lateCount > lateThreshold) {
          if (treatAsUnpaidIntern) {
            penaltyMap[r.date].push({
              type: "intern_late_odh",
              label: `+${halfDayHours}h Late ODH`,
              tooltip: `Late Penalty Overtime Due (+${halfDayHours}h half-day office hours added for exceeding monthly lates threshold)`,
              color: "#a855f7",
              // Purple
              bgcolor: "#a855f722",
              minutes: Math.round(halfDayHours * 60)
            });
          } else {
            penaltyMap[r.date].push({
              type: "employee_late_deduction",
              label: "-0.5d Salary",
              tooltip: "Salary Deduction Penalty (0.5 day salary deduction for exceeding monthly lates threshold)",
              color: "#f43f5e",
              // Rose/crimson
              bgcolor: "#f43f5e22"
            });
          }
        }
      }
      if (r.status === "on_leave" && !r.adminApprovedLeave) {
        leaveCount++;
        if (leaveCount > allowedLeaves) {
          if (treatAsUnpaidIntern) {
            penaltyMap[r.date].push({
              type: "intern_leave_odh",
              label: `+${dailyHours}h Leave ODH`,
              tooltip: `Leave Penalty Overtime Due (+${dailyHours}h office hours for unapproved excess leave)`,
              color: "#a855f7",
              bgcolor: "#a855f722",
              minutes: Math.round(dailyHours * 60)
            });
          } else {
            penaltyMap[r.date].push({
              type: "employee_leave_deduction",
              label: "-1d Salary",
              tooltip: "Salary Deduction Penalty (1.0 day salary deduction for unapproved excess leave)",
              color: "#f43f5e",
              bgcolor: "#f43f5e22"
            });
          }
        }
      }
      if (r.status === "absent") {
        if (treatAsUnpaidIntern) {
          penaltyMap[r.date].push({
            type: "intern_absent_odh",
            label: `+${dailyHours}h Absent ODH`,
            tooltip: `Absence Penalty Overtime Due (+${dailyHours}h office hours for unexcused absence)`,
            color: "#a855f7",
            bgcolor: "#a855f722",
            minutes: Math.round(dailyHours * 60)
          });
        } else {
          penaltyMap[r.date].push({
            type: "employee_absent_deduction",
            label: "-1d Salary",
            tooltip: "Salary Deduction Penalty (1.0 day salary deduction for unexcused absence)",
            color: "#f43f5e",
            bgcolor: "#f43f5e22"
          });
        }
      }
    }
  }
  return penaltyMap;
}

// test/attendance-grace-flex.test.ts
var settings = {
  startHour: 10,
  startMinute: 0,
  endHour: 18,
  endMinute: 0,
  graceMinutes: 30,
  lateThresholdDays: 3,
  employeeLeavesPerMonth: 2,
  internLeavesPerMonth: 1
};
function computeLateMinutesWithGrace(checkInIso, settings3) {
  const now = new Date(checkInIso);
  const officeStart = new Date(now);
  officeStart.setHours(settings3.startHour, settings3.startMinute, 0, 0);
  const graceDeadline = new Date(officeStart);
  graceDeadline.setMinutes(graceDeadline.getMinutes() + (settings3.graceMinutes || 0));
  if (now > graceDeadline) {
    const lateMinutes = Math.floor((now.getTime() - graceDeadline.getTime()) / 6e4);
    return { isLate: true, lateMinutes };
  }
  return { isLate: false, lateMinutes: 0 };
}
describe("Attendance Grace Period & Flexibility Calculation", () => {
  it("should mark check-in at 10:15 AM as NOT LATE with 0 lateMinutes (within grace period)", () => {
    const checkIn = /* @__PURE__ */ new Date();
    checkIn.setHours(10, 15, 0, 0);
    expect(isCheckInLate(checkIn.toISOString(), settings)).toBeFalsy();
    const res = computeLateMinutesWithGrace(checkIn.toISOString(), settings);
    expect(res.isLate).toBeFalsy();
    expect(res.lateMinutes).toBe(0);
  });
  it("should mark check-in at 10:30 AM as NOT LATE with 0 lateMinutes (exact grace deadline)", () => {
    const checkIn = /* @__PURE__ */ new Date();
    checkIn.setHours(10, 30, 0, 0);
    expect(isCheckInLate(checkIn.toISOString(), settings)).toBeFalsy();
    const res = computeLateMinutesWithGrace(checkIn.toISOString(), settings);
    expect(res.isLate).toBeFalsy();
    expect(res.lateMinutes).toBe(0);
  });
  it("should mark check-in at 10:45 AM as LATE and deduct only 15 minutes of flex time (NOT 45 minutes)", () => {
    const checkIn = /* @__PURE__ */ new Date();
    checkIn.setHours(10, 45, 0, 0);
    expect(isCheckInLate(checkIn.toISOString(), settings)).toBeTruthy();
    const res = computeLateMinutesWithGrace(checkIn.toISOString(), settings);
    expect(res.isLate).toBeTruthy();
    expect(res.lateMinutes).toBe(15);
  });
  it("should mark check-in at 11:00 AM as LATE and deduct 30 minutes of flex time", () => {
    const checkIn = /* @__PURE__ */ new Date();
    checkIn.setHours(11, 0, 0, 0);
    expect(isCheckInLate(checkIn.toISOString(), settings)).toBeTruthy();
    const res = computeLateMinutesWithGrace(checkIn.toISOString(), settings);
    expect(res.isLate).toBeTruthy();
    expect(res.lateMinutes).toBe(30);
  });
});

// test/intern-vs-employee.test.ts
var settings2 = {
  startHour: 10,
  startMinute: 0,
  endHour: 18,
  endMinute: 0,
  graceMinutes: 30,
  lateThresholdDays: 3,
  employeeLeavesPerMonth: 2,
  internLeavesPerMonth: 1
};
describe("Intern vs Employee Monthly Summary & Penalty Math", () => {
  it("should calculate Intern (6 hours/day = 30 hours/week) penalties as Overtime Due with 0 deductionDays", () => {
    const mockRecords = [
      { id: "1", uid: "int1", date: "2026-07-01", status: "late", isLate: true, hoursWorked: 6 },
      { id: "2", uid: "int1", date: "2026-07-02", status: "late", isLate: true, hoursWorked: 6 },
      { id: "3", uid: "int1", date: "2026-07-03", status: "late", isLate: true, hoursWorked: 6 },
      { id: "4", uid: "int1", date: "2026-07-04", status: "late", isLate: true, hoursWorked: 6 },
      // 4th late day (1 over threshold)
      { id: "5", uid: "int1", date: "2026-07-05", status: "late", isLate: true, hoursWorked: 6 }
      // 5th late day (2 over threshold)
    ];
    const internSummary = computeMonthlySummary(mockRecords, [], settings2, true, {
      accessLevel: "intern",
      officeHours: 30
    });
    expect(internSummary.totalLate).toBe(5);
    expect(internSummary.deductionDays).toBe(0);
    expect(internSummary.overtimeDueMinutes).toBe(360);
  });
  it("should calculate Employee (8 hours/day = 40 hours/week) penalties as Salary Deduction Days", () => {
    const mockRecords = [
      { id: "1", uid: "emp1", date: "2026-07-01", status: "late", isLate: true, hoursWorked: 8 },
      { id: "2", uid: "emp1", date: "2026-07-02", status: "late", isLate: true, hoursWorked: 8 },
      { id: "3", uid: "emp1", date: "2026-07-03", status: "late", isLate: true, hoursWorked: 8 },
      { id: "4", uid: "emp1", date: "2026-07-04", status: "late", isLate: true, hoursWorked: 8 },
      // 4th late day (1 over threshold)
      { id: "5", uid: "emp1", date: "2026-07-05", status: "late", isLate: true, hoursWorked: 8 }
      // 5th late day (2 over threshold)
    ];
    const empSummary = computeMonthlySummary(mockRecords, [], settings2, false, {
      accessLevel: "member",
      officeHours: 40
    });
    expect(empSummary.totalLate).toBe(5);
    expect(empSummary.deductionDays).toBe(1);
    expect(empSummary.lateDaysOverThreshold).toBe(2);
  });
  it("should mark unworked/short weekly hours as Overtime Due (ODH) at Friday end of week for both Employees and Interns", () => {
    const mockRecords = [
      { id: "1", uid: "emp1", date: "2026-07-20", status: "present", hoursWorked: 6 },
      { id: "2", uid: "emp1", date: "2026-07-21", status: "present", hoursWorked: 8 },
      { id: "3", uid: "emp1", date: "2026-07-22", status: "present", hoursWorked: 7 },
      { id: "4", uid: "emp1", date: "2026-07-23", status: "on_leave", hoursWorked: 0 },
      { id: "5", uid: "emp1", date: "2026-07-24", status: "present", hoursWorked: 8 }
    ];
    const empSummary = computeMonthlySummary(mockRecords, [], settings2, false, {
      accessLevel: "member",
      officeHours: 40
    });
    expect(empSummary.overtimeDueMinutes).toBe(180);
  });
  it("should check flexibility first on Friday end of week, deduct unused flexibility from ODH, and distribute only the remainder", () => {
    const mockRecords = [
      { id: "1", uid: "emp1", date: "2026-07-20", status: "present", hoursWorked: 6 },
      { id: "2", uid: "emp1", date: "2026-07-21", status: "present", hoursWorked: 8 },
      { id: "3", uid: "emp1", date: "2026-07-22", status: "present", hoursWorked: 7 },
      { id: "4", uid: "emp1", date: "2026-07-23", status: "present", hoursWorked: 8 },
      { id: "5", uid: "emp1", date: "2026-07-24", status: "present", hoursWorked: 8 }
    ];
    const empSummary = computeMonthlySummary(mockRecords, [], settings2, false, {
      accessLevel: "member",
      officeHours: 40,
      flexibilityHours: 2
    });
    expect(empSummary.overtimeDueMinutes).toBe(60);
  });
  it("should generate date-specific Late ODH chips for Interns and Salary Deduction chips for Employees when exceeding late threshold", () => {
    const mockRecords = [
      { id: "1", uid: "u1", date: "2026-07-01", status: "present", isLate: true },
      { id: "2", uid: "u1", date: "2026-07-02", status: "present", isLate: true },
      { id: "3", uid: "u1", date: "2026-07-03", status: "present", isLate: true },
      // 3rd late = threshold (no penalty)
      { id: "4", uid: "u1", date: "2026-07-04", status: "present", isLate: true },
      // 4th late = PENALTY!
      { id: "5", uid: "u1", date: "2026-07-05", status: "present", isLate: true }
      // 5th late = PENALTY!
    ];
    const internPenalties = getDailyPenaltyMap(mockRecords, { accessLevel: "intern", officeHours: 30 }, settings2);
    expect(internPenalties["2026-07-03"]?.length || 0).toBe(0);
    expect(internPenalties["2026-07-04"]?.[0]?.label).toBe("+3h Late ODH");
    expect(internPenalties["2026-07-04"]?.[0]?.color).toBe("#a855f7");
    const employeePenalties = getDailyPenaltyMap(mockRecords, { accessLevel: "member", officeHours: 40 }, settings2);
    expect(employeePenalties["2026-07-03"]?.length || 0).toBe(0);
    expect(employeePenalties["2026-07-04"]?.[0]?.label).toBe("-0.5d Salary");
    expect(employeePenalties["2026-07-04"]?.[0]?.color).toBe("#f43f5e");
    const paidInternPenalties = getDailyPenaltyMap(mockRecords, { accessLevel: "intern", officeHours: 30, monthlySalary: 45e3 }, settings2);
    expect(paidInternPenalties["2026-07-04"]?.[0]?.label).toBe("-0.5d Salary");
    expect(paidInternPenalties["2026-07-04"]?.[0]?.color).toBe("#f43f5e");
  });
  it("should treat paid interns identically to employees for salary deductions and apply overtimeOffsetDays when compensatory tasks are worked", () => {
    const mockRecords = [
      { id: "1", uid: "u1", date: "2026-07-01", status: "late", isLate: true, hoursWorked: 6 },
      { id: "2", uid: "u1", date: "2026-07-02", status: "late", isLate: true, hoursWorked: 6 },
      { id: "3", uid: "u1", date: "2026-07-03", status: "late", isLate: true, hoursWorked: 6 },
      { id: "4", uid: "u1", date: "2026-07-04", status: "late", isLate: true, hoursWorked: 6 },
      // 4th late = 1 over threshold (= 0.5d penalty)
      { id: "5", uid: "u1", date: "2026-07-05", status: "late", isLate: true, hoursWorked: 6 }
      // 5th late = 2 over threshold (= 1.0d penalty)
    ];
    const unpaidSummary = computeMonthlySummary(mockRecords, [], settings2, true, {
      accessLevel: "intern",
      officeHours: 30,
      monthlySalary: 0
    });
    expect(unpaidSummary.deductionDays).toBe(0);
    const paidSummary = computeMonthlySummary(mockRecords, [], settings2, true, {
      accessLevel: "intern",
      officeHours: 30,
      monthlySalary: 35e3
    });
    expect(paidSummary.deductionDays).toBe(1);
    const mockCompTask = [{
      id: "t1",
      title: "Compensatory work",
      assigneeId: "u1",
      date: "2026-07-05",
      status: "done",
      isOvertime: true,
      compensatesWeeklyHours: true,
      assignedHours: 3
    }];
    const paidWithCompSummary = computeMonthlySummary(mockRecords, mockCompTask, settings2, true, {
      accessLevel: "intern",
      officeHours: 30,
      monthlySalary: 35e3
    });
    expect(paidWithCompSummary.deductionDays).toBe(0.5);
  });
});

// test/attendance-auto-clockout.test.ts
function shouldAutoClockOut(shiftDateStr, now, settings3) {
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const startH = Number(settings3.startHour) || 10;
  const endH = Number(settings3.endHour) || 18;
  const endM = Number(settings3.endMinute) || 0;
  const todayEnd = new Date(now);
  todayEnd.setHours(endH, endM, 0, 0);
  if (endH < startH) {
    return shiftDateStr < todayStr && now > todayEnd;
  } else {
    if (shiftDateStr < todayStr) return true;
    return shiftDateStr === todayStr && now > todayEnd;
  }
}
var daySettings = {
  startHour: 10,
  startMinute: 0,
  endHour: 18,
  endMinute: 0,
  graceMinutes: 30,
  lateThresholdDays: 3,
  employeeLeavesPerMonth: 2,
  internLeavesPerMonth: 1
};
var nightSettings = {
  ...daySettings,
  startHour: 22,
  endHour: 6
};
describe("Auto Clock-Out Condition Logic (Daytime vs Overnight Shift)", () => {
  it("should NOT close daytime shift during work hours (1:00 PM / 13:00)", () => {
    const now = /* @__PURE__ */ new Date("2026-07-30T13:00:00");
    expect(shouldAutoClockOut("2026-07-30", now, daySettings)).toBeFalsy();
  });
  it("should close daytime shift once office closing time passes (6:05 PM / 18:05)", () => {
    const now = /* @__PURE__ */ new Date("2026-07-30T18:05:00");
    expect(shouldAutoClockOut("2026-07-30", now, daySettings)).toBeTruthy();
  });
  it("should NOT prematurely close an overnight shift at 2:00 AM after midnight (before 6:00 AM closing)", () => {
    const now = /* @__PURE__ */ new Date("2026-07-31T02:00:00");
    expect(shouldAutoClockOut("2026-07-30", now, nightSettings)).toBeFalsy();
  });
  it("should close an overnight shift at 6:05 AM once the night shift morning closing time passes", () => {
    const now = /* @__PURE__ */ new Date("2026-07-31T06:05:00");
    expect(shouldAutoClockOut("2026-07-30", now, nightSettings)).toBeTruthy();
  });
});

// test/odh-clearing.test.ts
var mockSettings = {
  id: "default",
  officeStartTime: "10:00",
  officeEndTime: "18:00",
  graceMinutes: 60,
  flexibilityHours: 3,
  lateThresholdDays: 3,
  employeeLeavesPerMonth: 2,
  internLeavesPerMonth: 2,
  weeklyHoursRequired: 40,
  internWeeklyHoursRequired: 30
};
var employeePaid = {
  id: "emp-1",
  accessLevel: "employee",
  monthlySalary: 5e3,
  officeHours: 40
  // 8h per day
};
var internUnpaid = {
  id: "int-1",
  accessLevel: "intern",
  monthlySalary: 0,
  officeHours: 30
  // 6h per day
};
describe("ODH + Compensatory Toggles and Penalty-Clearing Rules", () => {
  it("should clear ODH and add clearing chip when assigning 5h to task with 5h ODH and linked penalty (\xA71 & \xA74)", () => {
    const records = [
      {
        id: "rec-1",
        uid: "emp-1",
        employeeName: "John Doe",
        date: "2026-08-12",
        status: "present",
        checkIn: "14:00",
        checkOut: "17:00",
        hoursWorked: 3,
        flexibilityUsed: 0,
        isLate: true,
        lateMinutes: 180
      }
    ];
    const initialOdhMap = {
      "2026-08-12": 300
      // 5 hours ODH
    };
    const initialPenaltyMap = {
      "2026-08-12": [
        {
          type: "half_day",
          label: "-0.5d Salary",
          tooltip: "Half day salary deduction",
          color: "#ef4444",
          bgcolor: "#ef444420"
        }
      ]
    };
    const tasks = [
      {
        id: "task-1",
        title: "Fix bug",
        description: "",
        projectId: null,
        projectTitle: null,
        assigneeId: "emp-1",
        assigneeName: "John Doe",
        date: "2026-08-12",
        status: "done",
        report: { text: "done", updatedAt: null },
        assignedHours: 5,
        isOvertime: true,
        resolvesODH: true,
        compensatesWeeklyHours: true,
        createdBy: "admin",
        createdAt: null,
        updatedAt: null
      }
    ];
    const result = resolveODHAndPenalties(
      records,
      tasks,
      employeePaid,
      mockSettings,
      initialOdhMap,
      initialPenaltyMap,
      "2026-08"
    );
    expect(result.odhMap["2026-08-12"]).toBe(0);
    const chips = result.penaltyMap["2026-08-12"];
    expect(chips.length).toBe(2);
    expect(chips[0].label).toBe("-0.5d Salary");
    expect(chips[1].label).toBe("+0.5d Salary (Task Cleared)");
    expect(chips[1].isClearingChip).toBe(true);
    expect(result.clearedDeductionDays).toBe(0.5);
  });
  it("should search same-day first, then backward same week, then earlier weeks (\xA73)", () => {
    const initialOdhMap = {
      "2026-08-05": 120,
      "2026-08-10": 120,
      "2026-08-12": 120
    };
    const tasks = [
      {
        id: "task-2",
        title: "Multi-day clear",
        description: "",
        projectId: null,
        projectTitle: null,
        assigneeId: "emp-1",
        assigneeName: "John Doe",
        date: "2026-08-12",
        status: "done",
        report: { text: "done", updatedAt: null },
        assignedHours: 5,
        isOvertime: true,
        resolvesODH: true,
        compensatesWeeklyHours: false,
        createdBy: "admin",
        createdAt: null,
        updatedAt: null
      }
    ];
    const result = resolveODHAndPenalties(
      [],
      tasks,
      employeePaid,
      mockSettings,
      initialOdhMap,
      {},
      "2026-08"
    );
    expect(result.odhMap["2026-08-12"]).toBe(0);
    expect(result.odhMap["2026-08-10"]).toBe(0);
    expect(result.odhMap["2026-08-05"]).toBe(60);
    expect(result.totalResolvedODHMinutes).toBe(300);
  });
  it("should resolve late/absent ODH penalty chip for Unpaid Intern without salary deduction (\xA74)", () => {
    const initialOdhMap = {
      "2026-08-12": 180
    };
    const initialPenaltyMap = {
      "2026-08-12": [
        {
          type: "intern_late_odh",
          label: "+3h Late ODH",
          tooltip: "Late ODH penalty",
          color: "#f97316",
          bgcolor: "#f9731620"
        }
      ]
    };
    const tasks = [
      {
        id: "task-3",
        title: "Intern task",
        description: "",
        projectId: null,
        projectTitle: null,
        assigneeId: "int-1",
        assigneeName: "Intern One",
        date: "2026-08-12",
        status: "done",
        report: { text: "done", updatedAt: null },
        assignedHours: 3,
        isOvertime: true,
        resolvesODH: true,
        compensatesWeeklyHours: true,
        createdBy: "admin",
        createdAt: null,
        updatedAt: null
      }
    ];
    const result = resolveODHAndPenalties(
      [],
      tasks,
      internUnpaid,
      mockSettings,
      initialOdhMap,
      initialPenaltyMap,
      "2026-08"
    );
    expect(result.odhMap["2026-08-12"]).toBe(0);
    expect(result.clearedDeductionDays).toBe(0);
    const chips = result.penaltyMap["2026-08-12"];
    expect(chips.length).toBe(2);
    expect(chips[1].label).toBe("ODH Resolved (Task Cleared)");
    expect(chips[1].isClearingChip).toBe(true);
  });
  it("should skip absence day by default unless Compensatory Task = true (\xA74)", () => {
    const records = [
      {
        id: "rec-abs",
        uid: "emp-1",
        employeeName: "John Doe",
        date: "2026-08-10",
        status: "absent",
        checkIn: "",
        checkOut: "",
        hoursWorked: 0
      }
    ];
    const initialPenaltyMap = {
      "2026-08-10": [
        {
          type: "absent",
          label: "-1d Salary",
          tooltip: "Absent day deduction",
          color: "#ef4444",
          bgcolor: "#ef444420"
        }
      ]
    };
    const taskWithoutComp = {
      id: "t-skip",
      title: "ODH only",
      description: "",
      projectId: null,
      projectTitle: null,
      assigneeId: "emp-1",
      assigneeName: "John Doe",
      date: "2026-08-12",
      status: "done",
      report: { text: "done", updatedAt: null },
      assignedHours: 8,
      isOvertime: true,
      resolvesODH: true,
      compensatesWeeklyHours: false,
      createdBy: "admin",
      createdAt: null,
      updatedAt: null
    };
    const resSkip = resolveODHAndPenalties(
      records,
      [taskWithoutComp],
      employeePaid,
      mockSettings,
      {},
      initialPenaltyMap,
      "2026-08"
    );
    expect(resSkip.clearedDeductionDays).toBe(0);
    expect(resSkip.penaltyMap["2026-08-10"].length).toBe(1);
    const taskWithComp = {
      ...taskWithoutComp,
      id: "t-comp",
      compensatesWeeklyHours: true
    };
    const resComp = resolveODHAndPenalties(
      records,
      [taskWithComp],
      employeePaid,
      mockSettings,
      {},
      initialPenaltyMap,
      "2026-08"
    );
    expect(resComp.clearedDeductionDays).toBe(0);
    const taskOnAbsentDay = {
      ...taskWithComp,
      id: "t-abs-day",
      date: "2026-08-10"
    };
    const resOnDay = resolveODHAndPenalties(
      records,
      [taskOnAbsentDay],
      employeePaid,
      mockSettings,
      {},
      initialPenaltyMap,
      "2026-08"
    );
    expect(resOnDay.clearedDeductionDays).toBe(1);
    expect(resOnDay.penaltyMap["2026-08-10"].length).toBe(2);
    expect(resOnDay.penaltyMap["2026-08-10"][1].label).toBe("+1.0d Salary (Task Cleared)");
  });
  it("should absorb ODH across multiple days in the same week (5h Friday + 1h Thursday) when task hours exceed same-day ODH", () => {
    const initialOdhMap = {
      "2026-08-14": 300,
      // 5 hours ODH on Friday
      "2026-08-13": 196
      // 3h 16m ODH on Thursday
    };
    const initialPenaltyMap = {
      "2026-08-14": [
        {
          type: "late",
          label: "Late",
          tooltip: "Late arrival",
          color: "#f59e0b",
          bgcolor: "#f59e0b20"
        }
      ]
    };
    const task6h = {
      id: "t-6h",
      title: "Salary deduction and odh",
      description: "",
      projectId: null,
      projectTitle: null,
      assigneeId: "emp-1",
      assigneeName: "Employee One",
      date: "2026-08-14",
      status: "done",
      report: { text: "done", updatedAt: null },
      assignedHours: 6,
      isOvertime: true,
      resolvesODH: false,
      compensatesWeeklyHours: true,
      createdBy: "admin",
      createdAt: null,
      updatedAt: null
    };
    const result = resolveODHAndPenalties(
      [],
      [task6h],
      employeePaid,
      mockSettings,
      initialOdhMap,
      initialPenaltyMap,
      "2026-08"
    );
    expect(result.odhMap["2026-08-14"]).toBe(0);
    expect(result.odhMap["2026-08-13"]).toBe(136);
    expect(result.totalResolvedODHMinutes).toBe(360);
    expect(result.clearedDeductionDays).toBe(0.5);
    expect(result.penaltyMap["2026-08-14"].length).toBe(2);
    expect(result.penaltyMap["2026-08-14"][1].label).toBe("+0.5d Salary (Task Cleared)");
  });
  it("should only clear 1 late day (3h) and absorb remaining 1h into 1 single earlier date when an Unpaid Intern with 2 late days is assigned a 4h Compensatory + ODH task", () => {
    const initialOdhMap = {
      "2026-08-19": 120,
      // 2 hours ODH on Wed 19 Aug
      "2026-08-14": 180
      // 3 hours ODH on Fri 14 Aug
    };
    const initialPenaltyMap = {
      "2026-08-26": [
        {
          type: "intern_late_odh",
          label: "+3h Late ODH",
          tooltip: "Late Penalty Overtime Due",
          color: "#a855f7",
          bgcolor: "#a855f722",
          minutes: 180
        }
      ],
      "2026-08-25": [
        {
          type: "intern_late_odh",
          label: "+3h Late ODH",
          tooltip: "Late Penalty Overtime Due",
          color: "#a855f7",
          bgcolor: "#a855f722",
          minutes: 180
        }
      ]
    };
    const intern4hTask = {
      id: "t-4h-intern",
      title: "4h OT task",
      description: "",
      projectId: null,
      projectTitle: null,
      assigneeId: "int-1",
      assigneeName: "Intern John",
      date: "2026-08-26",
      status: "done",
      report: { text: "done", updatedAt: null },
      assignedHours: 4,
      // 4 hours = 240 minutes
      isOvertime: true,
      resolvesODH: true,
      compensatesWeeklyHours: true,
      createdBy: "admin",
      createdAt: null,
      updatedAt: null
    };
    const resIntern = resolveODHAndPenalties(
      [],
      [intern4hTask],
      internUnpaid,
      mockSettings,
      initialOdhMap,
      initialPenaltyMap,
      "2026-08"
    );
    expect(resIntern.penaltyMap["2026-08-26"].length).toBe(2);
    expect(resIntern.penaltyMap["2026-08-26"][1].label).toBe("ODH Resolved (Task Cleared)");
    expect(resIntern.odhMap["2026-08-25"]).toBe(120);
    expect(resIntern.penaltyMap["2026-08-25"].length).toBe(2);
    expect(resIntern.penaltyMap["2026-08-25"][1].label).toBe("+1h 0m OT (2026-08-26 Task)");
    expect(resIntern.odhMap["2026-08-19"]).toBe(120);
    const intern2hTask = {
      ...intern4hTask,
      id: "t-2h-intern",
      title: "2h OT task",
      date: "2026-08-27",
      assignedHours: 2
      // 120 mins
    };
    const resFollowUp = resolveODHAndPenalties(
      [],
      [intern2hTask],
      internUnpaid,
      mockSettings,
      resIntern.odhMap,
      resIntern.penaltyMap,
      "2026-08"
    );
    expect(resFollowUp.odhMap["2026-08-25"]).toBe(0);
    expect(resFollowUp.penaltyMap["2026-08-25"].length).toBe(4);
    expect(resFollowUp.penaltyMap["2026-08-25"][2].label).toBe("ODH Resolved (Task Cleared)");
    expect(resFollowUp.penaltyMap["2026-08-25"][3].label).toBe("+2h 0m OT (2026-08-27 Task)");
  });
});

// test/integration/odh-penalty-flow.test.ts
var integrationSettings = {
  id: "default",
  officeStartTime: "10:00",
  officeEndTime: "18:00",
  graceMinutes: 60,
  flexibilityHours: 3,
  lateThresholdDays: 3,
  employeeLeavesPerMonth: 2,
  internLeavesPerMonth: 2,
  weeklyHoursRequired: 40,
  internWeeklyHoursRequired: 30
};
var employeePaid2 = {
  id: "emp-flow",
  accessLevel: "employee",
  monthlySalary: 6e3,
  officeHours: 40
  // 8h per day -> 480 mins
};
describe("Integration Testing: ODH + Compensatory Penalty-Clearing Flow", () => {
  it("should execute full multi-day ODH absorption and audit-trail chip clearing across week and absence days", () => {
    const records = [
      {
        id: "rec-abs-10",
        uid: "emp-flow",
        employeeName: "Alice Smith",
        date: "2026-08-10",
        status: "absent",
        checkIn: "",
        checkOut: "",
        hoursWorked: 0
      },
      {
        id: "rec-late-12",
        uid: "emp-flow",
        employeeName: "Alice Smith",
        date: "2026-08-12",
        status: "present",
        checkIn: "14:00",
        checkOut: "17:00",
        hoursWorked: 3,
        flexibilityUsed: 0,
        isLate: true,
        lateMinutes: 180
      }
    ];
    const initialOdhMap = {
      "2026-08-12": 300
      // 5 hours ODH shortfall on Aug 12
    };
    const initialPenaltyMap = {
      "2026-08-10": [
        {
          type: "absent",
          label: "-1d Salary",
          tooltip: "Absent day deduction",
          color: "#ef4444",
          bgcolor: "#ef444420"
        }
      ],
      "2026-08-12": [
        {
          type: "late",
          label: "-0.5d Salary",
          tooltip: "Late arrival salary deduction",
          color: "#ef4444",
          bgcolor: "#ef444420"
        }
      ]
    };
    const tasks = [
      {
        id: "task-integ-1",
        title: "Major System Release & Comp Work",
        description: "",
        projectId: null,
        projectTitle: null,
        assigneeId: "emp-flow",
        assigneeName: "Alice Smith",
        date: "2026-08-12",
        status: "done",
        report: { text: "Completed release", updatedAt: null },
        assignedHours: 5,
        // 5 hours = 300 minutes
        isOvertime: true,
        resolvesODH: true,
        compensatesWeeklyHours: true,
        // BOTH ON
        createdBy: "admin",
        createdAt: null,
        updatedAt: null
      },
      {
        id: "task-integ-2",
        title: "Absence make-up task",
        description: "",
        projectId: null,
        projectTitle: null,
        assigneeId: "emp-flow",
        assigneeName: "Alice Smith",
        date: "2026-08-10",
        // Assigned exactly on absence date (d === taskDate)
        status: "done",
        report: { text: "Make up work", updatedAt: null },
        assignedHours: 8,
        // 8 hours = 480 minutes
        isOvertime: true,
        resolvesODH: true,
        compensatesWeeklyHours: true,
        // BOTH ON
        createdBy: "admin",
        createdAt: null,
        updatedAt: null
      }
    ];
    const result = resolveODHAndPenalties(
      records,
      tasks,
      employeePaid2,
      integrationSettings,
      initialOdhMap,
      initialPenaltyMap,
      "2026-08"
    );
    expect(result.odhMap["2026-08-12"]).toBe(0);
    expect(result.odhMap["2026-08-10"]).toBe(0);
    expect(result.totalResolvedODHMinutes).toBe(780);
    const aug12Chips = result.penaltyMap["2026-08-12"];
    expect(aug12Chips.length).toBe(2);
    expect(aug12Chips[0].label).toBe("-0.5d Salary");
    expect(aug12Chips[1].label).toBe("+0.5d Salary (Task Cleared)");
    expect(aug12Chips[1].isClearingChip).toBe(true);
    const aug10Chips = result.penaltyMap["2026-08-10"];
    expect(aug10Chips.length).toBe(2);
    expect(aug10Chips[0].label).toBe("-1d Salary");
    expect(aug10Chips[1].label).toBe("+1.0d Salary (Task Cleared)");
    expect(aug10Chips[1].isClearingChip).toBe(true);
    expect(result.clearedDeductionDays).toBe(1.5);
  });
});

// src/lib/data/personal-tasks-utils.ts
function shouldNotifyTask(t, currentDayIndex, todayIso, currentTimeMinutes) {
  if (t.status !== "pending" || t.emailSent) return false;
  let isActiveToday = false;
  if (t.isRoutine && t.routineDays?.includes(currentDayIndex)) {
    isActiveToday = true;
  } else if (!t.isRoutine && t.targetDate === todayIso) {
    isActiveToday = true;
  }
  if (isActiveToday && t.targetTime) {
    const [h, m] = t.targetTime.split(":").map(Number);
    const targetMins = h * 60 + m;
    const diff = targetMins - currentTimeMinutes;
    if (diff >= 0 && diff <= t.notifyMinutesBefore) {
      return true;
    }
  }
  return false;
}

// test/personal-tasks.test.ts
var baseTask = {
  id: "task-1",
  uid: "user-1",
  title: "Test Task",
  priority: "High",
  category: "Work",
  status: "pending",
  isRoutine: false,
  targetDate: "2026-08-18",
  targetTime: "10:30",
  notifyMinutesBefore: 30,
  createdAt: null,
  updatedAt: null
};
describe("Personal Tasks: Unit & Integration Tests", () => {
  it("should return TRUE when time is exactly within the notification window", () => {
    const result = shouldNotifyTask(baseTask, 2, "2026-08-18", 600);
    expect(result).toBeTruthy();
  });
  it("should return FALSE when task is already marked as done", () => {
    const doneTask = { ...baseTask, status: "done" };
    const result = shouldNotifyTask(doneTask, 2, "2026-08-18", 600);
    expect(result).toBeFalsy();
  });
  it("should return FALSE when email has already been sent", () => {
    const emailedTask = { ...baseTask, emailSent: true };
    const result = shouldNotifyTask(emailedTask, 2, "2026-08-18", 600);
    expect(result).toBeFalsy();
  });
  it("should return FALSE if current time is before the notification window", () => {
    const result = shouldNotifyTask(baseTask, 2, "2026-08-18", 540);
    expect(result).toBeFalsy();
  });
  it("should return FALSE if current time is past the target time", () => {
    const result = shouldNotifyTask(baseTask, 2, "2026-08-18", 645);
    expect(result).toBeFalsy();
  });
  it("should return FALSE if the one-time task is scheduled for a different date", () => {
    const result = shouldNotifyTask(baseTask, 2, "2026-08-19", 600);
    expect(result).toBeFalsy();
  });
  it("should return TRUE for a routine task on a matching day", () => {
    const routineTask = {
      ...baseTask,
      isRoutine: true,
      routineDays: [1, 2, 3]
      // Mon, Tue, Wed
    };
    const result = shouldNotifyTask(routineTask, 2, "2026-08-18", 615);
    expect(result).toBeTruthy();
  });
  it("should return FALSE for a routine task on a non-matching day", () => {
    const routineTask = {
      ...baseTask,
      isRoutine: true,
      routineDays: [1, 3]
      // Mon, Wed
    };
    const result = shouldNotifyTask(routineTask, 2, "2026-08-18", 615);
    expect(result).toBeFalsy();
  });
  it("should handle custom notify minutes correctly", () => {
    const customTask = { ...baseTask, notifyMinutesBefore: 60 };
    const result = shouldNotifyTask(customTask, 2, "2026-08-18", 570);
    expect(result).toBeTruthy();
  });
});

// test/run-all.ts
runAllSuites().then((success) => {
  process.exit(success ? 0 : 1);
});
