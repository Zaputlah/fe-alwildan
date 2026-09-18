import { describe, expect, it } from 'vitest';
import { academicPeriodLabel, currentAcademicPeriod } from './academic-period';
import { AcademicPeriod } from './models';

const periods: AcademicPeriod[] = [
  { id: 'sem-1', name: '2026/2027', semester: 'GANJIL', isActive: true, startDate: '2026-07-13T00:00:00.000Z', endDate: '2026-12-18T23:59:59.000Z' },
  { id: 'sem-2', name: '2026/2027', semester: 'GENAP', isActive: false, startDate: '2027-01-04T00:00:00.000Z', endDate: '2027-06-18T23:59:59.000Z' },
];

describe('periode semester ganjil dan genap', () => {
  it('menampilkan jenis semester dari database dan tahun ajaran', () => {
    expect(academicPeriodLabel(periods[0])).toBe('Semester Ganjil · 2026/2027');
    expect(academicPeriodLabel(periods[1])).toBe('Semester Genap · 2026/2027');
  });

  it('memilih semester berdasarkan tanggal sebelum status aktif manual', () => {
    expect(currentAcademicPeriod(periods, new Date('2027-02-10T00:00:00.000Z'))?.id).toBe('sem-2');
  });
});
