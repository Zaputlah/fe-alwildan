import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ReferenceData, TeacherAttendanceRecord, TeacherAttendanceResponse, TeacherAttendanceStatus } from '../../core/models';
import { errorMessage } from '../../core/security.interceptor';

type AttendanceCardKey = TeacherAttendanceStatus | 'PENDING' | 'REJECTED' | 'EARLY';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  template: `
    <div class="page-heading"><div><span class="eyebrow">Kehadiran pegawai</span><h1>Absensi Guru</h1><p>Check-in, check-out, lokasi, dan rekap kehadiran bulanan.</p></div>@if (isAdmin) { <button class="btn btn--primary" (click)="openRecord()">+ Catat absensi</button> }</div>
    @if (message()) { <div class="alert alert--success">{{ message() }}</div> }
    @if (error()) { <div class="alert alert--error">{{ error() }}</div> }

    @if (!isAdmin) {
      <section class="attendance-hero panel">
        <div><span class="eyebrow">Waktu sekolah · WIB</span><strong class="live-clock">{{ schoolTime(now(), true) }}</strong><p>{{ schoolDateLabel(now()) }}</p><small class="attendance-location-hint">Izinkan akses lokasi saat absen untuk menyimpan titik GPS.</small></div>
        <div class="today-state">
          @if (data()?.today; as today) {
            <span class="status" [class.status--published]="today.status === 'PRESENT'">{{ statusLabel(today.status) }}</span>
            @if (today.approvalStatus) { <span [class]="'attendance-approval attendance-approval--' + today.approvalStatus.toLowerCase()">{{ approvalLabel(today.approvalStatus) }}</span> }
            <div class="today-times"><span><small>Masuk</small><strong>{{ today.checkInAt ? schoolTime(today.checkInAt) : '—' }}</strong></span><span><small>Pulang</small><strong>{{ today.checkOutAt ? schoolTime(today.checkOutAt) : '—' }}</strong></span></div>
            @if (today.isEarlyCheckout) { <small class="attendance-early">Pulang terlalu cepat (sebelum {{ data()?.earlyCheckoutBefore }} WIB)</small> }
          } @else { <span class="muted">Belum melakukan check-in hari ini.</span> }
        </div>
        <div class="attendance-actions"><button class="btn btn--primary" (click)="checkIn()" [disabled]="loading() || (!!data()?.today && data()?.today?.approvalStatus !== 'REJECTED')">Check-in</button><button class="btn btn--secondary" (click)="checkOut()" [disabled]="loading() || !data()?.today?.checkInAt || !!data()?.today?.checkOutAt">Check-out</button><button class="btn btn--secondary" (click)="openTeacherRequest()" [disabled]="loading()">Ajukan sakit / izin / tugas</button></div>
      </section>
    }

    <section class="attendance-filters panel">
      <label>Bulan<input type="month" [value]="month()" (change)="changeMonth($event)"></label>
      @if (isAdmin) { <label>Guru<select [value]="teacherId()" (change)="changeTeacher($event)"><option value="">Semua guru</option>@for (teacher of references()?.teachers ?? []; track teacher.id) { <option [value]="teacher.id">{{ teacher.fullName }}</option> }</select></label> }
    </section>

    @if (data(); as attendance) {
      <section class="attendance-summary">
        @for (item of summaryCards(attendance); track item.status) { <button type="button" class="attendance-stat panel" [class.attendance-stat--active]="selectedCard() === item.status" [attr.aria-pressed]="selectedCard() === item.status" [attr.aria-label]="'Lihat riwayat ' + item.label + ': ' + item.value" (click)="selectCard(item.status)"><span [class]="'attendance-dot attendance-dot--' + item.status.toLowerCase()"></span><div><small>{{ item.label }}</small><strong>{{ item.value }}</strong></div></button> }
      </section>
      <section class="panel table-panel" id="attendance-history">
        <div class="panel-heading master-heading"><div><h2>Riwayat kehadiran</h2><p>{{ filteredRecords(attendance.records).length }} dari {{ attendance.summary.total }} catatan pada {{ attendance.month }}@if (selectedCard()) { <span> · Filter: {{ selectedCardLabel() }}</span> }</p></div>@if (selectedCard()) { <button type="button" class="btn btn--secondary" (click)="selectedCard.set(null)">Tampilkan semua</button> }</div>
        <div class="table-scroll"><table><thead><tr>@if (isAdmin) { <th>Guru</th> }<th>Tanggal</th><th>Status</th><th>Persetujuan</th><th>Check-in</th><th>Check-out</th><th>Lokasi</th><th>Keterangan</th>@if (isAdmin) { <th>Tindakan</th> }</tr></thead><tbody>
          @for (record of filteredRecords(attendance.records); track record.id) {
            <tr>
              @if (isAdmin) { <td><strong>{{ record.teacher?.fullName }}</strong></td> }
              <td>{{ record.date | date:'dd MMM yyyy':'UTC' }}</td>
              <td><span [class]="'attendance-badge attendance-badge--' + record.status.toLowerCase()">{{ statusLabel(record.status) }}</span></td>
              <td><span [class]="'attendance-approval attendance-approval--' + (record.approvalStatus ?? 'final').toLowerCase()">{{ approvalLabel(record.approvalStatus) }}</span>@if (record.reviewNotes) { <small class="attendance-review-note">{{ record.reviewNotes }}</small> }</td>
              <td>{{ record.checkInAt ? schoolTime(record.checkInAt) : '—' }}</td>
              <td>{{ record.checkOutAt ? schoolTime(record.checkOutAt) : '—' }}</td>
              <td>
                <div class="attendance-locations">
                  @if (locationDetails(record, 'in'); as point) { <a [href]="point.url" target="_blank" rel="noopener noreferrer">Masuk: {{ point.coordinates }} · Peta</a> }
                  @if (locationDetails(record, 'out'); as point) { <a [href]="point.url" target="_blank" rel="noopener noreferrer">Pulang: {{ point.coordinates }} · Peta</a> }
                  @if (record.checkInLatitude === null && record.checkOutLatitude === null) { <span>—</span> }
                </div>
              </td>
              <td><div class="attendance-notes">@for (remark of record.remarks; track $index) { <span [class.attendance-early]="remark.startsWith('Pulang terlalu cepat')">{{ remark }}</span> }@if (record.evidence) { <button type="button" class="btn btn--secondary btn--small attendance-evidence-button" [disabled]="downloadingEvidenceId() === record.id" [title]="record.evidence.fileName" (click)="downloadEvidence(record)">{{ downloadingEvidenceId() === record.id ? 'Mengunduh...' : record.status === 'DUTY' ? 'Unduh surat tugas' : record.status === 'SICK' ? 'Unduh bukti sakit' : 'Unduh bukti izin' }}</button> }</div></td>
              @if (isAdmin) { <td class="actions">@if (record.approvalStatus === 'PENDING') { <button class="btn btn--primary" [disabled]="loading()" (click)="reviewRequest(record, 'APPROVED')">Setujui</button><button class="btn btn--secondary" [disabled]="loading()" (click)="reviewRequest(record, 'REJECTED')">Tolak</button> } @else { <button class="icon-button" (click)="openRecord(record)" aria-label="Ubah absensi">✎</button><button class="icon-button icon-button--danger" (click)="remove(record)" aria-label="Hapus absensi">×</button> }</td> }
            </tr>
          } @empty { <tr><td [attr.colspan]="isAdmin ? 9 : 8" class="empty-state">{{ selectedCard() ? 'Tidak ada catatan untuk kategori ini pada periode terpilih.' : 'Belum ada catatan absensi pada periode ini.' }}</td></tr> }
        </tbody></table></div>
      </section>
    }

    @if (showForm()) {
      <div class="modal-backdrop" (click)="showForm.set(false)"><form class="modal" [formGroup]="form" (ngSubmit)="saveRecord()" (click)="$event.stopPropagation()">
        <div class="modal-heading"><div><span class="eyebrow">Koreksi Admin</span><h2>Catat absensi Guru</h2></div><button type="button" class="modal-close" (click)="showForm.set(false)">×</button></div>
        @if (error()) { <div class="alert alert--error">{{ error() }}</div> }
        <div class="form-grid"><label>Guru<select formControlName="teacherId"><option value="">Pilih guru</option>@for (teacher of references()?.teachers ?? []; track teacher.id) { <option [value]="teacher.id">{{ teacher.fullName }}</option> }</select></label><label>Tanggal<input type="date" formControlName="date"></label><label>Status<select formControlName="status" (change)="onAdminStatusChange()"><option value="PRESENT">Hadir</option><option value="LATE">Terlambat</option><option value="SICK">Sakit</option><option value="LEAVE">Izin</option><option value="DUTY">Tugas sekolah/dinas</option><option value="ABSENT">Alpa</option></select></label><label>Waktu masuk<input type="datetime-local" formControlName="checkInAt"></label><label>Waktu pulang<input type="datetime-local" formControlName="checkOutAt"></label><label>Catatan<input formControlName="notes" placeholder="Keterangan opsional"></label>@if (requiresEvidence(form.controls.status.value)) { <label class="span-2">{{ form.controls.status.value === 'DUTY' ? 'Surat tugas' : 'Bukti sakit/izin' }} (PDF, JPG, PNG; maks. 5 MB)<input type="file" accept=".pdf,.jpg,.jpeg,.png" (change)="selectEvidence($event, 'admin')"><small>{{ existingAdminEvidence() ? 'Bukti lama tetap berlaku jika tidak diganti.' : 'Wajib dilampirkan sebelum disimpan.' }}</small></label> }</div>
        <div class="modal-actions"><button type="button" class="btn btn--secondary" (click)="showForm.set(false)">Batal</button><button class="btn btn--primary" [disabled]="form.invalid || loading() || (requiresEvidence(form.controls.status.value) && !adminEvidenceFile() && !existingAdminEvidence())">Simpan absensi</button></div>
      </form></div>
    }

    @if (showTeacherRequest()) {
      <div class="modal-backdrop" (click)="showTeacherRequest.set(false)"><form class="modal" [formGroup]="requestForm" (ngSubmit)="submitTeacherRequest()" (click)="$event.stopPropagation()">
        <div class="modal-heading"><div><span class="eyebrow">Pengajuan Guru</span><h2>Sakit, izin, atau tugas</h2><p>Lampirkan bukti. Pengajuan menunggu persetujuan Admin sebelum masuk rekap absensi.</p></div><button type="button" class="modal-close" (click)="showTeacherRequest.set(false)">×</button></div>
        @if (error()) { <div class="alert alert--error">{{ error() }}</div> }
        <div class="form-grid">
          <label>Jenis<select formControlName="status"><option value="SICK">Sakit</option><option value="LEAVE">Izin pribadi</option><option value="DUTY">Tugas sekolah/dinas</option></select></label>
          <label>Tanggal<input type="date" formControlName="date"></label>
          <label class="span-2">Alasan singkat<input formControlName="notes" placeholder="Contoh: Sakit dan perlu istirahat"></label>
          <label class="span-2">{{ requestForm.controls.status.value === 'DUTY' ? 'Surat tugas wajib' : 'Bukti wajib' }} (PDF, JPG, PNG; maks. 5 MB)<input type="file" accept=".pdf,.jpg,.jpeg,.png" (change)="selectEvidence($event, 'teacher')"></label>
        </div>
        <div class="modal-actions"><button type="button" class="btn btn--secondary" (click)="showTeacherRequest.set(false)">Batal</button><button class="btn btn--primary" [disabled]="requestForm.invalid || !teacherEvidenceFile() || loading()">Kirim pengajuan</button></div>
      </form></div>
    }
  `,
})
export class TeacherAttendanceComponent {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  readonly data = signal<TeacherAttendanceResponse | null>(null);
  readonly references = signal<ReferenceData | null>(null);
  readonly month = signal(this.localDateInput(new Date()).slice(0, 7));
  readonly teacherId = signal('');
  readonly selectedCard = signal<AttendanceCardKey | null>(null);
  readonly now = signal(new Date());
  readonly showForm = signal(false);
  readonly showTeacherRequest = signal(false);
  readonly teacherEvidenceFile = signal<File | null>(null);
  readonly adminEvidenceFile = signal<File | null>(null);
  readonly downloadingEvidenceId = signal<string | null>(null);
  readonly editingRecord = signal<TeacherAttendanceRecord | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly form = this.fb.nonNullable.group({
    teacherId: ['', Validators.required], date: ['', Validators.required],
    status: ['PRESENT' as TeacherAttendanceStatus, Validators.required], checkInAt: [''], checkOutAt: [''], notes: [''],
  });
  readonly requestForm = this.fb.nonNullable.group({
    status: ['SICK' as 'SICK' | 'LEAVE' | 'DUTY', Validators.required],
    date: ['', Validators.required],
    notes: ['', [Validators.required, Validators.minLength(5)]],
  });
  get isAdmin() { return this.auth.user()?.role === 'ADMIN'; }

