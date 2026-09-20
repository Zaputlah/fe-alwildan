export const assessmentWeights: Record<string, number> = {
  ASSIGNMENT: 15,
  QUIZ: 7.5,
  PRACTICE: 11.25,
  PROJECT: 11.25,
  MIDTERM: 11.25,
  FINAL: 18.75,
};

export function weightForAssessment(type: string) {
  return assessmentWeights[type] ?? 0;
}
