import { AcademicPeriod, TeacherScheduleSlot } from '../../core/models';

export interface CalendarDay {
  date: string;
  dayNumber: number;
  isToday: boolean;
  inPeriod: boolean;
  slots: TeacherScheduleSlot[];
}

export function slotsForDate(date: string, period: AcademicPeriod, slots: TeacherScheduleSlot[]): TeacherScheduleSlot[] {
  if (date < period.startDate.slice(0, 10) || date > period.endDate.slice(0, 10)) return [];
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
  return slots.filter((slot) => slot.weekday === weekday).sort((a, b) => a.startMinute - b.startMinute);
}

export function calendarDays(month: string, period: AcademicPeriod, slots: TeacherScheduleSlot[], todayDate: string): (CalendarDay | null)[] {
  const [year, monthNumber] = month.split('-').map(Number);
  const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1));
  const leadingBlanks = (firstDay.getUTCDay() + 6) % 7;
  const dayCount = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const cells: (CalendarDay | null)[] = Array.from({ length: leadingBlanks }, () => null);
  for (let day = 1; day <= dayCount; day++) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    cells.push({
      date,
      dayNumber: day,
      isToday: date === todayDate,
      inPeriod: date >= period.startDate.slice(0, 10) && date <= period.endDate.slice(0, 10),
      slots: slotsForDate(date, period, slots),
    });
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function shiftMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));
}

export function dateLabel(date: string): string {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}
