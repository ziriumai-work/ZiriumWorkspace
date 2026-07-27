/** Count working days in a month (Mon–Fri only). */
export function workingDaysInMonth(year: number, month: number): number {
  let count = 0;
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/** Calculate daily salary from monthly salary and working days. */
export function dailySalary(monthlySalary: number, year: number, month: number): number {
  const days = workingDaysInMonth(year, month);
  return days > 0 ? monthlySalary / days : 0;
}

/** Calculate hourly salary based on a standard workday (default 8 hours). */
export function hourlySalary(monthlySalary: number, year: number, month: number, hoursPerDay = 8): number {
  const daily = dailySalary(monthlySalary, year, month);
  return hoursPerDay > 0 ? daily / hoursPerDay : 0;
}

/** Calculate total cost of assigned overtime hours. */
export function overtimeCost(monthlySalary: number | undefined, hours: number, dateIso: string): number {
  if (!monthlySalary || !hours) return 0;
  
  const d = new Date(dateIso);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  
  const hourly = hourlySalary(monthlySalary, year, month);
  return hourly * hours;
}
