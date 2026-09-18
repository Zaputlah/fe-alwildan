import { Assessment } from '../../core/models';

export interface AssessmentFilters {
  teacherId: string;
  academicPeriodId: string;
  classId: string;
  subjectId: string;
}

export function focusedSubjectId(subjectIds: string[], selectedId: string): string {
  return subjectIds.length === 1 ? subjectIds[0] : selectedId;
}

export function teacherAssessments(items: Assessment[], filters: AssessmentFilters): Assessment[] {
  return items.filter((item) =>
    item.teacher.id === filters.teacherId
    && item.academicPeriodId === filters.academicPeriodId
    && (!filters.classId || item.schoolClass.id === filters.classId)
    && (!filters.subjectId || item.subject.id === filters.subjectId));
}

export function assessmentSummary(items: Assessment[]) {
  return {
    total: items.length,
    missingScores: items.reduce((sum, item) => sum + Math.max(0, item.studentCount - item._count.scores), 0),
    drafts: items.filter((item) => item.status === 'DRAFT').length,
  };
}
