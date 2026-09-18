import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ReferenceData, SchoolClass, Student } from '../../core/models';
import { errorMessage } from '../../core/security.interceptor';
import { academicPeriodLabel, currentAcademicPeriod } from '../../core/academic-period';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="page-heading">
      <div>
        <span class="eyebrow">Master data</span>
        <h1>Data Siswa</h1>
        <p>Kelola identitas dan penempatan siswa berdasarkan semester dan kelas.</p>
      </div>
      @if (isAdmin) { <button class="btn btn--primary" (click)="openForm()">+ Tambah siswa</button> }
    </div>

    @if (message()) { <div class="alert alert--success">{{ message() }}</div> }
    @if (error()) { <div class="alert alert--error">{{ error() }}</div> }

    <section class="panel table-panel">
      <form class="table-toolbar" [formGroup]="filters" (ngSubmit)="load()">
        <label class="student-filter">Semester
          <select formControlName="academicPeriodId" (change)="onPeriodChange()">
            <option value="">Semua semester</option>
            @for (period of references()?.periods ?? []; track period.id) {
              <option [value]="period.id">{{ academicPeriodLabel(period) }}</option>
            }
          </select>
        </label>
        <label class="student-filter">Kelas
          <select formControlName="classId" (change)="load()">
            <option value="">Semua kelas</option>
            @for (item of availableClasses(); track item.id) {
              <option [value]="item.id">Kelas {{ item.name }}</option>
            }
          </select>
        </label>
        <div class="search-box"><span>⌕</span><input formControlName="search" placeholder="Cari nama atau NIS…"></div>
        <button class="btn btn--secondary" type="submit">Cari</button>
        <span class="table-count">{{ total() }} siswa aktif</span>
      </form>

      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>Siswa</th><th>NIS</th><th>Semester</th><th>Kelas</th><th>Jenis kelamin</th><th>Kontak wali</th>@if (isAdmin) { <th></th> }</tr>
          </thead>
          <tbody>
            @for (student of students(); track student.id) {
              <tr>
                <td><div class="person-cell"><span class="student-avatar">{{ initials(student.fullName) }}</span><strong>{{ student.fullName }}</strong></div></td>
                <td><span class="mono">{{ student.nis }}</span></td>
                <td>{{ periodLabel(student) }}</td>
                <td><span class="class-chip">{{ student.enrollments[0]?.class?.name ?? '—' }}</span></td>
                <td>{{ student.gender === 'MALE' ? 'Laki-laki' : 'Perempuan' }}</td>
                <td><strong class="cell-main">{{ student.parentName || '—' }}</strong><small class="cell-sub">{{ student.parentPhone || '' }}</small></td>
                @if (isAdmin) {
                  <td class="actions"><button class="icon-button" (click)="openForm(student)" title="Ubah">✎</button><button class="btn btn--secondary btn--small" (click)="remove(student)">Nonaktifkan</button></td>
                }
              </tr>
            } @empty {
              <tr><td colspan="7" class="empty-state">Belum ada data siswa yang sesuai.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    @if (showForm()) {
      <div class="modal-backdrop" (click)="closeForm()">
        <form class="modal" [formGroup]="form" (ngSubmit)="save()" (click)="$event.stopPropagation()">
          <div class="modal-heading">
            <div><span class="eyebrow">{{ editingId() ? 'Perbarui data' : 'Siswa baru' }}</span><h2>{{ editingId() ? 'Ubah data siswa' : 'Tambah siswa' }}</h2></div>
            <button type="button" class="modal-close" (click)="closeForm()">×</button>
          </div>
          <div class="form-grid">
            <label>Semester
              <select formControlName="academicPeriodId" (change)="onFormPeriodChange()">
                <option value="">Pilih semester</option>
                @for (period of references()?.periods ?? []; track period.id) {
                  <option [value]="period.id">{{ academicPeriodLabel(period) }}</option>
                }
              </select>
            </label>
            <label>Kelas
              <select formControlName="classId" (change)="onFormClassChange()">
                <option value="">Pilih kelas</option>
                @for (item of availableFormClasses(); track item.id) {
                  <option [value]="item.id">Kelas {{ item.name }}</option>
                }
              </select>
            </label>
            <label>Nomor Induk Siswa<input formControlName="nis" readonly [placeholder]="form.controls.classId.value ? 'Menyiapkan NIS…' : 'Pilih kelas terlebih dahulu'"><small>NIS mengikuti kode kelas dan dibuat saat disimpan.</small></label>
            <label>Nama lengkap<input formControlName="fullName" placeholder="Nama sesuai dokumen"></label>
            <label>Jenis kelamin<select formControlName="gender"><option value="MALE">Laki-laki</option><option value="FEMALE">Perempuan</option></select></label>
            <label>Tanggal lahir<input type="date" formControlName="birthDate"></label>
            <label>Nama wali<input formControlName="parentName" placeholder="Nama orang tua/wali"></label>
            <label class="span-2">Nomor telepon wali<input formControlName="parentPhone" placeholder="0812xxxxxxxx"></label>
          </div>
          <div class="modal-actions"><button type="button" class="btn btn--secondary" (click)="closeForm()">Batal</button><button class="btn btn--primary" [disabled]="form.invalid || saving()">{{ saving() ? 'Menyimpan…' : 'Simpan data' }}</button></div>
        </form>
      </div>
    }
    @if (deactivationTarget(); as target) {
      <div class="modal-backdrop" (click)="closeDeactivation()">
        <form class="modal" [formGroup]="deactivationForm" (ngSubmit)="confirmDeactivation()" (click)="$event.stopPropagation()">
          <div class="modal-heading"><div><span class="eyebrow">Status siswa</span><h2>Nonaktifkan {{ target.fullName }}</h2><p>Data dan riwayat nilai tetap tersimpan.</p></div><button type="button" class="modal-close" (click)="closeDeactivation()">×</button></div>
          @if (error()) { <div class="alert alert--error">{{ error() }}</div> }
          <div class="form-grid"><label class="span-2">Alasan penonaktifan<textarea formControlName="reason" rows="4" maxlength="500" placeholder="Contoh: Pindah sekolah ke luar kota"></textarea><small>Wajib diisi, minimal 5 karakter. Alasan akan terlihat di menu Siswa Nonaktif.</small></label></div>
          <div class="modal-actions"><button type="button" class="btn btn--secondary" (click)="closeDeactivation()">Batal</button><button class="btn btn--primary" [disabled]="deactivationForm.invalid || saving()">{{ saving() ? 'Menyimpan…' : 'Nonaktifkan siswa' }}</button></div>
        </form>
      </div>
    }
  `,
})
export class StudentsComponent {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly students = signal<Student[]>([]);
  readonly references = signal<ReferenceData | null>(null);
  readonly total = signal(0);
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly deactivationTarget = signal<Student | null>(null);
  readonly deactivationForm = this.fb.nonNullable.group({ reason: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(500)]] });

  readonly filters = this.fb.nonNullable.group({
    search: [''],
    academicPeriodId: [''],
    classId: [''],
  });

  readonly form = this.fb.nonNullable.group({
    nis: [''],
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    gender: ['MALE' as 'MALE' | 'FEMALE', Validators.required],
    classId: ['', Validators.required],
    academicPeriodId: ['', Validators.required],
    birthDate: [''],
    parentName: [''],
    parentPhone: ['', Validators.pattern(/^\+?[0-9 -]{8,18}$/)],
  });

  get isAdmin() { return this.auth.user()?.role === 'ADMIN'; }

  constructor() {
    this.http.get<ReferenceData>('/api/v1/reference-data').subscribe({
      next: (references) => {
        this.references.set(references);
        const activePeriod = currentAcademicPeriod(references.periods);
        this.filters.controls.academicPeriodId.setValue(activePeriod?.id ?? '');
        this.load();
      },
      error: (error) => this.error.set(errorMessage(error)),
    });
  }

  private fetchStudents() {
    const { search, academicPeriodId, classId } = this.filters.getRawValue();
    return this.http.get<{ items: Student[]; pagination: { total: number } }>('/api/v1/students', {
      params: { search, academicPeriodId, classId },
    });
  }

  private applyList(response: { items: Student[]; pagination: { total: number } }) {
    this.students.set(response.items);
    this.total.set(response.pagination.total);
  }

  load() {
    this.error.set('');
    this.fetchStudents().subscribe({
      next: (data) => this.applyList(data),
      error: (error) => this.error.set(errorMessage(error)),
    });
  }

  availableClasses() {
    const periodId = this.filters.controls.academicPeriodId.value;
    const period = this.references()?.periods.find((item) => item.id === periodId);
    return (this.references()?.classes ?? []).filter((item) => !period || item.academicYear === period.name);
  }

  onPeriodChange() {
    const selectedClassId = this.filters.controls.classId.value;
    if (selectedClassId && !this.availableClasses().some((item) => item.id === selectedClassId)) {
      this.filters.controls.classId.setValue('');
    }
    this.load();
  }

  academicPeriodLabel = academicPeriodLabel;

  availableFormClasses() {
    const period = this.references()?.periods.find((item) => item.id === this.form.controls.academicPeriodId.value);
    return (this.references()?.classes ?? []).filter((item) => period && item.academicYear === period.name);
  }

  onFormPeriodChange() {
    this.form.controls.classId.setValue('');
    this.form.controls.nis.setValue('');
  }

  periodLabel(student: Student) {
    const period = student.enrollments[0]?.academicPeriod;
    return period ? academicPeriodLabel(period) : '—';
  }

  initials(name: string) {
    return name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }

  openForm(student?: Student) {
    this.error.set('');
    this.message.set('');
    this.editingId.set(student?.id ?? null);
    this.form.reset({
      nis: student?.nis ?? '',
      fullName: student?.fullName ?? '',
      gender: student?.gender ?? 'MALE',
      classId: student?.enrollments[0]?.class?.id ?? '',
      academicPeriodId: student?.enrollments[0]?.academicPeriodId ?? currentAcademicPeriod(this.references()?.periods ?? [])?.id ?? '',
      birthDate: student?.birthDate?.slice(0, 10) ?? '',
      parentName: student?.parentName ?? '',
      parentPhone: student?.parentPhone ?? '',
    });
    this.showForm.set(true);
  }

  onFormClassChange() {
    if (this.editingId()) return;
    const classId = this.form.controls.classId.value;
    this.form.controls.nis.setValue('');
    this.error.set('');
    if (!classId) return;
    this.http.get<{ nis: string }>('/api/v1/students/next-nis', { params: { classId } }).subscribe({
      next: ({ nis }) => {
        if (this.showForm() && !this.editingId() && this.form.controls.classId.value === classId) {
          this.form.controls.nis.setValue(nis);
        }
      },
      error: (error) => {
        if (this.showForm() && !this.editingId() && this.form.controls.classId.value === classId) {
          this.error.set(errorMessage(error));
        }
      },
    });
  }

  closeForm() { this.showForm.set(false); }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set('');
    const { nis: _previewNis, ...raw } = this.form.getRawValue();
    const payload = {
      ...raw,
      birthDate: raw.birthDate || null,
      parentName: raw.parentName || null,
      parentPhone: raw.parentPhone || null,
    };
    const request = this.editingId()
      ? this.http.patch(`/api/v1/students/${this.editingId()}`, payload)
      : this.http.post('/api/v1/students', payload);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.closeForm();
        this.message.set('Data siswa berhasil disimpan.');
        this.load();
      },
      error: (error) => this.error.set(errorMessage(error)),
    });
  }

  remove(student: Student) {
    this.error.set('');
    this.deactivationForm.reset({ reason: '' });
    this.deactivationTarget.set(student);
  }

  closeDeactivation() { if (!this.saving()) this.deactivationTarget.set(null); }

  confirmDeactivation() {
    const student = this.deactivationTarget();
    if (!student || this.deactivationForm.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.http.delete(`/api/v1/students/${student.id}`, { body: { reason: this.deactivationForm.controls.reason.value.trim() } }).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.deactivationTarget.set(null);
        this.message.set('Siswa berhasil dinonaktifkan.');
        this.load();
      },
      error: (error) => this.error.set(errorMessage(error)),
    });
  }
}
