import { StudentAttendanceResponse, StudentAttendanceStatus } from '../../core/models';

export interface AttendanceHistoryDay {
  date: string;
  entries: { record: StudentAttendanceResponse['records'][number]; studentName: string; nis: string }[];
  counts: Record<StudentAttendanceStatus, number>;
}

export function attendanceHistoryDays(
  records: StudentAttendanceResponse['records'],
  students: StudentAttendanceResponse['students'],
  status: StudentAttendanceStatus | '',
  search: string,
): AttendanceHistoryDay[] {
  const studentById = new Map(students.map((student) => [student.id, student]));
  const query = search.trim().toLocaleLowerCase('id-ID');
  const byDate = new Map<string, AttendanceHistoryDay>();
  for (const record of records) {
    if (status && record.status !== status) continue;
    const student = studentById.get(record.studentId);
    if (!student) continue;
    if (query && !`${student.fullName} ${student.nis}`.toLocaleLowerCase('id-ID').includes(query)) continue;
    const date = record.date.slice(0, 10);
    let day = byDate.get(date);
    if (!day) {
      day = { date, entries: [], counts: { PRESENT: 0, LATE: 0, SICK: 0, LEAVE: 0, ABSENT: 0 } };
      byDate.set(date, day);
    }
    day.entries.push({ record, studentName: student.fullName, nis: student.nis });
    day.counts[record.status]++;
  }
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}
