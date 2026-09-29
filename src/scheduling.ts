import type { DayOfWeek, DoctorSchedule } from "./types.js";

export const DAYS: readonly DayOfWeek[] = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];
export const SLOT_DURATIONS = [15, 30, 45, 60] as const;

export function timeToMinutes(value: string): number | undefined {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : undefined;
}

export function generateTimeSlots(
  timeFrom: string,
  timeTo: string,
  duration: number,
): string[] {
  const start = timeToMinutes(timeFrom);
  const end = timeToMinutes(timeTo);
  if (start === undefined || end === undefined || start >= end || duration <= 0)
    return [];
  const slots: string[] = [];
  for (let minute = start; minute + duration <= end; minute += duration) {
    slots.push(`${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`);
  }
  return slots;
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function dayForDate(value: string): DayOfWeek | undefined {
  if (!isValidDate(value)) return undefined;
  const sundayFirst = new Date(`${value}T00:00:00.000Z`).getUTCDay();
  return DAYS[(sundayFirst + 6) % 7];
}

export function getAvailableDates(
  schedule: DoctorSchedule,
  fromDate: string,
  days = 90,
): string[] {
  if (!isValidDate(fromDate)) return [];
  const result: string[] = [];
  const start = new Date(`${fromDate}T00:00:00.000Z`);
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + offset);
    const iso = date.toISOString().slice(0, 10);
    if (schedule.availableDays.includes(dayForDate(iso)!)) result.push(iso);
  }
  return result;
}

export function validateSchedule(value: unknown): string[] {
  if (typeof value !== "object" || value === null) return ["schedule must be an object"];
  const schedule = value as Record<string, unknown>;
  const issues: string[] = [];
  if (!Array.isArray(schedule.availableDays) || schedule.availableDays.length === 0 ||
      schedule.availableDays.some((day) => typeof day !== "string" || !DAYS.includes(day as DayOfWeek))) {
    issues.push("availableDays must contain one or more valid weekdays");
  }
  const from = typeof schedule.timeFrom === "string" ? timeToMinutes(schedule.timeFrom) : undefined;
  const to = typeof schedule.timeTo === "string" ? timeToMinutes(schedule.timeTo) : undefined;
  if (from === undefined) issues.push("timeFrom must use 24-hour HH:mm format");
  if (to === undefined) issues.push("timeTo must use 24-hour HH:mm format");
  if (from !== undefined && to !== undefined && from >= to) issues.push("timeFrom must be earlier than timeTo");
  if (!SLOT_DURATIONS.includes(schedule.slotDuration as (typeof SLOT_DURATIONS)[number])) {
    issues.push("slotDuration must be 15, 30, 45, or 60 minutes");
  }
  return issues;
}
