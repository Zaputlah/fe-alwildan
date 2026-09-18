import { describe, expect, it } from 'vitest';
import { parseScoreImport, scoreTemplateCsv } from './score-import';

const students = [{ id: 's1', nis: '710001' }, { id: 's2', nis: '710002' }];

describe('score CSV import', () => {
  it('matches NIS and reads comma-separated values', () => {
    expect(parseScoreImport('nis,nilai,catatan\n710001,85,"Bagus, rapi"', students, 100)).toEqual([{ studentId: 's1', value: 85, notes: 'Bagus, rapi' }]);
  });

  it('supports semicolon CSV and decimal comma from spreadsheet exports', () => {
    expect(parseScoreImport('nis;nilai;catatan\r\n710002;87,5;Ujian', students, 100)).toEqual([{ studentId: 's2', value: 87.5, notes: 'Ujian' }]);
  });

  it('rejects unknown, duplicate, and out-of-range scores', () => {
    expect(() => parseScoreImport('nis,nilai\n999999,80', students, 100)).toThrow('tidak ada');
    expect(() => parseScoreImport('nis,nilai\n710001,80\n710001,90', students, 100)).toThrow('lebih dari sekali');
    expect(() => parseScoreImport('nis,nilai\n710001,101', students, 100)).toThrow('antara 0 dan 100');
  });

  it('builds a blank template for the current assessment roster', () => {
    expect(scoreTemplateCsv(students)).toContain('710001,,');
    expect(scoreTemplateCsv(students)).toContain('710002,,');
  });
});
