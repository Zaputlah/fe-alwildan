import { describe, expect, it } from 'vitest';
import { StudentAttendanceResponse } from '../../core/models';
import { attendanceHistoryDays } from './attendance-history';

const students = [
  { id: 'one', nis: '720001', fullName: 'Aulia Zahra' },
  { id: 'two', nis: '720002', fullName: 'Bintang Ramadhan' },
];
const records = [
  { id: 'older', studentId: 'one', date: '2026-09-17T00:00:00.000Z', status: 'PRESENT', notes: null, lateArrivalAt: null },
  { id: 'late', studentId: 'one', date: '2026-09-18T00:00:00.000Z', status: 'LATE', notes: null, lateArrivalAt: '2026-09-18T02:00:00.000Z' },
  { id: 'absent', studentId: 'two', date: '2026-09-18T00:00:00.000Z', status: 'ABSENT', notes: 'Belum datang', lateArrivalAt: null },
] satisfies StudentAttendanceResponse['records'];

describe('attendance history', () => {
  it('groups records by date with newest day first and per-status totals', () => {
    const days = attendanceHistoryDays(records, students, '', '');
    expect(days.map((day) => day.date)).toEqual(['2026-09-18', '2026-09-17']);
    expect(days[0].counts.LATE).toBe(1);
    expect(days[0].counts.ABSENT).toBe(1);
    expect(days[0].entries.map((entry) => entry.studentName)).toEqual(['Aulia Zahra', 'Bintang Ramadhan']);
  });

  it('filters by status and student name or NIS before calculating daily counts', () => {
    expect(attendanceHistoryDays(records, students, 'ABSENT', '').map((day) => day.entries.length)).toEqual([1]);
    expect(attendanceHistoryDays(records, students, '', '720001').map((day) => day.entries.length)).toEqual([1, 1]);
    expect(attendanceHistoryDays(records, students, 'LATE', 'bintang')).toEqual([]);
  });
});
