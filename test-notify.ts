import { shouldNotifyTask } from "./src/lib/data/personal-tasks-utils.ts";

const t = {
  id: "test",
  uid: "test",
  title: "hello",
  status: "pending",
  isRoutine: false,
  targetDate: "2026-08-18",
  targetTime: "12:30",
  notifyMinutesBefore: 3,
};

const now = new Date("2026-08-18T12:29:00+05:00");
const currentDayIndex = now.getDay();
const todayIso = now.toISOString().slice(0, 10);
const currentTime = now.getHours() * 60 + now.getMinutes();

console.log("currentTime:", currentTime);
console.log("todayIso:", todayIso);
console.log("shouldNotify:", shouldNotifyTask(t as any, currentDayIndex, todayIso, currentTime));
