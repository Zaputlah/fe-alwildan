export interface ScoreImportStudent { id: string; nis: string }
export interface ImportedScore { studentId: string; value: number; notes: string }

function csvRows(content: string): string[][] {
  const source = content.replace(/^\uFEFF/, '');
  const header = source.split(/\r?\n/, 1)[0];
  const delimiter = (header.match(/;/g)?.length ?? 0) > (header.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') { field += '"'; index++; }
      else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(field); field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[index + 1] === '\n') index++;
      row.push(field); field = '';
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error('Format CSV tidak valid: tanda kutip belum ditutup.');
  row.push(field);
  if (row.some((item) => item.trim())) rows.push(row);
  return rows;
}

export function parseScoreImport(content: string, students: ScoreImportStudent[], maxScore: number): ImportedScore[] {
  const rows = csvRows(content);
  const headers = rows.shift()?.map((item) => item.trim().toLowerCase()) ?? [];
  const nisColumn = headers.indexOf('nis');
  const valueColumn = headers.indexOf('nilai');
  const notesColumn = headers.indexOf('catatan');
  if (nisColumn < 0 || valueColumn < 0) throw new Error('CSV harus memiliki kolom nis dan nilai.');
  if (!rows.length) throw new Error('CSV belum berisi nilai siswa.');
  if (rows.length > 100) throw new Error('Maksimal 100 siswa per impor.');
  const studentByNis = new Map(students.map((student) => [student.nis, student]));
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const nis = row[nisColumn]?.trim() ?? '';
    const student = studentByNis.get(nis);
    if (!student) throw new Error(`Baris ${index + 2}: NIS ${nis || '(kosong)'} tidak ada pada assessment ini.`);
    if (seen.has(nis)) throw new Error(`Baris ${index + 2}: NIS ${nis} tercantum lebih dari sekali.`);
    seen.add(nis);
    const rawValue = row[valueColumn]?.trim() ?? '';
    const value = rawValue ? Number(rawValue.replace(',', '.')) : NaN;
    if (!Number.isFinite(value) || value < 0 || value > maxScore) {
      throw new Error(`Baris ${index + 2}: nilai NIS ${nis} harus antara 0 dan ${maxScore}.`);
    }
    const notes = notesColumn >= 0 ? row[notesColumn]?.trim() ?? '' : '';
    if (notes.length > 300) throw new Error(`Baris ${index + 2}: catatan maksimal 300 karakter.`);
    return { studentId: student.id, value, notes };
  });
}

export function scoreTemplateCsv(students: ScoreImportStudent[]): string {
  return '\uFEFFnis,nilai,catatan\r\n' + students.map((student) => `${student.nis},,`).join('\r\n') + '\r\n';
}