  constructor() {
    const timer = setInterval(() => this.now.set(new Date()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    if (this.isAdmin) {
      forkJoin({ data: this.fetch(), references: this.http.get<ReferenceData>('/api/v1/reference-data') }).subscribe({
        next: ({ data, references }) => { this.data.set(data); this.references.set(references); }, error: (error) => this.error.set(errorMessage(error)),
      });
    } else this.load();
  }
  private fetch() {
    const params: Record<string, string> = { month: this.month() };
    if (this.teacherId()) params['teacherId'] = this.teacherId();
    return this.http.get<TeacherAttendanceResponse>('/api/v1/teacher-attendance', { params });
  }
  load() { this.fetch().subscribe({ next: (data) => this.data.set(data), error: (error) => this.error.set(errorMessage(error)) }); }
  changeMonth(event: Event) { this.month.set((event.target as HTMLInputElement).value); this.load(); }
  changeTeacher(event: Event) { this.teacherId.set((event.target as HTMLSelectElement).value); this.load(); }
  statusLabel(status: TeacherAttendanceStatus) { return ({ PRESENT: 'Hadir', LATE: 'Terlambat', SICK: 'Sakit', LEAVE: 'Izin', DUTY: 'Tugas sekolah/dinas', ABSENT: 'Alpa' })[status]; }
  approvalLabel(status: TeacherAttendanceRecord['approvalStatus']) {
    return ({ PENDING: 'Menunggu Admin', APPROVED: 'Disetujui', REJECTED: 'Ditolak', final: 'Final' })[status ?? 'final'];
  }
  summaryCards(data: TeacherAttendanceResponse): { status: AttendanceCardKey; label: string; value: number }[] {
    return [
      ...(['PRESENT', 'LATE', 'SICK', 'LEAVE', 'DUTY', 'ABSENT'] as TeacherAttendanceStatus[])
        .map((status) => ({ status, label: this.statusLabel(status), value: data.summary[status] })),
      { status: 'PENDING', label: 'Menunggu Admin', value: data.summary.pending },
      { status: 'REJECTED', label: 'Ditolak', value: data.summary.rejected },
      { status: 'EARLY', label: 'Pulang cepat', value: data.summary.earlyCheckout },
    ];
  }
  selectCard(status: AttendanceCardKey) {
    this.selectedCard.set(this.selectedCard() === status ? null : status);
    requestAnimationFrame(() => document.getElementById('attendance-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  selectedCardLabel() {
    const selected = this.selectedCard();
    return selected === 'PENDING' ? 'Menunggu Admin' : selected === 'REJECTED' ? 'Ditolak' : selected === 'EARLY' ? 'Pulang cepat' : selected ? this.statusLabel(selected) : '';
  }
  filteredRecords(records: TeacherAttendanceRecord[]) {
    const selected = this.selectedCard();
    if (!selected) return records;
    if (selected === 'PENDING') return records.filter((record) => record.approvalStatus === 'PENDING');
    if (selected === 'REJECTED') return records.filter((record) => record.approvalStatus === 'REJECTED');
    if (selected === 'EARLY') return records.filter((record) => record.isEarlyCheckout);
    return records.filter((record) => record.status === selected && record.approvalStatus !== 'PENDING' && record.approvalStatus !== 'REJECTED');
  }
  schoolTime(value: string | Date, withSeconds = false) {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: this.data()?.timezone ?? 'Asia/Jakarta',
      hour: '2-digit', minute: '2-digit', ...(withSeconds ? { second: '2-digit' } : {}),
      hourCycle: 'h23',
    }).format(new Date(value));
  }
  schoolDateLabel(value: Date) {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: this.data()?.timezone ?? 'Asia/Jakarta',
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    }).format(value);
  }
  locationDetails(record: TeacherAttendanceRecord, kind: 'in' | 'out') {
    const latitude = kind === 'in' ? record.checkInLatitude : record.checkOutLatitude;
    const longitude = kind === 'in' ? record.checkInLongitude : record.checkOutLongitude;
    if (latitude === null || longitude === null) return null;
    const coordinates = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    return { coordinates, url: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}` };
  }
  evidenceUrl(record: TeacherAttendanceRecord) {
    return `/api/v1/teacher-attendance/records/${record.id}/evidence`;
  }
  downloadEvidence(record: TeacherAttendanceRecord) {
    if (!record.evidence || this.downloadingEvidenceId()) return;
    this.downloadingEvidenceId.set(record.id);
    this.error.set('');
    this.http.get(this.evidenceUrl(record), { responseType: 'blob' })
      .pipe(finalize(() => this.downloadingEvidenceId.set(null)))
      .subscribe({
        next: (file) => {
          const url = URL.createObjectURL(file);
          const link = document.createElement('a');
          link.href = url;
          link.download = record.evidence!.fileName;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 30_000);
        },
        error: (error) => this.error.set(errorMessage(error)),
      });
  }
  requiresEvidence(status: TeacherAttendanceStatus) {
    return status === 'SICK' || status === 'LEAVE' || status === 'DUTY';
  }
  existingAdminEvidence() {
    const record = this.editingRecord();
    return !!record?.evidence
      && record.status === this.form.controls.status.value
      && record.teacherId === this.form.controls.teacherId.value
      && record.date.slice(0, 10) === this.form.controls.date.value;
  }
  onAdminStatusChange() {
    if (!this.requiresEvidence(this.form.controls.status.value)) this.adminEvidenceFile.set(null);
  }
  selectEvidence(event: Event, target: 'teacher' | 'admin') {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (file && (file.size > 5 * 1024 * 1024 || !/\.(pdf|jpe?g|png)$/i.test(file.name))) {
      this.error.set('Bukti harus berupa PDF, JPG, atau PNG dengan ukuran maksimal 5 MB.');
      input.value = '';
      (target === 'teacher' ? this.teacherEvidenceFile : this.adminEvidenceFile).set(null);
      return;
    }
    this.error.set('');
    (target === 'teacher' ? this.teacherEvidenceFile : this.adminEvidenceFile).set(file);
  }
  openTeacherRequest() {
    this.error.set('');
    this.teacherEvidenceFile.set(null);
    this.requestForm.reset({ status: 'SICK', date: this.localDateInput(new Date()).slice(0, 10), notes: '' });
    this.showTeacherRequest.set(true);
  }
  submitTeacherRequest() {
    const file = this.teacherEvidenceFile();
    if (this.requestForm.invalid || !file || this.loading()) return;
    const raw = this.requestForm.getRawValue();
    const payload = new FormData();
    payload.append('status', raw.status);
    payload.append('date', raw.date);
    payload.append('notes', raw.notes);
    payload.append('evidence', file);
    this.loading.set(true);
    this.error.set('');
    this.http.post('/api/v1/teacher-attendance/requests', payload)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          this.showTeacherRequest.set(false);
          this.teacherEvidenceFile.set(null);
          this.message.set('Pengajuan dan berkas berhasil dikirim. Menunggu persetujuan Admin.');
          this.load();
        },
        error: (error) => this.error.set(errorMessage(error)),
      });
  }
  checkIn() { this.action('/check-in', 'Check-in berhasil dicatat.'); }
  checkOut() { this.action('/check-out', 'Check-out berhasil dicatat.'); }
  private async deviceLocation(): Promise<{ latitude: number; longitude: number; accuracyMeters: number } | null> {
    if (!navigator.geolocation) return null;
    return new Promise((resolve) => navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    ));
  }
  private async action(path: string, success: string) {
    if (this.loading()) return;
    this.loading.set(true); this.error.set('');
    const location = await this.deviceLocation();
    this.http.post(`/api/v1/teacher-attendance${path}`, location ? { location } : {})
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          this.message.set(location ? success : `${success} Lokasi tidak tersimpan karena izin atau GPS tidak tersedia.`);
          this.load();
        },
        error: (error) => this.error.set(errorMessage(error)),
      });
  }
  openRecord(record?: TeacherAttendanceRecord) {
    const toLocalInput = (value: string | null) => value ? this.localDateInput(new Date(value)) : '';
    this.editingRecord.set(record ?? null);
    this.adminEvidenceFile.set(null);
    this.form.reset({ teacherId: record?.teacherId ?? this.teacherId(), date: record?.date.slice(0, 10) ?? this.localDateInput(new Date()).slice(0, 10), status: record?.status ?? 'PRESENT', checkInAt: toLocalInput(record?.checkInAt ?? null), checkOutAt: toLocalInput(record?.checkOutAt ?? null), notes: record?.notes ?? '' });
    this.showForm.set(true); this.error.set('');
  }
  saveRecord() {
    if (this.form.invalid || (this.requiresEvidence(this.form.controls.status.value) && !this.adminEvidenceFile() && !this.existingAdminEvidence())) return;
    const raw = this.form.getRawValue();
    const recordData = { ...raw, checkInAt: raw.checkInAt ? new Date(raw.checkInAt).toISOString() : null, checkOutAt: raw.checkOutAt ? new Date(raw.checkOutAt).toISOString() : null, notes: raw.notes || null };
    const payload = new FormData();
    payload.append('data', JSON.stringify(recordData));
    if (this.adminEvidenceFile()) payload.append('evidence', this.adminEvidenceFile()!);
    this.loading.set(true);
    this.http.put('/api/v1/teacher-attendance/records', payload).pipe(finalize(() => this.loading.set(false))).subscribe({ next: () => { this.showForm.set(false); this.message.set('Absensi berhasil disimpan.'); this.load(); }, error: (error) => this.error.set(errorMessage(error)) });
  }
  reviewRequest(record: TeacherAttendanceRecord, decision: 'APPROVED' | 'REJECTED') {
    const notes = decision === 'REJECTED' ? prompt('Alasan penolakan (wajib diisi):')?.trim() : undefined;
    if (decision === 'REJECTED' && !notes) return;
    this.loading.set(true);
    this.error.set('');
    this.http.patch(`/api/v1/teacher-attendance/requests/${record.id}/review`, { decision, notes })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => { this.message.set(decision === 'APPROVED' ? 'Pengajuan disetujui.' : 'Pengajuan ditolak.'); this.load(); },
        error: (error) => this.error.set(errorMessage(error)),
      });
  }
  remove(record: TeacherAttendanceRecord) {
    if (!confirm('Hapus catatan absensi ini?')) return;
    this.http.delete(`/api/v1/teacher-attendance/records/${record.id}`).subscribe({ next: () => { this.message.set('Catatan absensi dihapus.'); this.load(); }, error: (error) => this.error.set(errorMessage(error)) });
  }
  private localDateInput(date: Date) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  }
}
