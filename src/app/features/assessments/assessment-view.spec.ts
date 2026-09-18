import { describe, expect, it } from 'vitest';
import { Assessment } from '../../core/models';
import { assessmentSummary, focusedSubjectId, teacherAssessments } from './assessment-view';

const base = {
  academicPeriodId: 'semester-1', schoolClass: { id: '7a' }, subject: { id: 'math' },
  teacher: { id: 'teacher-1' }, _count: { scores: 28 }, studentCount: 30, status: 'DRAFT',
} as Assessment;

describe('teacher assessment view', () => {
  it('only shows assessments owned by the teacher in the selected class, subject and semester', () => {
    const items = [base, { ...base, teacher: { id: 'teacher-2' } }, { ...base, academicPeriodId: 'semester-2' }] as Assessment[];
    expect(teacherAssessments(items, { teacherId: 'teacher-1', academicPeriodId: 'semester-1', classId: '7a', subjectId: 'math' })).toEqual([base]);
  });

  it('counts missing student scores and drafts from visible assessments', () => {
    const items = [base, { ...base, _count: { scores: 24 }, status: 'PUBLISHED' }, { ...base, _count: { scores: 31 } }] as Assessment[];
    expect(assessmentSummary(items)).toEqual({ total: 3, missingScores: 8, drafts: 2 });
  });

  it('locks input nilai to the sole assigned subject', () => {
    expect(focusedSubjectId(['ipa'], '')).toBe('ipa');
    expect(focusedSubjectId(['ipa', 'mat'], '')).toBe('');
  });
});
