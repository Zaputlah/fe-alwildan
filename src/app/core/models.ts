export type UserRole = 'ADMIN' | 'TEACHER';

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  schoolUnit: { id: string; name: string; code?: string };
}

export interface AuthResponse {
  user: CurrentUser;
  csrfToken: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  gradeLevel: number;
  academicYear: string;
  homeroomTeacherId?: string | null;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  passingGrade: number;
}

export interface AcademicPeriod {
  id: string;
  name: string;
  semester: 'GANJIL' | 'GENAP';
  isActive: boolean;
  startDate: string;
  endDate: string;
}

export interface ReferenceData {
  classes: SchoolClass[];
  subjects: Subject[];
  periods: AcademicPeriod[];
  teachers: { id: string; fullName: string; email: string }[];
  teachingAssignments: {
    id: string;
    teacherId: string;
    classId: string;
    subjectId: string;
    academicPeriodId: string;
    teacher: { fullName: string };
    class: { name: string };
    subject: { name: string };
  }[];
  access: {
    manageablePairs: { classId: string; subjectId: string; academicPeriodId: string }[];
    homeroomClassIds: string[];
  };
}

export interface TeacherScheduleSlot {
  id: string;
  teachingAssignmentId: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  room: string | null;
  teachingAssignment: {
    teacherId: string;
    academicPeriodId: string;
    teacher: { fullName: string };
    class: { id: string; name: string };
    subject: { name: string };
  };
}

export interface TeacherScheduleResponse {
  period: AcademicPeriod | null;
  periods: AcademicPeriod[];
  timezone: string;
  todayDate: string;
  todayWeekday: number;
  slots: TeacherScheduleSlot[];
}

export interface Student {
  id: string;
  nis: string;
  fullName: string;
  isActive: boolean;
  deactivationReason: string | null;
  deactivatedAt: string | null;
  gender: 'MALE' | 'FEMALE';
  birthDate: string | null;
  parentName: string | null;
  parentPhone: string | null;
  enrollments: { class: SchoolClass; academicPeriod: AcademicPeriod; academicPeriodId: string }[];
}

export interface Assessment {
  id: string;
  title: string;
  type: 'ASSIGNMENT' | 'QUIZ' | 'MIDTERM' | 'FINAL' | 'PRACTICE' | 'PROJECT';
  weight: number;
  maxScore: number;
  status: 'DRAFT' | 'PUBLISHED';
  scheduledAt: string | null;
  schoolClass: SchoolClass;
  academicPeriodId: string;
  subject: Subject;
  teacher: { id: string; fullName: string };
  _count: { scores: number };
  studentCount: number;
}

export type TeacherAttendanceStatus = 'PRESENT' | 'LATE' | 'SICK' | 'LEAVE' | 'DUTY' | 'ABSENT';

export interface TeacherAttendanceRecord {
  id: string;
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  isEarlyCheckout: boolean;
  checkInLatitude: number | null;
  checkInLongitude: number | null;
  checkInAccuracyMeters: number | null;
  checkOutLatitude: number | null;
  checkOutLongitude: number | null;
  checkOutAccuracyMeters: number | null;
  status: TeacherAttendanceStatus;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  notes: string | null;
  remarks: string[];
  evidence: { id: string; fileName: string; mimeType: string; size: number; uploadedAt: string } | null;
  teacherId: string;
  teacher?: { id: string; fullName: string; email: string };
}

export interface TeacherAttendanceResponse {
  records: TeacherAttendanceRecord[];
  summary: Record<TeacherAttendanceStatus, number> & { pending: number; rejected: number; earlyCheckout: number; total: number };
  today: TeacherAttendanceRecord | null;
  month: string;
  timezone: string;
  lateAfter: string;
  earlyCheckoutBefore: string;
}

export type StudentAttendanceStatus = 'PRESENT' | 'LATE' | 'SICK' | 'LEAVE' | 'ABSENT';

export interface StudentAttendanceResponse {
  schoolClass: { id: string; name: string; academicYear: string; homeroomTeacherId: string | null };
  period: AcademicPeriod;
  isHomeroom: boolean;
  canEdit: boolean;
  todayDate: string;
  timezone: string;
  month: string;
  students: { id: string; nis: string; fullName: string }[];
  records: { id: string; studentId: string; date: string; status: StudentAttendanceStatus; lateArrivalAt: string | null; notes: string | null }[];
}

export type StudentBehaviorRating = 'EXCELLENT' | 'GOOD' | 'NEEDS_ATTENTION';

export interface StudentBehaviorResponse {
  schoolClass: { id: string; name: string; academicYear: string; homeroomTeacherId: string | null };
  period: AcademicPeriod;
  isHomeroom: boolean;
  todayDate: string;
  month: string;
  students: { id: string; nis: string; fullName: string }[];
  records: { id: string; studentId: string; date: string; rating: StudentBehaviorRating; notes: string; recordedById: string; recordedBy: { fullName: string } }[];
}
