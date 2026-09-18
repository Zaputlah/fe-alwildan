import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { academicPeriodLabel, currentAcademicPeriod } from '../../core/academic-period';
import { AuthService } from '../../core/auth.service';
import { ReferenceData, SchoolClass, StudentBehaviorRating, StudentBehaviorResponse } from '../../core/models';
import { errorMessage } from '../../core/security.interceptor';

const ratings: { value: StudentBehaviorRating; label: string }[] = [
  { value: 'EXCELLENT', label: 'Sangat baik' },
  { value: 'GOOD', label: 'Baik' },
  { value: 'NEEDS_ATTENTION', label: 'Perlu perhatian' },
];

@Component({
  selector: 'app-student-behavior',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="assessment-section-intro"><h2>Catatan perilaku siswa</h2><p>Catat pengamatan perilaku siswa sesuai kelas yang Anda ampu. Wali kelas dapat melihat catatan semua guru di kelas walinya.</p></div>
    @if (message()) { <div class="alert alert--success">{{ message() }}</div> }
    @if (error()) { <div class="alert alert--error">{{ error() }}</div> }
    <section class="panel student-attendance-filters">
      <label>Semester<select [value]="periodId()" (change)="changePeriod($event)">@for (period of references()?.periods ?? []; track period.id) { <option [value]="period.id">{{ periodLabel(period) }}</option> }</select></label>
      <label>Kelas<select [value]="classId()" (change)="changeClass($event)">@for (schoolClass of visibleClasses(); track schoolClass.id) { <option [value]="schoolClass.id">Kelas {{ schoolClass.name }}</option> } @empty { <option value="">Belum ada kelas</option> }</select></label>
      <label>Bulan<input type="month" [value]="month()" (change)="changeMonth($event)"></label>
    </section>
    @if (loading()) { <div class="loading-card">Memuat catatan perilaku...</div> }
    @else if (data(); as result) {
      <div class="teacher-assessment-notice">{{ result.isHomeroom ? 'Kelas wali: Anda dapat memantau catatan perilaku dari seluruh guru.' : auth.user()?.role === 'ADMIN' ? 'Admin dapat melihat catatan semua guru.' : 'Anda melihat catatan yang Anda buat untuk kelas yang diajar.' }}</div>
      <section class="panel behavior-editor">
        <div class="teacher-assessment-list-header"><div><h2>Input perilaku</h2><p>Satu catatan per siswa, tanggal, dan guru. Menyimpan ulang akan memperbarui catatan Anda sendiri.</p></div></div>
        <div class="behavior-form-grid">
          <label>Tanggal<input type="date" [value]="selectedDate()" [min]="result.period.startDate.slice(0, 10)" [max]="result.period.endDate.slice(0, 10)" (change)="changeDate($event)"></label>
          <label>Siswa<select [value]="studentId()" (change)="changeStudent($event)">@for (student of result.students; track student.id) { <option [value]="student.id">{{ student.fullName }} · {{ student.nis }}</option> } @empty { <option value="">Belum ada siswa</option> }</select></label>
          <label>Penilaian<select [value]="rating()" (change)="rating.set(asRating(inputValue($event)))">@for (item of ratings; track item.value) { <option [value]="item.value">{{ item.label }}</option> }</select></label>
          <label class="behavior-notes">Catatan<textarea [value]="notes()" (input)="notes.set(inputValue($event))" maxlength="500" rows="3" placeholder="Jelaskan pengamatan secara objektif (minimal 5 karakter)"></textarea></label>
        </div>
        <div class="student-attendance-save"><button class="btn btn--primary" (click)="save()" [disabled]="saving() || !result.students.length">{{ saving() ? 'Menyimpan...' : 'Simpan catatan' }}</button></div>
      </section>
      <section class="panel student-attendance-table"><div class="teacher-assessment-list-header"><div><h2>Riwayat perilaku</h2><p>{{ result.records.length }} catatan pada {{ result.month }}</p></div></div><div class="table-scroll"><table><thead><tr><th>Tanggal</th><th>Siswa</th><th>Penilaian</th><th>Catatan</th><th>Dicatat oleh</th></tr></thead><tbody>
        @for (record of result.records; track record.id) { <tr><td>{{ record.date.slice(0, 10) }}</td><td><strong>{{ studentName(record.studentId) }}</strong></td><td>{{ ratingLabel(record.rating) }}</td><td class="reason-cell">{{ record.notes }}</td><td>{{ record.recordedBy.fullName }}</td></tr> }
        @empty { <tr><td colspan="5" class="empty-state">Belum ada catatan perilaku pada bulan ini.</td></tr> }
      </tbody></table></div></section>
    } @else if (references()) { <div class="loading-card">Belum ada kelas yang dapat dilihat pada semester ini.</div> }
  `,
})
export class StudentBehaviorComponent {
  private readonly http = inject(HttpClient);
  readonly auth = inject(AuthService);
  readonly references = signal<ReferenceData | null>(null);
  readonly data = signal<StudentBehaviorResponse | null>(null);
  readonly periodId = signal('');
  readonly classId = signal('');
  readonly month = signal('');
  readonly selectedDate = signal('');
  readonly studentId = signal('');
  readonly rating = signal<StudentBehaviorRating>('GOOD');
  readonly notes = signal('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly ratings = ratings;
  readonly periodLabel = academicPeriodLabel;

  constructor() {
    this.http.get<ReferenceData>('/api/v1/reference-data').subscribe({
      next: (references) => {
        this.references.set(references);
        const active = currentAcademicPeriod(references.periods);
        const chosen = [active, ...references.periods].find((period) => period && this.visibleClasses(period.id).length);
        this.periodId.set(chosen?.id ?? active?.id ?? references.periods[0]?.id ?? '');
        this.classId.set(this.visibleClasses()[0]?.id ?? '');
        this.load();
      },
      error: (error) => { this.error.set(errorMessage(error)); this.loading.set(false); },
    });
  }

  visibleClasses(periodId = this.periodId()): SchoolClass[] {
    const refs = this.references();
    const period = refs?.periods.find((item) => item.id === periodId);
    if (!refs || !period) return [];
    const classes = refs.classes.filter((item) => item.academicYear === period.name);
    if (this.auth.user()?.role === 'ADMIN') return classes;
    const homeroom = classes.filter((item) => refs.access.homeroomClassIds.includes(item.id));
    const assigned = new Set(refs.access.manageablePairs.filter((item) => item.academicPeriodId === periodId).map((item) => item.classId));
    return [...homeroom, ...classes.filter((item) => assigned.has(item.id) && !homeroom.some((own) => own.id === item.id))];
  }
  inputValue(event: Event) { return (event.target as HTMLInputElement).value; }
  asRating(value: string): StudentBehaviorRating { return value as StudentBehaviorRating; }
  changePeriod(event: Event) {
    this.periodId.set(this.inputValue(event));
    this.classId.set(this.visibleClasses()[0]?.id ?? '');
    this.month.set(this.references()?.periods.find((item) => item.id === this.periodId())?.startDate.slice(0, 7) ?? '');
    this.notes.set(''); this.rating.set('GOOD');
    this.load();
  }
  changeClass(event: Event) { this.classId.set(this.inputValue(event)); this.studentId.set(''); this.notes.set(''); this.rating.set('GOOD'); this.load(); }
  changeMonth(event: Event) { this.month.set(this.inputValue(event)); this.notes.set(''); this.rating.set('GOOD'); this.load(); }
  changeDate(event: Event) { this.selectedDate.set(this.inputValue(event)); this.syncOwnRecord(); }
  changeStudent(event: Event) { this.studentId.set(this.inputValue(event)); this.syncOwnRecord(); }
  studentName(id: string) { return this.data()?.students.find((student) => student.id === id)?.fullName ?? 'Siswa'; }
  ratingLabel(value: StudentBehaviorRating) { return ratings.find((item) => item.value === value)?.label ?? value; }
  private syncOwnRecord() {
    const own = this.data()?.records.find((item) => item.studentId === this.studentId() && item.date.slice(0, 10) === this.selectedDate() && item.recordedById === this.auth.user()?.id);
    this.rating.set(own?.rating ?? 'GOOD');
    this.notes.set(own?.notes ?? '');
  }

  load() {
    const classId = this.classId();
    const academicPeriodId = this.periodId();
    const requestedMonth = this.month();
    this.data.set(null); this.error.set('');
    if (!classId || !academicPeriodId) { this.loading.set(false); return; }
    this.loading.set(true);
    const params: Record<string, string> = { classId, academicPeriodId };
    if (requestedMonth) params['month'] = requestedMonth;
    this.http.get<StudentBehaviorResponse>('/api/v1/student-behavior', { params }).subscribe({
      next: (data) => {
        if (classId !== this.classId() || academicPeriodId !== this.periodId() || requestedMonth !== this.month()) return;
        this.data.set(data);
        this.month.set(data.month);
        this.studentId.set(data.students.some((student) => student.id === this.studentId()) ? this.studentId() : data.students[0]?.id ?? '');
        if (!this.selectedDate() || this.selectedDate().slice(0, 7) !== data.month) this.selectedDate.set(data.todayDate.slice(0, 7) === data.month ? data.todayDate : `${data.month}-01`);
        this.syncOwnRecord();
        this.loading.set(false);
      },
      error: (error) => {
        if (classId !== this.classId() || academicPeriodId !== this.periodId() || requestedMonth !== this.month()) return;
        this.error.set(errorMessage(error)); this.loading.set(false);
      },
    });
  }
  save() {
    const data = this.data();
    if (!data || this.saving()) return;
    if (!data.students.some((student) => student.id === this.studentId())) { this.error.set('Pilih siswa terlebih dahulu.'); return; }
    if (this.notes().trim().length < 5) { this.error.set('Catatan minimal 5 karakter.'); return; }
    this.error.set(''); this.saving.set(true);
    this.http.put('/api/v1/student-behavior/records', {
      classId: this.classId(), academicPeriodId: this.periodId(), studentId: this.studentId(),
      date: this.selectedDate(), rating: this.rating(), notes: this.notes().trim(),
    }).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => { this.message.set('Catatan perilaku berhasil disimpan.'); this.notes.set(''); this.month.set(this.selectedDate().slice(0, 7)); this.load(); },
      error: (error) => this.error.set(errorMessage(error)),
    });
  }
}
