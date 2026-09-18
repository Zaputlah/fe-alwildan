import { describe, expect, it } from 'vitest';
import { schoolGreeting } from './school-greeting';

describe('sapaan waktu sekolah', () => {
  const timezone = 'Asia/Jakarta';

  it('menggunakan zona waktu sekolah, bukan zona waktu browser', () => {
    expect(schoolGreeting(new Date('2026-09-17T01:00:00.000Z'), timezone)).toBe('pagi');
    expect(schoolGreeting(new Date('2026-09-17T05:00:00.000Z'), timezone)).toBe('siang');
    expect(schoolGreeting(new Date('2026-09-17T09:00:00.000Z'), timezone)).toBe('sore');
    expect(schoolGreeting(new Date('2026-09-17T13:00:00.000Z'), timezone)).toBe('malam');
  });
});
