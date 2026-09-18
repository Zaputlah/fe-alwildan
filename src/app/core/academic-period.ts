import { AcademicPeriod } from './models';

export function academicPeriodLabel(period: AcademicPeriod): string {
  const semester = period.semester === 'GANJIL' ? 'Ganjil' : 'Genap';
  return `Semester ${semester} · ${period.name}`;
}

export function currentAcademicPeriod(periods: AcademicPeriod[], now = new Date()): AcademicPeriod | undefined {
  return periods.find((period) => new Date(period.startDate) <= now && now <= new Date(period.endDate))
    ?? periods.find((period) => period.isActive);
}
