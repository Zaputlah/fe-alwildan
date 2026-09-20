import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { academicPeriodLabel, currentAcademicPeriod } from '../../core/academic-period';
import { ReferenceData, SchoolClass } from '../../core/models';
import { errorMessage } from '../../core/security.interceptor';

interface ReportStudent { id: string; nis: string; fullName: string; isActive: boolean }
interface ReportAssessment {
  id: string; title: string; type: string; weight: number; maxScore: number;
  score: number | null; percentage: number | null; notes: string | null; teacherName: string;
}
interface ReportSubject {
  id: string; code: string; name: string; passingGrade: number;
  average: number | null; grade: string | null; meetsKkm: boolean | null; assessments: ReportAssessment[];
}
interface StudentReport {
  student: ReportStudent;
  schoolClass: { id: string; name: string };
  academicPeriod: ReferenceData['periods'][number];
  subjects: ReportSubject[];
  overallAverage: number | null;
  overallGrade: string | null;
  academicAverage: number | null;
  attendance: { weight: number; totalRecords: number; attended: number; percentage: number | null };
}

@Component({
  standalone: true,
  template: `
    <div class="page-heading"><div><span class="eyebrow">Hasil penilaian</span><h1>Rekap Nilai Siswa</h1><p>Lihat hasil penilaian yang sudah diterbitkan guru, per siswa dan semester.</p></div></div>
    @if (error()) { <div class="alert alert--error">{{ error() }}</div> }
    @if (auth.user()?.role === 'TEACHER' && references()?.access?.homeroomClassIds?.length) {
      <div class="teacher-assessment-tabs" role="tablist" aria-label="Tampilan rekap nilai">
        <button type="button" role="tab" [attr.aria-selected]="reportMode() === 'own'" [class.teacher-assessment-tab--active]="reportMode() === 'own'" (click)="changeReportMode('own')">Rekap per Siswa</button>
        <button type="button" role="tab" [attr.aria-selected]="reportMode() === 'homeroom'" [class.teacher-assessment-tab--active]="reportMode() === 'homeroom'" (click)="changeReportMode('homeroom')">Pantauan Wali Kelas</button>
      </div>
      @if (reportMode() === 'homeroom') { <div class="teacher-assessment-notice">Lihat hasil nilai yang sudah diterbitkan semua guru pada kelas wali Anda. Halaman ini hanya untuk rekap, bukan input nilai.</div> }
    }
    <section class="panel report-filters">
      <label>Semester
        <select [value]="periodId()" (change)="onPeriodChange($event)">
          @for (period of references()?.periods ?? []; track period.id) { <option [value]="period.id">{{ academicPeriodLabel(period) }}</option> }
        </select>
      </label>
      <label>Kelas
        <select [value]="classId()" (change)="onClassChange($event)">
          @for (item of visibleClasses(); track item.id) { <option [value]="item.id">Kelas {{ item.name }}</option> }
          @empty { <option value="">Belum ada kelas</option> }
        </select>
      </label>
      <label>Siswa
        <select [value]="studentId()" [disabled]="loadingStudents() || !students().length" (change)="onStudentChange($event)">
          @for (student of students(); track student.id) { <option [value]="student.id">{{ student.fullName }} · {{ student.nis }}{{ student.isActive ? '' : ' (nonaktif)' }}</option> }
          @empty { <option value="">Belum ada siswa</option> }
        </select>
      </label>
    </section>

    @if (reportMode() === 'homeroom' && students().length) {
      <section class="panel homeroom-roster"><div class="teacher-assessment-list-header"><div><h2>Siswa kelas wali</h2><p>{{ students().length }} siswa · Kelas {{ selectedClassName() }}</p></div></div><div class="homeroom-student-buttons">
        @for (student of students(); track student.id) { <button type="button" class="btn btn--secondary btn--small" [class.homeroom-student-button--active]="student.id === studentId()" (click)="selectStudent(student.id)">{{ student.fullName }} · {{ student.nis }}</button> }
      </div></section>
    }

    @if (loadingStudents() || loadingReport()) { <div class="loading-card">Memuat rekap nilai…</div> }
    @else if (report(); as result) {
      <section class="panel report-header">
        <div><span class="eyebrow">Rekap per siswa</span><h2>{{ result.student.fullName }}{{ result.student.isActive ? '' : ' (nonaktif)' }}</h2><p>NIS {{ result.student.nis }} · Kelas {{ result.schoolClass.name }} · {{ academicPeriodLabel(result.academicPeriod) }}</p></div>
        <div class="report-average"><small>Nilai akhir sementara</small><strong>{{ formatScore(result.overallAverage) }} <small>{{ result.overallGrade }}</small></strong><span>Akademik 75% · Kehadiran 25%</span></div>
      </section>
      <p class="report-explanation">Hanya assessment yang sudah diterbitkan. Rerata per pelajaran = jumlah (nilai ÷ nilai maksimum × bobot) ÷ total bobot nilai yang tersedia; rerata keseluruhan adalah rata-rata sederhana antar pelajaran yang tampil.</p>
      <section class="panel report-attendance-summary"><div><span class="eyebrow">Kehadiran siswa</span><h2>{{ formatScore(result.attendance.percentage) }}%</h2><p>{{ result.attendance.attended }} dari {{ result.attendance.totalRecords }} catatan hadir/terlambat · bobot {{ result.attendance.weight }}%</p></div><div><small>Rerata akademik</small><strong>{{ formatScore(result.academicAverage) }}</strong><p>Bobot akademik 75%</p></div></section>
      @if (result.subjects.length) {
        <section class="panel table-panel">
          <div class="panel-heading master-heading"><div><h2>Ringkasan mata pelajaran</h2><p>{{ result.subjects.length }} mata pelajaran dengan penilaian diterbitkan</p></div></div>
          <div class="table-scroll"><table><thead><tr><th>Mata pelajaran</th><th>Penilaian</th><th>KKM</th><th>Rerata</th><th>Predikat</th><th>Hasil sementara</th></tr></thead><tbody>
            @for (subject of result.subjects; track subject.id) {
              <tr><td><strong>{{ subject.name }}</strong></td><td>{{ subject.assessments.length }}</td><td>{{ subject.passingGrade }}</td><td><strong>{{ formatScore(subject.average) }}</strong></td><td><strong>{{ subject.grade || '—' }}</strong></td><td>{{ subject.meetsKkm === null ? 'Belum ada nilai' : subject.meetsKkm ? 'Mencapai KKM' : 'Di bawah KKM' }}</td></tr>
            }
          </tbody></table></div>
        </section>
        <div class="report-subjects">
          @for (subject of result.subjects; track subject.id) {
            <section class="panel table-panel">
              <div class="panel-heading master-heading"><div><h2>{{ subject.name }}</h2><p>Rerata {{ formatScore(subject.average) }} · KKM {{ subject.passingGrade }}</p></div></div>
              <div class="table-scroll"><table><thead><tr><th>Assessment</th><th>Jenis</th><th>Guru</th><th>Bobot</th><th>Nilai</th><th>Setara 100</th><th>Catatan</th></tr></thead><tbody>
                @for (assessment of subject.assessments; track assessment.id) {
                  <tr><td><strong>{{ assessment.title }}</strong></td><td>{{ typeLabel(assessment.type) }}</td><td>{{ assessment.teacherName }}</td><td>{{ assessment.weight }}%</td><td>{{ assessment.score === null ? '—' : assessment.score + ' / ' + assessment.maxScore }}</td><td>{{ formatScore(assessment.percentage) }}</td><td class="reason-cell">{{ assessment.notes || '—' }}</td></tr>
                }
              </tbody></table></div>
            </section>
          }
        </div>
      } @else { <div class="panel empty-state">Belum ada nilai yang diterbitkan untuk siswa ini pada semester tersebut.</div> }
    } @else if (references() && !visibleClasses().length) { <div class="panel empty-state">Belum ada kelas yang dapat Anda akses pada semester ini.</div> }
    @else if (references() && !students().length) { <div class="panel empty-state">Belum ada siswa aktif di kelas ini.</div> }
  `,
})
export class StudentReportsComponent {
  private readonly http = inject(HttpClient);
  readonly auth = inject(AuthService);
  readonly references = signal<ReferenceData | null>(null);
  readonly students = signal<ReportStudent[]>([]);
  readonly report = signal<StudentReport | null>(null);
  readonly periodId = signal('');
  readonly classId = signal('');
  readonly studentId = signal('');
  readonly loadingStudents = signal(false);
  readonly loadingReport = signal(false);
  readonly error = signal('');
  readonly reportMode = signal<'own' | 'homeroom'>('own');
  readonly academicPeriodLabel = academicPeriodLabel;

