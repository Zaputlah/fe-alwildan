import { describe, expect, it } from 'vitest';
import { AcademicPeriod, TeacherScheduleSlot } from '../../core/models';
import { calendarDays, shiftMonth, slotsForDate } from './calendar';

const period: AcademicPeriod = {
  id: 'period-1', name: '2026/2027', semester: 'GANJIL', isActive: true,
  startDate: '2026-07-13T00:00:00.000Z', endDate: '2026-12-18T23:59:59.000Z',
};
const mondaySlot = { id: 'slot-1', weekday: 1, startMinute: 480 } as TeacherScheduleSlot;

describe('teacher schedule calendar', () => {
  it('places dates in Monday-first columns and repeats a weekly slot on matching dates', () => {
    const cells = calendarDays('2026-09', period, [mondaySlot], '2026-09-14');
    expect(cells[0]).toBeNull();
    expect(cells[1]?.date).toBe('2026-09-01');
    expect(cells.find((cell) => cell?.date === '2026-09-14')?.slots).toEqual([mondaySlot]);
    expect(cells.find((cell) => cell?.date === '2026-09-14')?.isToday).toBe(true);
  });

  it('does not create lessons outside the selected semester', () => {
    expect(slotsForDate('2026-12-21', period, [mondaySlot])).toEqual([]);
    expect(slotsForDate('2026-12-14', period, [mondaySlot])).toEqual([mondaySlot]);
  });

  it('moves between years without using the browser timezone', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
  });
});
