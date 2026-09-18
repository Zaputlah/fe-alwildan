import { describe, expect, it } from 'vitest';
import { StudentAttendanceResponse } from '../../core/models';
import { canMarkStudentLate, pendingAttendanceEntries } from './attendance-entry';

const date = '2026-09-18';
const data = {
  students: [
    { id: 'student-1', nis: '720001', fullName: 'Siswa Satu' },
    { id: 'student-2', nis: '720002', fullName: 'Siswa Dua' },
  ],
  records: [{ id: 'record-1', studentId: 'student-1', date: `${date}T00:00:00.000Z`, status: 'ABSENT', notes: 'Belum datang', lateArrivalAt: null }],
} satisfies Pick<StudentAttendanceResponse, 'students' | 'records'>;

describe('student attendance entry', () => {
  it('locks an existing teacher entry even if its status or notes are changed', () => {
    expect(pendingAttendanceEntries(data, date, 'TEACHER', { 'student-1': 'LATE' }, { 'student-1': 'Diubah' })).toEqual([]);
  });

  it('keeps the save button actionable for an unrecorded student', () => {
    expect(pendingAttendanceEntries(data, date, 'TEACHER', { 'student-1': 'ABSENT', 'student-2': 'PRESENT' }, {})).toEqual([
      { studentId: 'student-2', status: 'PRESENT', notes: null },
    ]);
  });

  it('allows admin corrections but ignores unchanged values', () => {
    expect(pendingAttendanceEntries(data, date, 'ADMIN', { 'student-1': 'ABSENT' }, { 'student-1': 'Belum datang' })).toEqual([]);
    expect(pendingAttendanceEntries(data, date, 'ADMIN', { 'student-1': 'LATE' }, {})).toEqual([
      { studentId: 'student-1', status: 'LATE', notes: null },
    ]);
  });

  it('offers late arrival only to a teacher for an absent student on the same day', () => {
    expect(canMarkStudentLate('ABSENT', date, date, 'TEACHER')).toBe(true);
    expect(canMarkStudentLate('PRESENT', date, date, 'TEACHER')).toBe(false);
    expect(canMarkStudentLate('ABSENT', '2026-09-17', date, 'TEACHER')).toBe(false);
  });
});