  constructor() {
    this.http.get<ReferenceData>('/api/v1/reference-data').subscribe({
      next: (references) => {
        this.references.set(references);
        const active = currentAcademicPeriod(references.periods);
        const chosen = [active, ...references.periods].find((period) => period && this.visibleClasses(period.id).length);
        this.periodId.set(chosen?.id ?? active?.id ?? references.periods[0]?.id ?? '');
        this.selectFirstClass();
      },
      error: (error) => this.error.set(errorMessage(error)),
    });
  }

  visibleClasses(periodId = this.periodId()): SchoolClass[] {
    const refs = this.references();
    const period = refs?.periods.find((item) => item.id === periodId);
    if (!refs || !period) return [];
    const isAdmin = this.auth.user()?.role === 'ADMIN';
    const allowedIds = new Set([
      ...refs.access.homeroomClassIds,
      ...refs.access.manageablePairs.filter((item) => item.academicPeriodId === periodId).map((item) => item.classId),
    ]);
    return refs.classes.filter((item) => item.academicYear === period.name && (isAdmin || (this.reportMode() === 'homeroom' ? refs.access.homeroomClassIds.includes(item.id) : allowedIds.has(item.id))));
  }

  selectedClassName() { return this.references()?.classes.find((item) => item.id === this.classId())?.name ?? '—'; }
  changeReportMode(mode: 'own' | 'homeroom') {
    if (mode === 'homeroom' && !this.references()?.access.homeroomClassIds.length) return;
    this.reportMode.set(mode);
    this.selectFirstClass();
  }
  selectStudent(id: string) { this.studentId.set(id); this.loadReport(); }

