import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { Assessment, ReferenceData } from '../../core/models';
import { errorMessage } from '../../core/security.interceptor';
import { academicPeriodLabel, currentAcademicPeriod } from '../../core/academic-period';
import { assessmentSummary, focusedSubjectId, teacherAssessments } from './assessment-view';
import { parseScoreImport, scoreTemplateCsv } from './score-import';
import { StudentBehaviorComponent } from './student-behavior.component';
import { StudentAttendanceComponent } from '../student-attendance/student-attendance.component';

interface ScoreSheet {
  assessment: { id: string; title: string; maxScore: number; status: 'DRAFT' | 'PUBLISHED' };
  students: { id: string; nis: string; fullName: string; score: number | null; notes: string }[];
}

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, DatePipe, StudentBehaviorComponent, StudentAttendanceComponent],
  template: `
    @if (isTeacher()) {
      <div class="page-heading"><div><span class="eyebrow">Input data siswa</span><h1>Penilaian Siswa</h1><p>Input nilai tugas dan ujian, perilaku, serta kehadiran siswa.</p></div></div>
    } @else {
      <div class="page-heading"><div><span class="eyebrow">Input data siswa</span><h1>Penilaian Siswa</h1><p>Input nilai tugas dan ujian, perilaku, serta kehadiran siswa.</p></div>@if (entryMode() === 'grades') { <button class="btn btn--primary" (click)="openCreate()">+ Buat assessment</button> }</div>
    }
    @if (message()) { <div class="alert alert--success">{{ message() }}</div> }
    @if (error()) { <div class="alert alert--error">{{ error() }}</div> }
    <div class="teacher-assessment-tabs" role="tablist" aria-label="Jenis input penilaian">
      <button type="button" role="tab" [attr.aria-selected]="entryMode() === 'grades'" [class.teacher-assessment-tab--active]="entryMode() === 'grades'" (click)="entryMode.set('grades')">Nilai tugas &amp; ujian</button>
      <button type="button" role="tab" [attr.aria-selected]="entryMode() === 'behavior'" [class.teacher-assessment-tab--active]="entryMode() === 'behavior'" (click)="entryMode.set('behavior')">Perilaku</button>
      <button type="button" role="tab" [attr.aria-selected]="entryMode() === 'attendance'" [class.teacher-assessment-tab--active]="entryMode() === 'attendance'" (click)="entryMode.set('attendance')">Kehadiran</button>
    </div>
    @if (entryMode() === 'behavior') { <app-student-behavior /> }
    @else if (entryMode() === 'attendance') { <app-student-attendance [embedded]="true" /> }
    @else if (loading()) { <div class="loading-card">Memuat penilaian...</div> }
    @else if (isTeacher()) {
      <section class="panel teacher-assessment-filters" aria-label="Filter penilaian">
        <label>Tahun ajaran<select [value]="yearFilter()" (change)="changeYear($event)">@for (year of teacherYears(); track year) { <option [value]="year">{{ year }}</option> }</select></label>
        <label>Semester<select [value]="semesterFilter()" (change)="changeSemester($event)">@for (period of semestersForYear(); track period.id) { <option [value]="period.semester">{{ period.semester === 'GANJIL' ? 'Ganjil' : 'Genap' }}</option> }</select></label>
        <label>Kelas<select [value]="classFilter()" (change)="changeClassFilter($event)"><option value="">Semua kelas</option>@for (schoolClass of teacherClasses(); track schoolClass.id) { <option [value]="schoolClass.id">Kelas {{ schoolClass.name }}</option> }</select></label>
        <label>Mapel
          @if (teacherSubjects().length === 1) {
            <div class="teacher-assessment-fixed-subject">{{ teacherSubjects()[0].name }}<small>Sesuai penugasan guru</small></div>
          } @else {
            <select [value]="effectiveSubjectId()" (change)="subjectFilter.set(selectValue($event))">
              <option value="">{{ teacherSubjects().length ? 'Semua mapel diampu' : 'Belum ada mapel' }}</option>
              @for (subject of teacherSubjects(); track subject.id) { <option [value]="subject.id">{{ subject.name }}</option> }
            </select>
          }
        </label>
      </section>
      <section class="teacher-assessment-summary" aria-label="Ringkasan penilaian">
        <article class="panel teacher-assessment-stat"><span class="teacher-assessment-stat-icon teacher-assessment-stat-icon--total">▣</span><div><strong>{{ teacherSummary().total }}</strong><span>Assessment</span><small>semester ini</small></div></article>
        <article class="panel teacher-assessment-stat"><span class="teacher-assessment-stat-icon teacher-assessment-stat-icon--missing">○</span><div><strong>{{ teacherSummary().missingScores }}</strong><span>Belum Dinilai</span><small>nilai siswa belum diisi</small></div></article>
        <article class="panel teacher-assessment-stat"><span class="teacher-assessment-stat-icon teacher-assessment-stat-icon--draft">✎</span><div><strong>{{ teacherSummary().drafts }}</strong><span>Draft</span><small>belum diterbitkan</small></div></article>
      </section>
      <div class="teacher-assessment-actions"><button class="btn btn--primary" (click)="openCreate()">+ Buat Penilaian</button></div>
      <section class="panel teacher-assessment-list">
        <div class="teacher-assessment-list-header"><div><h2>Penilaian Saya</h2><p>{{ teacherVisible().length }} penilaian sesuai filter</p></div></div>
        <div class="table-scroll"><table><thead><tr><th>Nama</th><th>Jenis</th><th>Bobot</th><th>Dinilai</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
          @for (assessment of teacherVisible(); track assessment.id) {
            <tr><td><strong class="teacher-assessment-title">{{ assessment.title }}</strong><span class="cell-sub">{{ assessment.subject.name }} · Kelas {{ assessment.schoolClass.name }}</span></td><td><span class="type-chip">{{ typeLabel(assessment.type) }}</span></td><td>{{ assessment.weight }}%</td><td><strong>{{ assessment._count.scores }}/{{ assessment.studentCount }}</strong></td><td><span class="status" [class.status--published]="assessment.status === 'PUBLISHED'">{{ assessment.status === 'PUBLISHED' ? 'Published' : 'Draft' }}</span></td><td><button class="btn btn--secondary btn--small" (click)="openScores(assessment)">{{ assessment.status === 'PUBLISHED' ? 'Lihat nilai' : 'Input nilai' }}</button></td></tr>
          } @empty { <tr><td colspan="6" class="empty-state">Belum ada penilaian untuk filter ini.</td></tr> }
        </tbody></table></div>
      </section>
    } @else {
    <section class="assessment-grid">
      @for (assessment of assessments(); track assessment.id) {
        <article class="assessment-card">
          <div class="assessment-top"><span class="type-chip">{{ typeLabel(assessment.type) }}</span><span class="status" [class.status--published]="assessment.status === 'PUBLISHED'">{{ assessment.status === 'PUBLISHED' ? 'Diterbitkan' : 'Draft' }}</span></div>
          <h2>{{ assessment.title }}</h2>
          <p>{{ assessment.subject.name }} · Kelas {{ assessment.schoolClass.name }} · {{ periodLabel(assessment.academicPeriodId) }}</p>
          <div class="assessment-meta"><span><small>Bobot</small><strong>{{ assessment.weight }}%</strong></span><span><small>Nilai masuk</small><strong>{{ assessment._count.scores }}</strong></span><span><small>Jadwal</small><strong>{{ assessment.scheduledAt ? (assessment.scheduledAt | date:'dd MMM') : '—' }}</strong></span></div>
          <div class="assessment-footer"><span class="teacher-name">Oleh {{ assessment.teacher.fullName }}</span><button class="btn btn--secondary btn--small" (click)="openScores(assessment)">{{ assessment.status === 'PUBLISHED' ? 'Lihat nilai' : 'Input nilai' }}</button></div>
        </article>
      } @empty { <div class="panel empty-state">Belum ada assessment.</div> }
    </section>
    }

    @if (showCreate()) {
      <div class="modal-backdrop" (click)="showCreate.set(false)">
        <form class="modal" [formGroup]="form" (ngSubmit)="create()" (click)="$event.stopPropagation()">
          <div class="modal-heading"><div><span class="eyebrow">Assessment baru</span><h2>Atur penilaian</h2></div><button type="button" class="modal-close" (click)="showCreate.set(false)">×</button></div>
          <div class="form-grid">
            <label class="span-2">Judul assessment<input formControlName="title" placeholder="Contoh: Kuis Persamaan Linear"></label>
            <label>Jenis<select formControlName="type"><option value="ASSIGNMENT">Tugas</option><option value="QUIZ">Kuis</option><option value="MIDTERM">UTS</option><option value="FINAL">UAS</option><option value="PRACTICE">Praktik</option><option value="PROJECT">Proyek</option></select></label>
            <label>Semester<select formControlName="academicPeriodId" (change)="periodChanged()"><option value="">Pilih semester</option>@for (item of references()?.periods ?? []; track item.id) { <option [value]="item.id">{{ academicPeriodLabel(item) }}</option> }</select></label>
            <label>Kelas<select formControlName="schoolClassId" (change)="classChanged()"><option value="">Pilih kelas</option>@for (item of manageableClasses(); track item.id) { <option [value]="item.id">Kelas {{ item.name }}</option> }</select></label>
            <label>Mata pelajaran<select formControlName="subjectId"><option value="">Pilih pelajaran</option>@for (item of manageableSubjects(); track item.id) { <option [value]="item.id">{{ item.name }}</option> }</select></label>
            <label>Bobot (%)<input type="number" min="1" max="100" formControlName="weight"></label>
            <label>Nilai maksimum<input type="number" min="1" formControlName="maxScore"></label>
            <label class="span-2">Tanggal pelaksanaan<input type="datetime-local" formControlName="scheduledAt"></label>
          </div>
          <div class="modal-actions"><button type="button" class="btn btn--secondary" (click)="showCreate.set(false)">Batal</button><button class="btn btn--primary" [disabled]="form.invalid || saving()">{{ saving() ? 'Menyimpan…' : 'Buat assessment' }}</button></div>
        </form>
      </div>
    }

    @if (scoreSheet(); as sheet) {
      <div class="modal-backdrop" (click)="closeScores()">
        <section class="modal modal--wide" (click)="$event.stopPropagation()">
          <div class="modal-heading"><div><span class="eyebrow">Lembar nilai</span><h2>{{ sheet.assessment.title }}</h2><p>Nilai maksimum {{ sheet.assessment.maxScore }}</p></div><button class="modal-close" (click)="closeScores()">×</button></div>
          @if (sheet.assessment.status === 'DRAFT' && !scoreReadOnly()) {
            <div class="score-import-toolbar"><button class="btn btn--secondary btn--small" (click)="downloadScoreTemplate()">Unduh template CSV</button><label class="btn btn--secondary btn--small score-import-upload">Unggah nilai CSV<input type="file" accept=".csv,text/csv" aria-label="Unggah nilai CSV" (change)="onScoreFileSelected($event)"></label><small>Isi NIS dan nilai di Excel, simpan sebagai CSV UTF-8, lalu periksa hasilnya sebelum menyimpan.</small></div>
            @if (importMessage()) { <div class="alert alert--success">{{ importMessage() }}</div> }
          }
          @if (error()) { <div class="alert alert--error">{{ error() }}</div> }
          <div class="score-list">
            <div class="score-row score-row--head"><span>Siswa</span><span>Nilai</span><span>Catatan</span></div>
            @for (student of sheet.students; track student.id) {
              <div class="score-row"><div class="person-cell"><span class="student-avatar">{{ initials(student.fullName) }}</span><span><strong>{{ student.fullName }}</strong><small class="cell-sub">{{ student.nis }}</small></span></div><input type="number" min="0" [max]="sheet.assessment.maxScore" [(ngModel)]="scoreValues[student.id]" [disabled]="sheet.assessment.status === 'PUBLISHED' || scoreReadOnly()"><input placeholder="Catatan opsional" [(ngModel)]="noteValues[student.id]" [disabled]="sheet.assessment.status === 'PUBLISHED' || scoreReadOnly()"></div>
            }
          </div>
          <div class="modal-actions"><button class="btn btn--secondary" (click)="closeScores()">Tutup</button>@if (sheet.assessment.status === 'DRAFT' && !scoreReadOnly()) { <button class="btn btn--secondary" (click)="saveScores()" [disabled]="saving()">Simpan draft</button><button class="btn btn--primary" (click)="publish()" [disabled]="saving()">Terbitkan nilai</button> }</div>
        </section>
      </div>
    }
  `,
})
export class AssessmentsComponent {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  readonly isTeacher = computed(() => this.auth.user()?.role === 'TEACHER');
  readonly entryMode = signal<'grades' | 'behavior' | 'attendance'>('grades');
  readonly assessments = signal<Assessment[]>([]);
  readonly references = signal<ReferenceData | null>(null);
  readonly loading = signal(true);
  readonly yearFilter = signal('');
  readonly semesterFilter = signal<'GANJIL' | 'GENAP'>('GANJIL');
  readonly classFilter = signal('');
  readonly subjectFilter = signal('');
  readonly teacherPeriods = computed(() => {
    const references = this.references();
    const teacherId = this.auth.user()?.id;
    if (!references || !teacherId) return [];
    const periodIds = new Set([
      ...references.teachingAssignments.filter((item) => item.teacherId === teacherId).map((item) => item.academicPeriodId),
      ...this.assessments().filter((item) => item.teacher.id === teacherId).map((item) => item.academicPeriodId),
    ]);
    return references.periods.filter((item) => periodIds.has(item.id));
  });
  readonly teacherYears = computed(() => [...new Set(this.teacherPeriods().map((period) => period.name))]);
  readonly semestersForYear = computed(() => this.teacherPeriods().filter((period) => period.name === this.yearFilter()));
  readonly selectedTeacherPeriodId = computed(() => this.semestersForYear().find((period) => period.semester === this.semesterFilter())?.id ?? '');
  readonly teacherClasses = computed(() => {
    const references = this.references();
    const periodId = this.selectedTeacherPeriodId();
    const teacherId = this.auth.user()?.id;
    if (!references || !teacherId || !periodId) return [];
    const ids = new Set([
      ...references.teachingAssignments.filter((item) => item.teacherId === teacherId && item.academicPeriodId === periodId).map((item) => item.classId),
      ...this.assessments().filter((item) => item.teacher.id === teacherId && item.academicPeriodId === periodId).map((item) => item.schoolClass.id),
    ]);
    const period = references.periods.find((item) => item.id === periodId);
    return references.classes.filter((item) => ids.has(item.id) && item.academicYear === period?.name);
  });
  readonly teacherSubjects = computed(() => {
    const references = this.references();
    const periodId = this.selectedTeacherPeriodId();
    const classId = this.classFilter();
    const teacherId = this.auth.user()?.id;
    if (!references || !teacherId || !periodId) return [];
    const ids = new Set([
      ...references.teachingAssignments.filter((item) => item.teacherId === teacherId && item.academicPeriodId === periodId && (!classId || item.classId === classId)).map((item) => item.subjectId),
    ]);
    return references.subjects.filter((item) => ids.has(item.id));
  });
  readonly effectiveSubjectId = computed(() => focusedSubjectId(this.teacherSubjects().map((item) => item.id), this.subjectFilter()));
  readonly teacherVisible = computed(() => {
    const filters = {
      teacherId: this.auth.user()?.id ?? '',
      academicPeriodId: this.selectedTeacherPeriodId(),
      classId: this.classFilter(),
      subjectId: this.effectiveSubjectId(),
    };
    return teacherAssessments(this.assessments(), filters);
  });
  readonly teacherSummary = computed(() => assessmentSummary(this.teacherVisible()));
  readonly showCreate = signal(false);
  readonly scoreSheet = signal<ScoreSheet | null>(null);
  readonly scoreReadOnly = signal(false);
  readonly importMessage = signal('');
  readonly saving = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  scoreValues: Record<string, number | null> = {};
  noteValues: Record<string, string> = {};
  private initialFocusDone = false;
  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    type: ['ASSIGNMENT' as Assessment['type'], Validators.required],
    weight: [20, [Validators.required, Validators.min(1), Validators.max(100)]],
    maxScore: [100, [Validators.required, Validators.min(1)]],
    schoolClassId: ['', Validators.required], subjectId: ['', Validators.required], academicPeriodId: ['', Validators.required], scheduledAt: [''],
  });

  constructor() { this.reloadAll(); }
  reloadAll() {
    this.loading.set(true);
    forkJoin({ assessments: this.http.get<Assessment[]>('/api/v1/assessments'), references: this.http.get<ReferenceData>('/api/v1/reference-data') }).subscribe({
      next: ({ assessments, references }) => {
        this.assessments.set(assessments);
        this.references.set(references);
        if (!this.yearFilter() && this.isTeacher()) {
          const period = currentAcademicPeriod(this.teacherPeriods()) ?? this.teacherPeriods()[0];
          this.yearFilter.set(period?.name ?? '');
          this.semesterFilter.set(period?.semester ?? 'GANJIL');
        }
        if (this.isTeacher() && !this.initialFocusDone) {
          this.focusTeacherFilters();
          this.initialFocusDone = true;
        }
        if (!this.form.controls.academicPeriodId.value) this.form.controls.academicPeriodId.setValue(currentAcademicPeriod(references.periods)?.id ?? '');
        this.loading.set(false);
      },
      error: (error) => { this.error.set(errorMessage(error)); this.loading.set(false); },
    });
  }
  typeLabel(type: Assessment['type']) { return ({ ASSIGNMENT: 'Tugas', QUIZ: 'Kuis', MIDTERM: 'UTS', FINAL: 'UAS', PRACTICE: 'Praktik', PROJECT: 'Proyek' })[type]; }
  selectValue(event: Event) { return (event.target as HTMLSelectElement).value; }
  changeYear(event: Event) {
    this.yearFilter.set(this.selectValue(event));
    this.semesterFilter.set(this.semestersForYear()[0]?.semester ?? 'GANJIL');
    this.focusAfterPeriodChange();
  }
  changeSemester(event: Event) {
    this.semesterFilter.set(this.selectValue(event) as 'GANJIL' | 'GENAP');
    this.focusAfterPeriodChange();
  }
  changeClassFilter(event: Event) {
    this.classFilter.set(this.selectValue(event));
    this.subjectFilter.set('');
    if (this.teacherSubjects().length === 1) this.subjectFilter.set(this.teacherSubjects()[0].id);
  }
  private focusAfterPeriodChange() {
    this.focusTeacherFilters();
  }
  private focusTeacherFilters() {
    this.classFilter.set(''); this.subjectFilter.set('');
    const homeroomIds = new Set(this.references()?.access.homeroomClassIds ?? []);
    const homeroomId = this.teacherClasses().find((schoolClass) => homeroomIds.has(schoolClass.id))?.id;
    if (homeroomId) this.classFilter.set(homeroomId);
    if (this.teacherSubjects().length === 1) this.subjectFilter.set(this.teacherSubjects()[0].id);
  }
  openCreate() {
    if (this.isTeacher()) {
      this.form.controls.academicPeriodId.setValue(this.selectedTeacherPeriodId());
      this.form.controls.schoolClassId.setValue(this.classFilter());
      this.form.controls.subjectId.setValue(this.classFilter() ? this.effectiveSubjectId() : '');
    }
    this.showCreate.set(true);
  }
  academicPeriodLabel = academicPeriodLabel;
  periodLabel(id: string) {
    const period = this.references()?.periods.find((item) => item.id === id);
    return period ? academicPeriodLabel(period) : 'Semester tidak diketahui';
  }
  initials(name: string) { return name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase(); }
  manageableClasses() {
    const reference = this.references();
    const periodId = this.form.controls.academicPeriodId.value;
    const period = reference?.periods.find((item) => item.id === periodId);
    if (!reference || !period) return [];
    if (this.auth.user()?.role === 'ADMIN') return reference.classes.filter((item) => item.academicYear === period.name);
    const ids = new Set(reference.access.manageablePairs.filter((item) => item.academicPeriodId === periodId).map((item) => item.classId));
    return reference.classes.filter((item) => item.academicYear === period.name && ids.has(item.id));
  }
  manageableSubjects() {
    const reference = this.references();
    if (!reference || this.auth.user()?.role === 'ADMIN') return reference?.subjects ?? [];
    const classId = this.form.controls.schoolClassId.value;
    const periodId = this.form.controls.academicPeriodId.value;
    const ids = new Set(reference.access.manageablePairs.filter((item) => item.classId === classId && item.academicPeriodId === periodId).map((item) => item.subjectId));
    return reference.subjects.filter((item) => ids.has(item.id));
  }
  classChanged() { this.form.controls.subjectId.setValue(''); }
  periodChanged() { this.form.controls.schoolClassId.setValue(''); this.form.controls.subjectId.setValue(''); }

  create() {
    if (this.form.invalid) return;
    this.saving.set(true); this.error.set('');
    const raw = this.form.getRawValue();
    const payload = { ...raw, scheduledAt: raw.scheduledAt ? new Date(raw.scheduledAt).toISOString() : null };
    this.http.post('/api/v1/assessments', payload).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => { this.showCreate.set(false); this.message.set('Assessment berhasil dibuat.'); this.form.reset({ type: 'ASSIGNMENT', weight: 20, maxScore: 100 }); this.reloadAll(); },
      error: (error) => this.error.set(errorMessage(error)),
    });
  }
  openScores(assessment: Assessment) {
    this.error.set('');
    this.importMessage.set('');
    this.scoreReadOnly.set(this.isTeacher() && assessment.teacher.id !== this.auth.user()?.id);
    this.http.get<ScoreSheet>(`/api/v1/assessments/${assessment.id}/scores`).subscribe({
      next: (sheet) => {
        this.scoreValues = Object.fromEntries(sheet.students.map((student) => [student.id, student.score]));
        this.noteValues = Object.fromEntries(sheet.students.map((student) => [student.id, student.notes]));
        this.scoreSheet.set(sheet);
      },
      error: (error) => this.error.set(errorMessage(error)),
    });
  }
  closeScores() { this.scoreSheet.set(null); }
  downloadScoreTemplate() {
    const sheet = this.scoreSheet();
    if (!sheet || sheet.assessment.status !== 'DRAFT' || this.scoreReadOnly()) return;
    const blob = new Blob([scoreTemplateCsv(sheet.students)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nilai-${sheet.assessment.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'assessment'}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  async onScoreFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const sheet = this.scoreSheet();
    if (!file || !sheet || sheet.assessment.status !== 'DRAFT' || this.scoreReadOnly()) return;
    this.error.set(''); this.importMessage.set('');
    if (!file.name.toLowerCase().endsWith('.csv') || file.size > 1_000_000) {
      this.error.set('Pilih berkas CSV UTF-8 maksimal 1 MB.');
      return;
    }
    try {
      const entries = parseScoreImport(await file.text(), sheet.students, sheet.assessment.maxScore);
      for (const entry of entries) {
        this.scoreValues[entry.studentId] = entry.value;
        this.noteValues[entry.studentId] = entry.notes;
      }
      this.importMessage.set(`${entries.length} nilai berhasil dimuat. Periksa lalu klik Simpan draft atau Terbitkan nilai.`);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'CSV tidak dapat dibaca.');
    }
  }
  private scorePayload() {
    const sheet = this.scoreSheet()!;
    return sheet.students.filter((student) => this.scoreValues[student.id] !== null && this.scoreValues[student.id] !== undefined).map((student) => ({ studentId: student.id, value: Number(this.scoreValues[student.id]), notes: this.noteValues[student.id] || null }));
  }
  saveScores(afterSave?: () => void) {
    const sheet = this.scoreSheet(); if (!sheet) return;
    const scores = this.scorePayload();
    if (!scores.length) { this.error.set('Isi minimal satu nilai terlebih dahulu.'); return; }
    this.saving.set(true); this.error.set('');
    this.http.put(`/api/v1/assessments/${sheet.assessment.id}/scores`, { scores }).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => { this.message.set('Nilai berhasil disimpan.'); afterSave ? afterSave() : this.openScores(this.assessments().find((item) => item.id === sheet.assessment.id)!); this.reloadAll(); },
      error: (error) => this.error.set(errorMessage(error)),
    });
  }
  publish() {
    const sheet = this.scoreSheet(); if (!sheet) return;
    if (this.scorePayload().length !== sheet.students.length) { this.error.set('Lengkapi nilai seluruh siswa sebelum diterbitkan.'); return; }
    this.saveScores(() => this.http.post(`/api/v1/assessments/${sheet.assessment.id}/publish`, {}).subscribe({
      next: () => { this.message.set('Nilai berhasil diterbitkan.'); this.closeScores(); this.reloadAll(); },
      error: (error) => this.error.set(errorMessage(error)),
    }));
  }
}
