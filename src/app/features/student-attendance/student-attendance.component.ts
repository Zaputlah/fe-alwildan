import { HttpClient } from '@angular/common/http';
import { Component, Input, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { academicPeriodLabel, currentAcademicPeriod } from '../../core/academic-period';
import { AuthService } from '../../core/auth.service';
import { ReferenceData, SchoolClass, StudentAttendanceResponse, StudentAttendanceStatus } from '../../core/models';
import { errorMessage } from '../../core/security.interceptor';
import { canMarkStudentLate, pendingAttendanceEntries } from './attendance-entry';
import { attendanceHistoryDays } from './attendance-history';

const statusOptions: { value: StudentAttendanceStatus; label: string }[] = [
  { value: 'PRESENT', label: 'Hadir' }, { value: 'LATE', label: 'Terlambat' },
  { value: 'SICK', label: 'Sakit' }, { value: 'LEAVE', label: 'Izin' }, { value: 'ABSENT', label: 'Alpa' },
];

@Component({
  selector: 'app-student-attendance',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (embedded) { <div class="assessment-section-intro"><h2>Kehadiran siswa</h2><p>Catat kehadiran harian dan pantau riwayat sesuai kelas yang dapat Anda akses.</p></div> }
    @else { <div class="page-heading"><div><span class="eyebrow">Kehadiran siswa</span><h1>Absensi Siswa</h1><p>Catat kehadiran harian dan pantau rekap per kelas.</p></div></div> }
    @if (message()) { <div class="alert alert--success">{{ message() }}</div> }
    @if (error()) { <div class="alert alert--error">{{ error() }}</div> }
    <section class="panel student-attendance-filters">
      <label>Semester<select [value]="periodId()" (change)="changePeriod($event)">@for (period of references()?.periods ?? []; track period.id) { <option [value]="period.id">{{ periodLabel(period) }}</option> }</select></label>
      <label>Kelas<select [value]="classId()" (change)="changeClass($event)">@for (schoolClass of visibleClasses(); track schoolClass.id) { <option [value]="schoolClass.id">Kelas {{ schoolClass.name }}</option> } @empty { <option value="">Belum ada kelas</option> }</select></label>
      <label>Bulan<input type="month" [value]="month()" (change)="changeMonth($event)"></label>
    </section>
    @if (loading()) { <div class="loading-card">Memuat absensi siswa...</div> }
    @else if (data(); as attendance) {
      <div class="teacher-assessment-notice">{{ auth.user()?.role === 'ADMIN' ? 'Admin dapat mencatat dan mengoreksi absensi.' : attendance.isHomeroom ? 'Anda mencatat absensi kelas wali ' + attendance.schoolClass.name + '.' : 'Anda mencatat absensi kelas yang diajar.' }} {{ auth.user()?.role === 'TEACHER' ? 'Setelah disimpan, tiap siswa terkunci. Jika siswa yang dicatat Alpa datang pada hari yang sama, gunakan Catat terlambat. Koreksi lain melalui Admin.' : '' }} Siswa tanpa catatan tidak dihitung Alpa.</div>
      <section class="student-attendance-summary">
        @for (status of statusOptions; track status.value) { <article class="panel student-attendance-stat"><small>{{ status.label }}</small><strong>{{ totalFor(status.value) }}</strong><span>catatan bulan ini</span></article> }
      </section>
      @if (attendance.canEdit) {
        <section class="panel student-attendance-editor">
          <div class="teacher-assessment-list-header"><div><h2>Catat kehadiran harian</h2><p>Isi siswa yang belum dicatat. Data tersimpan terkunci untuk Guru; Admin dapat mengoreksi.</p></div><label>Tanggal<input type="date" [value]="selectedDate()" [min]="attendance.period.startDate.slice(0, 10)" [max]="attendance.period.endDate.slice(0, 10)" (change)="changeDate($event)"></label></div>
          <div class="table-scroll"><table><thead><tr><th>Siswa</th><th>NIS</th><th>Status</th><th>Catatan</th><th>Tindak lanjut</th></tr></thead><tbody>
            @for (student of attendance.students; track student.id) { <tr><td><strong>{{ student.fullName }}</strong></td><td class="mono">{{ student.nis }}</td>
              @if (auth.user()?.role === 'TEACHER' && existingRecord(student.id); as saved) {
                <td><span class="attendance-badge" [class.attendance-badge--present]="saved.status === 'PRESENT'" [class.attendance-badge--late]="saved.status === 'LATE'" [class.attendance-badge--sick]="saved.status === 'SICK'" [class.attendance-badge--leave]="saved.status === 'LEAVE'" [class.attendance-badge--absent]="saved.status === 'ABSENT'">{{ statusLabel(saved.status) }}</span></td>
                <td class="reason-cell">{{ attendanceNote(saved.notes, saved.lateArrivalAt) }}</td>
                <td>@if (canMarkLate(saved)) { <button type="button" class="btn btn--secondary btn--small" (click)="markLate(student.id)" [disabled]="lateSaving() !== '' || saving()">{{ lateSaving() === student.id ? 'Menyimpan...' : 'Catat terlambat' }}</button> } @else { <span class="cell-sub">Terkunci</span> }</td>
              } @else {
                <td><select [(ngModel)]="editStatuses[student.id]"><option value="">Belum dicatat</option>@for (status of statusOptions; track status.value) { <option [value]="status.value">{{ status.label }}</option> }</select></td>
                <td><input [(ngModel)]="editNotes[student.id]" maxlength="300" placeholder="Opsional"></td>
                <td><span class="cell-sub">{{ auth.user()?.role === 'ADMIN' && existingRecord(student.id) ? 'Koreksi Admin' : 'Belum disimpan' }}</span></td>
              }
            </tr> }
            @empty { <tr><td colspan="5" class="empty-state">Belum ada siswa aktif di kelas ini.</td></tr> }
          </tbody></table></div>
          <div class="student-attendance-save"><button class="btn btn--primary" (click)="save()" [disabled]="saving() || lateSaving() !== '' || !pendingRecords().length">{{ saving() ? 'Menyimpan...' : 'Simpan absensi' }}</button></div>
        </section>
      }
      <section class="panel student-attendance-table"><div class="teacher-assessment-list-header"><div><h2>Rekap per siswa</h2><p>{{ attendance.students.length }} siswa aktif · {{ attendance.schoolClass.name }} · {{ attendance.month }}</p></div></div><div class="table-scroll"><table><thead><tr><th>Siswa</th><th>NIS</th><th>Hadir</th><th>Terlambat</th><th>Sakit</th><th>Izin</th><th>Alpa</th></tr></thead><tbody>
        @for (row of studentRows(); track row.student.id) { <tr><td><strong>{{ row.student.fullName }}</strong></td><td class="mono">{{ row.student.nis }}</td><td>{{ row.counts.PRESENT }}</td><td>{{ row.counts.LATE }}</td><td>{{ row.counts.SICK }}</td><td>{{ row.counts.LEAVE }}</td><td>{{ row.counts.ABSENT }}</td></tr> }
        @empty { <tr><td colspan="7" class="empty-state">Belum ada siswa aktif di kelas ini.</td></tr> }
      </tbody></table></div></section>
      <section class="panel student-attendance-history">
        <div class="teacher-assessment-list-header"><div><h2>Riwayat absensi</h2><p>Ringkasan per tanggal. Klik tanggal untuk melihat siswa dan keterangannya.</p></div></div>
        <div class="student-attendance-history-toolbar">
          <label>Cari siswa atau NIS<input type="search" [value]="historySearch()" (input)="changeHistorySearch($event)" placeholder="Nama atau NIS"></label>
          <label>Status<select [value]="historyStatus()" (change)="changeHistoryStatus($event)"><option value="">Semua status</option>@for (status of statusOptions; track status.value) { <option [value]="status.value">{{ status.label }}</option> }</select></label>
          @if (historySearch() || historyStatus()) { <button type="button" class="btn btn--secondary btn--small" (click)="clearHistoryFilters()">Hapus filter</button> }
        </div>
        <p class="student-attendance-history-count">{{ matchedHistoryCount() }} catatan pada {{ filteredHistoryDays().length }} tanggal{{ historySearch() || historyStatus() ? ' sesuai filter' : ' bulan ini' }}.</p>
        <div class="student-attendance-history-days">
          @for (day of pagedHistoryDays(); track day.date) {
            <details class="student-attendance-history-day">
              <summary><span class="student-attendance-history-date"><strong>{{ historyDateLabel(day.date) }}</strong><small>{{ day.entries.length }} catatan · Kelas {{ attendance.schoolClass.name }}</small></span>
                <span class="student-attendance-history-chips">@for (status of statusOptions; track status.value) { @if (day.counts[status.value]) { <span [class]="'attendance-badge attendance-badge--' + status.value.toLowerCase()">{{ status.label }} {{ day.counts[status.value] }}</span> } }</span>
                <span class="student-attendance-history-chevron" aria-hidden="true">⌄</span>
              </summary>
              <div class="table-scroll"><table><thead><tr><th>Siswa</th><th>NIS</th><th>Status</th><th>Catatan</th></tr></thead><tbody>
                @for (entry of day.entries; track entry.record.id) { <tr><td><strong>{{ entry.studentName }}</strong></td><td class="mono">{{ entry.nis }}</td><td><span [class]="'attendance-badge attendance-badge--' + entry.record.status.toLowerCase()">{{ statusLabel(entry.record.status) }}</span></td><td class="reason-cell">{{ attendanceNote(entry.record.notes, entry.record.lateArrivalAt) }}</td></tr> }
              </tbody></table></div>
            </details>
          } @empty { <div class="empty-state">{{ attendance.records.length ? 'Tidak ada catatan yang cocok dengan filter.' : 'Belum ada absensi yang dicatat pada bulan ini.' }}</div> }
        </div>
        @if (filteredHistoryDays().length > 7) { <div class="table-pagination"><span>Halaman {{ historyPage() }} dari {{ historyPageCount() }}</span><button type="button" class="btn btn--secondary btn--small" (click)="setHistoryPage(historyPage() - 1)" [disabled]="historyPage() <= 1">Sebelumnya</button><button type="button" class="btn btn--secondary btn--small" (click)="setHistoryPage(historyPage() + 1)" [disabled]="historyPage() >= historyPageCount()">Berikutnya</button></div> }
      </section>
    } @else if (references()) { <div class="loading-card">Belum ada kelas yang dapat dilihat pada semester ini.</div> }
  `,
})
export class StudentAttendanceComponent {
  @Input() embedded = false;
  private readonly http = inject(HttpClient);
  readonly auth = inject(AuthService);
  readonly references = signal<ReferenceData | null>(null);
  readonly data = signal<StudentAttendanceResponse | null>(null);
  readonly periodId = signal('');
  readonly classId = signal('');
  readonly month = signal('');
  readonly selectedDate = signal('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly lateSaving = signal('');
  readonly error = signal('');
  readonly message = signal('');
  readonly historySearch = signal('');
  readonly historyStatus = signal<StudentAttendanceStatus | ''>('');
  readonly historyPage = signal(1);
  readonly statusOptions = statusOptions;
  readonly periodLabel = academicPeriodLabel;
  editStatuses: Record<string, StudentAttendanceStatus | ''> = {};
  editNotes: Record<string, string> = {};
  readonly studentRows = computed(() => {
    const data = this.data();
    if (!data) return [];
    const countsByStudent = new Map(data.students.map((student) => [student.id, { PRESENT: 0, LATE: 0, SICK: 0, LEAVE: 0, ABSENT: 0 } as Record<StudentAttendanceStatus, number>]));
    for (const record of data.records) {
      const counts = countsByStudent.get(record.studentId);
      if (counts) counts[record.status]++;
    }
    return data.students.map((student) => ({ student, counts: countsByStudent.get(student.id)! }));
  });
  readonly filteredHistoryDays = computed(() => {
    const data = this.data();
    return data ? attendanceHistoryDays(data.records, data.students, this.historyStatus(), this.historySearch()) : [];
  });
  readonly matchedHistoryCount = computed(() => this.filteredHistoryDays().reduce((count, day) => count + day.entries.length, 0));
  readonly historyPageCount = computed(() => Math.max(1, Math.ceil(this.filteredHistoryDays().length / 7)));
  readonly pagedHistoryDays = computed(() => this.filteredHistoryDays().slice((this.historyPage() - 1) * 7, this.historyPage() * 7));

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
    const references = this.references();
    const period = references?.periods.find((item) => item.id === periodId);
    if (!references || !period) return [];
    const classes = references.classes.filter((item) => item.academicYear === period.name);
    if (this.auth.user()?.role === 'ADMIN') return classes;
    const homeroomIds = new Set(references.access.homeroomClassIds);
    const homeroom = classes.filter((item) => homeroomIds.has(item.id));
    if (homeroom.length) return homeroom;
    const assigned = new Set(references.access.manageablePairs.filter((item) => item.academicPeriodId === periodId).map((item) => item.classId));
    return classes.filter((item) => assigned.has(item.id));
  }

  changePeriod(event: Event) {
    this.periodId.set((event.target as HTMLSelectElement).value);
    this.classId.set(this.visibleClasses()[0]?.id ?? '');
    const period = this.references()?.periods.find((item) => item.id === this.periodId());
    this.month.set(period?.startDate.slice(0, 7) ?? '');
    this.clearHistoryFilters();
    this.load();
  }
  changeClass(event: Event) { this.classId.set((event.target as HTMLSelectElement).value); this.clearHistoryFilters(); this.load(); }
  changeMonth(event: Event) { this.month.set((event.target as HTMLInputElement).value); this.clearHistoryFilters(); this.load(); }
  changeDate(event: Event) { this.selectedDate.set((event.target as HTMLInputElement).value); this.syncEditor(); }
  changeHistorySearch(event: Event) { this.historySearch.set((event.target as HTMLInputElement).value); this.historyPage.set(1); }
  changeHistoryStatus(event: Event) { this.historyStatus.set((event.target as HTMLSelectElement).value as StudentAttendanceStatus | ''); this.historyPage.set(1); }
  clearHistoryFilters() { this.historySearch.set(''); this.historyStatus.set(''); this.historyPage.set(1); }
  setHistoryPage(page: number) { this.historyPage.set(Math.min(Math.max(page, 1), this.historyPageCount())); }
  historyDateLabel(date: string) { return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00.000Z`)); }

  load() {
    const classId = this.classId();
    const academicPeriodId = this.periodId();
    const requestedMonth = this.month();
    this.data.set(null);
    this.error.set('');
    if (!classId || !academicPeriodId) { this.loading.set(false); return; }
    this.loading.set(true);
    const params: Record<string, string> = { classId, academicPeriodId };
    if (this.month()) params['month'] = this.month();
    this.http.get<StudentAttendanceResponse>('/api/v1/student-attendance', { params }).subscribe({
      next: (data) => {
        if (classId !== this.classId() || academicPeriodId !== this.periodId() || requestedMonth !== this.month()) return;
        this.data.set(data);
        this.month.set(data.month);
        this.historyPage.set(Math.min(this.historyPage(), this.historyPageCount()));
        if (!this.selectedDate() || this.selectedDate().slice(0, 7) !== data.month) {
          this.selectedDate.set(data.todayDate.slice(0, 7) === data.month ? data.todayDate : `${data.month}-01`);
        }
        this.syncEditor();
        this.loading.set(false);
      },
      error: (error) => {
        if (classId !== this.classId() || academicPeriodId !== this.periodId() || requestedMonth !== this.month()) return;
        this.error.set(errorMessage(error)); this.loading.set(false);
      },
    });
  }

  private syncEditor() {
    const data = this.data();
    this.editStatuses = {};
    this.editNotes = {};
    if (!data) return;
    for (const record of data.records.filter((item) => item.date.slice(0, 10) === this.selectedDate())) {
      this.editStatuses[record.studentId] = record.status;
      this.editNotes[record.studentId] = record.notes ?? '';
    }
  }
  totalFor(status: StudentAttendanceStatus) { return this.data()?.records.filter((item) => item.status === status).length ?? 0; }
  statusLabel(status: StudentAttendanceStatus) { return statusOptions.find((item) => item.value === status)?.label ?? status; }
  studentName(studentId: string) { return this.data()?.students.find((item) => item.id === studentId)?.fullName ?? 'Siswa'; }
  existingRecord(studentId: string) { return this.data()?.records.find((item) => item.studentId === studentId && item.date.slice(0, 10) === this.selectedDate()); }
  canMarkLate(record: StudentAttendanceResponse['records'][number]) {
    const role = this.auth.user()?.role;
    const today = this.data()?.todayDate;
    return Boolean(role && today && canMarkStudentLate(record.status, this.selectedDate(), today, role));
  }
  attendanceNote(notes: string | null, lateArrivalAt: string | null) {
    if (!lateArrivalAt) return notes || '—';
    const time = new Intl.DateTimeFormat('id-ID', { timeZone: this.data()?.timezone ?? 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(lateArrivalAt));
    return `Datang terlambat pukul ${time}.` + (notes ? ` ${notes}` : '');
  }
  pendingRecords() {
    const data = this.data();
    if (!data) return [];
    return pendingAttendanceEntries(data, this.selectedDate(), this.auth.user()?.role ?? 'TEACHER', this.editStatuses, this.editNotes);
  }

  save() {
    const data = this.data();
    if (!data?.canEdit || this.saving()) return;
    const records = this.pendingRecords();
    if (!records.length) { this.error.set('Belum ada perubahan absensi untuk disimpan.'); return; }
    this.error.set(''); this.saving.set(true);
    this.http.put('/api/v1/student-attendance/records', { classId: this.classId(), academicPeriodId: this.periodId(), date: this.selectedDate(), records })
      .pipe(finalize(() => this.saving.set(false))).subscribe({
        next: () => { this.message.set(`${records.length} absensi siswa berhasil disimpan.`); this.month.set(this.selectedDate().slice(0, 7)); this.load(); },
        error: (error) => this.error.set(errorMessage(error)),
      });
  }

  markLate(studentId: string) {
    const record = this.existingRecord(studentId);
    if (!record || !this.canMarkLate(record) || this.lateSaving() || this.saving()) return;
    const studentName = this.studentName(studentId);
    if (!window.confirm(`Tandai ${studentName} datang terlambat hari ini? Waktu kedatangan akan dicatat otomatis.`)) return;
    this.error.set(''); this.lateSaving.set(studentId);
    this.http.patch(`/api/v1/student-attendance/records/${studentId}/late`, {
      classId: this.classId(), academicPeriodId: this.periodId(), date: this.selectedDate(),
    }).pipe(finalize(() => this.lateSaving.set(''))).subscribe({
      next: () => { this.message.set(`${studentName} berhasil ditandai terlambat.`); this.load(); },
      error: (error) => this.error.set(errorMessage(error)),
    });
  }
}
