import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { academicPeriodLabel } from '../../core/academic-period';
import { AuthService } from '../../core/auth.service';
import { ReferenceData, TeacherScheduleResponse, TeacherScheduleSlot } from '../../core/models';
import { errorMessage } from '../../core/security.interceptor';
import { calendarDays, dateLabel, monthLabel, shiftMonth, slotsForDate } from './calendar';

const days = [
  { number: 1, name: 'Senin' }, { number: 2, name: 'Selasa' }, { number: 3, name: 'Rabu' },
  { number: 4, name: 'Kamis' }, { number: 5, name: 'Jumat' }, { number: 6, name: 'Sabtu' }, { number: 7, name: 'Minggu' },
];

function timeLabel(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="page-heading"><div><span class="eyebrow">Kegiatan belajar</span><h1>Jadwal Guru</h1><p>{{ isAdmin() ? 'Atur jadwal mengajar guru sesuai penugasan kelas dan semester.' : 'Lihat jadwal mengajar Anda pada setiap tanggal di kalender.' }}</p></div></div>
    @if (message()) { <div class="alert alert--success">{{ message() }}</div> }
    @if (error()) { <div class="alert alert--error">{{ error() }}</div> }

    <section class="panel schedule-toolbar">
      <label>Semester
        <select [value]="selectedPeriodId()" (change)="changePeriod($event)">
          @for (period of data()?.periods ?? []; track period.id) { <option [value]="period.id">{{ periodLabel(period) }}</option> }
        </select>
      </label>
      <span class="schedule-timezone">Waktu sekolah: {{ data()?.timezone ?? 'Asia/Jakarta' }}</span>
      @if (isAdmin() && data()?.period) { <button class="btn btn--primary btn--small" (click)="openEditor()">+ Tambah jadwal</button> }
    </section>

    @if (loading()) { <div class="loading-card">Memuat jadwal...</div> }
    @else if (!data()?.period) { <div class="loading-card">Semester belum tersedia.</div> }
    @else if (isAdmin()) {
      <div class="schedule-days">
        @for (day of days; track day.number) {
          <section class="panel schedule-day" [class.schedule-day--today]="data()?.todayWeekday === day.number">
            <div class="schedule-day-heading"><h2>{{ day.name }}</h2>@if (data()?.todayWeekday === day.number) { <span class="schedule-today">Hari ini</span> }<small>{{ slotsFor(day.number).length }} jam mengajar</small></div>
            @for (slot of slotsFor(day.number); track slot.id) {
              <div class="schedule-row">
                <strong class="schedule-time">{{ time(slot.startMinute) }}–{{ time(slot.endMinute) }}</strong>
                <div class="schedule-detail"><strong>{{ slot.teachingAssignment.subject.name }}</strong><span>Kelas {{ slot.teachingAssignment.class.name }}@if (slot.room) { · Ruang {{ slot.room }} }</span>@if (isAdmin()) { <small>{{ slot.teachingAssignment.teacher.fullName }}</small> }</div>
                @if (isAdmin()) { <div class="schedule-actions"><button type="button" class="icon-button" (click)="openEditor(slot)" aria-label="Ubah jadwal">✎</button><button type="button" class="icon-button icon-button--danger" (click)="remove(slot)" aria-label="Hapus jadwal">×</button></div> }
              </div>
            } @empty { <p class="schedule-empty">Tidak ada jadwal mengajar.</p> }
          </section>
        }
      </div>
    } @else {
      <section class="panel schedule-calendar">
        <div class="schedule-calendar-header">
          <div><span class="eyebrow">Kalender mengajar</span><h2>{{ monthName(calendarMonth()) }}</h2><p>Jadwal berulang setiap minggu selama semester yang dipilih.</p></div>
          <div class="schedule-calendar-navigation">
            <button type="button" class="btn btn--secondary btn--small" (click)="moveMonth(-1)" [disabled]="!canMoveMonth(-1)" aria-label="Bulan sebelumnya">‹</button>
            <button type="button" class="btn btn--secondary btn--small" (click)="goToToday()" [disabled]="!todayInPeriod()">Hari ini</button>
            <button type="button" class="btn btn--secondary btn--small" (click)="moveMonth(1)" [disabled]="!canMoveMonth(1)" aria-label="Bulan berikutnya">›</button>
          </div>
        </div>
        <div class="schedule-calendar-scroll">
          <div class="schedule-calendar-grid schedule-calendar-weekdays">
            @for (day of days; track day.number) { <span>{{ day.name }}</span> }
          </div>
          <div class="schedule-calendar-grid schedule-calendar-dates">
            @for (cell of calendar(); track cell?.date ?? $index) {
              @if (cell) {
                <button type="button" class="schedule-calendar-date" [class.schedule-calendar-date--today]="cell.isToday" [class.schedule-calendar-date--selected]="selectedDate() === cell.date" [class.schedule-calendar-date--outside]="!cell.inPeriod" [disabled]="!cell.inPeriod" [attr.aria-label]="dateName(cell.date) + ': ' + cell.slots.length + ' sesi mengajar'" (click)="selectedDate.set(cell.date)">
                  <span class="schedule-calendar-number">{{ cell.dayNumber }} @if (cell.isToday) { <small>Hari ini</small> }</span>
                  @for (slot of cell.slots; track slot.id) { <span class="schedule-calendar-event"><strong>{{ time(slot.startMinute) }}</strong> {{ slot.teachingAssignment.subject.name }} · {{ slot.teachingAssignment.class.name }}</span> }
                </button>
              } @else { <div class="schedule-calendar-blank" aria-hidden="true"></div> }
            }
          </div>
        </div>
      </section>
      <section class="panel schedule-selected-day">
        @if (selectedDate(); as date) {
          <div class="schedule-day-heading"><h2>{{ dateName(date) }}</h2><small>{{ selectedSlots().length }} sesi mengajar</small></div>
          @for (slot of selectedSlots(); track slot.id) {
            <div class="schedule-row"><strong class="schedule-time">{{ time(slot.startMinute) }}–{{ time(slot.endMinute) }}</strong><div class="schedule-detail"><strong>{{ slot.teachingAssignment.subject.name }}</strong><span>Kelas {{ slot.teachingAssignment.class.name }}@if (slot.room) { · Ruang {{ slot.room }} }</span></div></div>
          } @empty { <p class="schedule-empty">Tidak ada jadwal mengajar pada tanggal ini.</p> }
        } @else { <p class="schedule-empty">Pilih tanggal pada kalender untuk melihat rincian jadwal.</p> }
      </section>
    }

    @if (editorOpen()) {
      <div class="modal-backdrop" (click)="closeEditor()"><form class="modal" [formGroup]="form" (ngSubmit)="save()" (click)="$event.stopPropagation()">
        <div class="modal-heading"><div><span class="eyebrow">Jadwal mengajar</span><h2>{{ editingId() ? 'Ubah jadwal' : 'Tambah jadwal' }}</h2></div><button type="button" class="modal-close" (click)="closeEditor()" aria-label="Tutup">×</button></div>
        @if (error()) { <div class="alert alert--error">{{ error() }}</div> }
        <div class="form-grid">
          <label class="span-2">Guru · pelajaran · kelas<select formControlName="teachingAssignmentId"><option value="">Pilih penugasan</option>@for (assignment of availableAssignments(); track assignment.id) { <option [value]="assignment.id">{{ assignment.teacher.fullName }} · {{ assignment.subject.name }} · Kelas {{ assignment.class.name }}</option> }</select></label>
          <label>Hari<select formControlName="weekday">@for (day of days; track day.number) { <option [value]="day.number">{{ day.name }}</option> }</select></label>
          <label>Ruang (opsional)<input formControlName="room" maxlength="100" placeholder="Contoh: Lab IPA"></label>
          <label>Mulai<input type="time" formControlName="startTime"></label>
          <label>Selesai<input type="time" formControlName="endTime"></label>
        </div>
        <div class="modal-actions"><button type="button" class="btn btn--secondary" (click)="closeEditor()">Batal</button><button class="btn btn--primary" [disabled]="form.invalid || saving()">Simpan jadwal</button></div>
      </form></div>
    }
  `,
})
export class TeacherScheduleComponent {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);
  readonly isAdmin = computed(() => this.auth.user()?.role === 'ADMIN');
  readonly days = days;
  readonly periodLabel = academicPeriodLabel;
  readonly time = timeLabel;
  readonly monthName = monthLabel;
  readonly dateName = dateLabel;
  readonly data = signal<TeacherScheduleResponse | null>(null);
  readonly references = signal<ReferenceData | null>(null);
  readonly selectedPeriodId = signal('');
  readonly calendarMonth = signal('');
  readonly selectedDate = signal('');
  readonly calendar = computed(() => {
    const data = this.data();
    return data?.period && this.calendarMonth() ? calendarDays(this.calendarMonth(), data.period, data.slots, data.todayDate) : [];
  });
  readonly selectedSlots = computed(() => {
    const data = this.data();
    return data?.period && this.selectedDate() ? slotsForDate(this.selectedDate(), data.period, data.slots) : [];
  });
  readonly todayInPeriod = computed(() => {
    const data = this.data();
    return !!data?.period && data.todayDate >= data.period.startDate.slice(0, 10) && data.todayDate <= data.period.endDate.slice(0, 10);
  });
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly editorOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly availableAssignments = computed(() => (this.references()?.teachingAssignments ?? []).filter((item) => item.academicPeriodId === this.selectedPeriodId()));
  readonly form = this.fb.nonNullable.group({
    teachingAssignmentId: ['', Validators.required],
    weekday: [1, [Validators.required, Validators.min(1), Validators.max(7)]],
    startTime: ['07:00', Validators.required],
    endTime: ['08:00', Validators.required],
    room: [''],
  });

  constructor() {
    this.load();
    if (this.isAdmin()) this.http.get<ReferenceData>('/api/v1/reference-data').subscribe({ next: (data) => this.references.set(data), error: (error) => this.error.set(errorMessage(error)) });
  }

  load(periodId = this.selectedPeriodId()) {
    this.loading.set(true);
    const query = periodId ? `?periodId=${encodeURIComponent(periodId)}` : '';
    this.http.get<TeacherScheduleResponse>(`/api/v1/teacher-schedule${query}`).subscribe({
      next: (data) => {
        this.data.set(data);
        this.selectedPeriodId.set(data.period?.id ?? '');
        if (data.period) {
          const firstDate = this.todayInPeriod() ? data.todayDate : data.period.startDate.slice(0, 10);
          this.calendarMonth.set(firstDate.slice(0, 7));
          this.selectedDate.set(firstDate);
        }
        this.loading.set(false);
      },
      error: (error) => { this.error.set(errorMessage(error)); this.loading.set(false); },
    });
  }

  changePeriod(event: Event) { this.selectedPeriodId.set((event.target as HTMLSelectElement).value); this.load(); }
  canMoveMonth(offset: number) {
    const period = this.data()?.period;
    if (!period || !this.calendarMonth()) return false;
    const next = shiftMonth(this.calendarMonth(), offset);
    return next >= period.startDate.slice(0, 7) && next <= period.endDate.slice(0, 7);
  }
  moveMonth(offset: number) {
    if (!this.canMoveMonth(offset)) return;
    this.calendarMonth.set(shiftMonth(this.calendarMonth(), offset));
    this.selectedDate.set('');
  }
  goToToday() {
    if (!this.todayInPeriod()) return;
    const today = this.data()!.todayDate;
    this.calendarMonth.set(today.slice(0, 7));
    this.selectedDate.set(today);
  }
  slotsFor(day: number) { return this.data()?.slots.filter((slot) => slot.weekday === day) ?? []; }
  openEditor(slot?: TeacherScheduleSlot) {
    this.error.set('');
    this.editingId.set(slot?.id ?? null);
    this.form.reset({ teachingAssignmentId: slot?.teachingAssignmentId ?? '', weekday: slot?.weekday ?? 1, startTime: timeLabel(slot?.startMinute ?? 420), endTime: timeLabel(slot?.endMinute ?? 480), room: slot?.room ?? '' });
    this.editorOpen.set(true);
  }
  closeEditor() { this.editorOpen.set(false); }

  save() {
    if (this.form.invalid || this.saving()) return;
    const value = this.form.getRawValue();
    const toMinute = (time: string) => { const [hours, minutes] = time.split(':').map(Number); return hours * 60 + minutes; };
    const payload = { teachingAssignmentId: value.teachingAssignmentId, weekday: Number(value.weekday), startMinute: toMinute(value.startTime), endMinute: toMinute(value.endTime), room: value.room.trim() || null };
    if (payload.startMinute >= payload.endMinute) { this.error.set('Jam selesai harus setelah jam mulai.'); return; }
    this.saving.set(true);
    this.error.set('');
    const id = this.editingId();
    const request = id ? this.http.put(`/api/v1/teacher-schedule/${id}`, payload) : this.http.post('/api/v1/teacher-schedule', payload);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => { this.closeEditor(); this.message.set('Jadwal berhasil disimpan.'); this.load(); },
      error: (error) => this.error.set(errorMessage(error)),
    });
  }

  remove(slot: TeacherScheduleSlot) {
    if (!confirm(`Hapus jadwal ${slot.teachingAssignment.subject.name} kelas ${slot.teachingAssignment.class.name}?`)) return;
    this.error.set('');
    this.http.delete(`/api/v1/teacher-schedule/${slot.id}`).subscribe({
      next: () => { this.message.set('Jadwal berhasil dihapus.'); this.load(); },
      error: (error) => this.error.set(errorMessage(error)),
    });
  }
}
