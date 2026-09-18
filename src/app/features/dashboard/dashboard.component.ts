import { HttpClient } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { academicPeriodLabel } from '../../core/academic-period';
import { AuthService } from '../../core/auth.service';
import { AcademicPeriod } from '../../core/models';
import { schoolGreeting } from '../../core/school-greeting';
import { errorMessage } from '../../core/security.interceptor';

interface TeacherOverview {
  subjects: { name: string; classes: string[] }[];
  homeroomClasses: string[];
  teachingClassCount: number;
  todayWeekday: number;
  todaySchedule: { id: string; startMinute: number; endMinute: number; room: string | null; teachingAssignment: { class: { name: string }; subject: { name: string } } }[];
}

interface DashboardData {
  currentPeriod: AcademicPeriod | null;
  timezone: string;
  teacherOverview: TeacherOverview | null;
  summary: { students: number; classes: number; assessments: number; published: number; average: number; completionRate: number; passRate: number };
  distribution: { label: string; count: number }[];
}

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page-heading">
      <div>
        <span class="eyebrow">{{ isTeacher() ? 'Ruang kerja Guru' : 'Ringkasan akademik' }}</span>
        @if (isTeacher()) {
          <h1>Selamat {{ greeting() }}, {{ auth.user()?.fullName }}</h1>
          <p>Lihat kelas dan mata pelajaran yang Anda ampu pada semester berjalan.</p>
        } @else {
          <h1>Dashboard Admin</h1>
          <p>Pantau progres penilaian dan capaian siswa di unit sekolah.</p>
        }
      </div>
      @if (data()?.currentPeriod; as period) { <span class="period-chip">{{ academicPeriodLabel(period) }}</span> }
    </div>

    @if (loading()) { <div class="loading-card">Memuat ringkasan data…</div> }
    @else if (error()) { <div class="alert alert--error">{{ error() }}</div> }
    @else if (data(); as dashboard) {
      @if (isTeacher()) {
        @if (dashboard.teacherOverview; as teacher) {
          <section class="stat-grid">
            <article class="stat-card"><span class="stat-icon stat-icon--blue">▤</span><div><small>Mata pelajaran diampu</small><strong>{{ teacher.subjects.length }}</strong><span>Semester berjalan</span></div></article>
            <article class="stat-card"><span class="stat-icon stat-icon--purple">▦</span><div><small>Kelas diajar</small><strong>{{ teacher.teachingClassCount }}</strong><span>Sesuai penugasan</span></div></article>
            <article class="stat-card"><span class="stat-icon stat-icon--green">♙</span><div><small>Siswa di kelas terkait</small><strong>{{ dashboard.summary.students }}</strong><span>Siswa aktif</span></div></article>
            <article class="stat-card"><span class="stat-icon stat-icon--orange">✓</span><div><small>Penilaian saya</small><strong>{{ dashboard.summary.assessments }}</strong><span>{{ dashboard.summary.published }} diterbitkan</span></div></article>
          </section>
          <section class="panel teacher-today-panel">
            <div class="panel-heading"><div><span class="eyebrow">Hari ini</span><h2>Jadwal mengajar {{ dayName(teacher.todayWeekday) }}</h2><p>{{ teacher.todaySchedule.length }} sesi mengajar hari ini</p></div><a class="btn btn--secondary btn--small" routerLink="/teacher-schedule">Lihat semua jadwal</a></div>
            @for (slot of teacher.todaySchedule; track slot.id) {
              <div class="schedule-row"><strong class="schedule-time">{{ time(slot.startMinute) }}–{{ time(slot.endMinute) }}</strong><div class="schedule-detail"><strong>{{ slot.teachingAssignment.subject.name }}</strong><span>Kelas {{ slot.teachingAssignment.class.name }}@if (slot.room) { · Ruang {{ slot.room }} }</span></div></div>
            } @empty { <p class="schedule-empty">Hari ini Anda tidak memiliki jadwal mengajar.</p> }
          </section>
          <div class="teacher-dashboard-grid">
            <section class="panel teacher-dashboard-panel">
              <span class="eyebrow">Penugasan mengajar</span><h2>Mata pelajaran yang Anda ajar</h2>
              @for (subject of teacher.subjects; track subject.name) {
                <div class="teacher-subject-row"><strong>{{ subject.name }}</strong><span>Kelas {{ subject.classes.join(', ') }}</span></div>
              } @empty { <p>Belum ada mata pelajaran yang ditugaskan pada semester ini.</p> }
            </section>
            @if (teacher.homeroomClasses.length) {
              <section class="panel teacher-dashboard-panel">
                <span class="eyebrow">Tugas wali kelas</span><h2>Anda wali kelas</h2>
                <div class="teacher-homeroom-list">
                  @for (className of teacher.homeroomClasses; track className) { <span class="class-chip">Kelas {{ className }}</span> }
                </div>
                <p>Sebagai wali kelas, Anda dapat melihat nilai yang telah diterbitkan guru lain di kelas ini melalui Rekap Nilai.</p>
              </section>
            }
          </div>
        }
      } @else {
        <section class="stat-grid">
          <article class="stat-card"><span class="stat-icon stat-icon--blue">♙</span><div><small>Siswa aktif</small><strong>{{ dashboard.summary.students }}</strong><span>Terdaftar di unit ini</span></div></article>
          <article class="stat-card"><span class="stat-icon stat-icon--purple">▦</span><div><small>Rombongan belajar</small><strong>{{ dashboard.summary.classes }}</strong><span>Terdaftar di unit ini</span></div></article>
          <article class="stat-card"><span class="stat-icon stat-icon--orange">✓</span><div><small>Assessment</small><strong>{{ dashboard.summary.assessments }}</strong><span>{{ dashboard.summary.published }} sudah diterbitkan</span></div></article>
          <article class="stat-card"><span class="stat-icon stat-icon--green">↗</span><div><small>Rata-rata nilai</small><strong>{{ dashboard.summary.average }}</strong><span>{{ dashboard.summary.passRate }}% mencapai KKM</span></div></article>
        </section>
        <section class="dashboard-grid">
          <article class="panel chart-panel">
            <div class="panel-heading"><div><h2>Distribusi nilai</h2><p>Persentase nilai seluruh assessment</p></div><span class="legend-dot">Jumlah siswa</span></div>
            <div class="bar-chart">
              @for (item of dashboard.distribution; track item.label) {
                <div class="bar-column"><span class="bar-value">{{ item.count }}</span><div class="bar" [style.height.%]="barHeight(item.count)"></div><small>{{ item.label }}</small></div>
              }
            </div>
          </article>
          <article class="panel progress-panel">
            <div class="panel-heading"><div><h2>Progres publikasi</h2><p>Kelengkapan penilaian</p></div></div>
            <div class="progress-ring" [style.--progress]="dashboard.summary.completionRate + '%'"><div><strong>{{ dashboard.summary.completionRate }}%</strong><small>Selesai</small></div></div>
            <div class="progress-note"><span><i class="dot dot--green"></i>Diterbitkan <strong>{{ dashboard.summary.published }}</strong></span><span><i class="dot dot--gray"></i>Draft <strong>{{ dashboard.summary.assessments - dashboard.summary.published }}</strong></span></div>
          </article>
        </section>
      }
    }
  `,
})
export class DashboardComponent {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  readonly auth = inject(AuthService);
  readonly academicPeriodLabel = academicPeriodLabel;
  readonly data = signal<DashboardData | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly now = signal(new Date());
  readonly isTeacher = computed(() => this.auth.user()?.role === 'TEACHER');
  readonly greeting = computed(() => schoolGreeting(this.now(), this.data()?.timezone ?? 'Asia/Jakarta'));
  readonly maxCount = computed(() => Math.max(1, ...(this.data()?.distribution.map((item) => item.count) ?? [1])));
  readonly dayName = (day: number) => ['','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'][day] ?? '';
  readonly time = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

  constructor() {
    const clock = setInterval(() => this.now.set(new Date()), 60_000);
    this.destroyRef.onDestroy(() => clearInterval(clock));
    this.http.get<DashboardData>('/api/v1/dashboard').subscribe({
      next: (data) => { this.data.set(data); this.loading.set(false); },
      error: (error) => { this.error.set(errorMessage(error)); this.loading.set(false); },
    });
  }

  barHeight(count: number) { return Math.max(4, count / this.maxCount() * 100); }
}