  onPeriodChange(event: Event) {
    this.periodId.set((event.target as HTMLSelectElement).value);
    this.selectFirstClass();
  }

  private selectFirstClass() {
    this.classId.set(this.visibleClasses()[0]?.id ?? '');
    this.loadStudents();
  }

  onClassChange(event: Event) {
    this.classId.set((event.target as HTMLSelectElement).value);
    this.loadStudents();
  }

  onStudentChange(event: Event) {
    this.studentId.set((event.target as HTMLSelectElement).value);
    this.loadReport();
  }

  private loadStudents() {
    const classId = this.classId();
    const academicPeriodId = this.periodId();
    this.students.set([]);
    this.studentId.set('');
    this.report.set(null);
    this.loadingReport.set(false);
    this.error.set('');
    if (!classId || !academicPeriodId) { this.loadingStudents.set(false); return; }
    this.loadingStudents.set(true);
    this.http.get<ReportStudent[]>('/api/v1/reports/student-scores/students', { params: { classId, academicPeriodId } }).subscribe({
      next: (students) => {
        if (classId !== this.classId() || academicPeriodId !== this.periodId()) return;
        this.students.set(students);
        this.loadingStudents.set(false);
        this.studentId.set(students[0]?.id ?? '');
        this.loadReport();
      },
      error: (error) => {
        if (classId !== this.classId() || academicPeriodId !== this.periodId()) return;
        this.error.set(errorMessage(error));
        this.loadingStudents.set(false);
      },
    });
  }

  private loadReport() {
    const studentId = this.studentId();
    const classId = this.classId();
    const academicPeriodId = this.periodId();
    this.report.set(null);
    if (!studentId || !classId || !academicPeriodId) { this.loadingReport.set(false); return; }
    this.loadingReport.set(true);
    this.error.set('');
    this.http.get<StudentReport>(`/api/v1/reports/student-scores/students/${studentId}`, { params: { classId, academicPeriodId } }).subscribe({
      next: (report) => {
        if (studentId !== this.studentId() || classId !== this.classId() || academicPeriodId !== this.periodId()) return;
        this.report.set(report);
        this.loadingReport.set(false);
      },
      error: (error) => {
        if (studentId !== this.studentId() || classId !== this.classId() || academicPeriodId !== this.periodId()) return;
        this.error.set(errorMessage(error));
        this.loadingReport.set(false);
      },
    });
  }

  formatScore(value: number | null) { return value === null ? '—' : value.toFixed(1); }
  typeLabel(type: string) { return ({ ASSIGNMENT: 'Tugas', QUIZ: 'Kuis', MIDTERM: 'UTS', FINAL: 'UAS', PRACTICE: 'Praktik', PROJECT: 'Proyek' } as Record<string, string>)[type] ?? type; }
}
