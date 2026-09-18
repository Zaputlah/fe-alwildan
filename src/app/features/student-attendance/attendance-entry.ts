import { StudentAttendanceResponse, StudentAttendanceStatus, UserRole } from '../../core/models';

export interface AttendanceEntry { studentId: string; status: StudentAttendanceStatus; notes: string | null }

export function pendingAttendanceEntries(
  data: Pick<StudentAttendanceResponse, 'students' | 'records'>,
  selectedDate: string,
  role: UserRole,
  statuses: Record<string, StudentAttendanceStatus | ''>,
  notes: Record<string, string>,
): AttendanceEntry[] {
  const existing = new Map(data.records.filter((item) => item.date.slice(0, 10) === selectedDate).map((item) => [item.studentId, item]));
  return data.students.flatMap((student) => {
    const status = statuses[student.id];
    if (!status) return [];
    const note = notes[student.id]?.trim() || null;
    const saved = existing.get(student.id);
    if (role === 'TEACHER' && saved) return [];
    if (saved && saved.status === status && (saved.notes || null) === note) return [];
    return [{ studentId: student.id, status, notes: note }];
  });
}

export function canMarkStudentLate(status: StudentAttendanceStatus, selectedDate: string, todayDate: string, role: UserRole): boolean {
  return role === 'TEACHER' && status === 'ABSENT' && selectedDate === todayDate;
}
