import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AcademicPeriod, ReferenceData, SchoolClass, Subject } from '../../core/models';
import { academicPeriodLabel, currentAcademicPeriod } from '../../core/academic-period';
import { errorMessage } from '../../core/security.interceptor';

type EditorMode = 'class' | 'subject' | 'assignment' | null;

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="page-heading"><div><span class="eyebrow">Konfigurasi sekolah</span><h1>Master Data</h1><p>Kelola kelas dan mata pelajaran yang digunakan seluruh fitur.</p></div></div>
    @if (message()) { <div class="alert alert--success">{{ message() }}</div> }
    @if (error()) { <div class="alert alert--error">{{ error() }}</div> }

    <section class="master-grid">
      <article class="panel master-panel">
        <div class="panel-heading master-heading"><div><h2>Daftar kelas</h2><p>{{ references()?.classes?.length ?? 0 }} kelas tersimpan di database</p></div><button class="btn btn--primary btn--small" (click)="openClass()">+ Kelas</button></div>
        <div class="master-list">
          @for (item of references()?.classes ?? []; track item.id) {
            <div class="master-item"><span class="master-symbol">{{ item.gradeLevel }}</span><div><strong>Kelas {{ item.name }}</strong><small>Tahun ajaran {{ item.academicYear }}</small></div><div class="master-actions"><button class="icon-button" (click)="openClass(item)">✎</button><button class="icon-button icon-button--danger" (click)="removeClass(item)">×</button></div></div>
          } @empty { <div class="empty-state">Belum ada kelas. Tambahkan kelas pertama.</div> }
        </div>
      </article>

      <article class="panel master-panel">
        <div class="panel-heading master-heading"><div><h2>Mata pelajaran</h2><p>{{ references()?.subjects?.length ?? 0 }} mata pelajaran tersimpan</p></div><button class="btn btn--primary btn--small" (click)="openSubject()">+ Pelajaran</button></div>
        <div class="master-list">
          @for (item of references()?.subjects ?? []; track item.id) {
            <div class="master-item"><span class="master-symbol master-symbol--subject">{{ item.code.slice(0, 2) }}</span><div><strong>{{ item.name }}</strong><small>{{ item.code }} · KKM {{ item.passingGrade }}</small></div><div class="master-actions"><button class="icon-button" (click)="openSubject(item)">✎</button><button class="icon-button icon-button--danger" (click)="removeSubject(item)">×</button></div></div>
          } @empty { <div class="empty-state">Belum ada mata pelajaran.</div> }
        </div>
      </article>

      <article class="panel master-panel master-panel--wide">
        <div class="panel-heading master-heading"><div><h2>Penugasan guru</h2><p>Menentukan kelas dan pelajaran yang boleh dinilai Guru</p></div><button class="btn btn--primary btn--small" (click)="openAssignment()">+ Penugasan</button></div>
        <div class="master-list">
          @for (item of references()?.teachingAssignments ?? []; track item.id) {
            <div class="master-item"><span class="master-symbol master-symbol--teacher">{{ initials(item.teacher.fullName) }}</span><div><strong>{{ item.teacher.fullName }}</strong><small>{{ item.subject.name }} · Kelas {{ item.class.name }} · {{ periodLabel(item.academicPeriodId) }}</small></div><div class="master-actions"><button class="icon-button icon-button--danger" (click)="removeAssignment(item.id)">×</button></div></div>
          } @empty { <div class="empty-state">Belum ada penugasan guru.</div> }
        </div>
      </article>
    </section>

    @if (editor() === 'class') {
      <div class="modal-backdrop" (click)="closeEditor()"><form class="modal" [formGroup]="classForm" (ngSubmit)="saveClass()" (click)="$event.stopPropagation()">
        <div class="modal-heading"><div><span class="eyebrow">Master kelas</span><h2>{{ editingId() ? 'Ubah kelas' : 'Tambah kelas' }}</h2></div><button type="button" class="modal-close" (click)="closeEditor()">×</button></div>
        <div class="form-grid"><label>Nama kelas<input formControlName="name" placeholder="Contoh: 7B"></label><label>Tingkat<input type="number" min="1" max="12" formControlName="gradeLevel"></label><label>Tahun ajaran<select formControlName="academicYear"><option value="">Pilih tahun ajaran</option>@for (year of academicYears(); track year) { <option [value]="year">{{ year }}</option> }</select></label><label>Wali kelas<select formControlName="homeroomTeacherId"><option value="">Belum ditentukan</option>@for (teacher of references()?.teachers ?? []; track teacher.id) { <option [value]="teacher.id">{{ teacher.fullName }}</option> }</select></label></div>
        <div class="modal-actions"><button type="button" class="btn btn--secondary" (click)="closeEditor()">Batal</button><button class="btn btn--primary" [disabled]="classForm.invalid || saving()">Simpan kelas</button></div>
      </form></div>
    }

    @if (editor() === 'subject') {
      <div class="modal-backdrop" (click)="closeEditor()"><form class="modal" [formGroup]="subjectForm" (ngSubmit)="saveSubject()" (click)="$event.stopPropagation()">
        <div class="modal-heading"><div><span class="eyebrow">Master pelajaran</span><h2>{{ editingId() ? 'Ubah mata pelajaran' : 'Tambah mata pelajaran' }}</h2></div><button type="button" class="modal-close" (click)="closeEditor()">×</button></div>
        <div class="form-grid"><label>Kode pelajaran<input formControlName="code" placeholder="Contoh: BIND-07"></label><label>Nilai KKM<input type="number" min="0" max="100" formControlName="passingGrade"></label><label class="span-2">Nama mata pelajaran<input formControlName="name" placeholder="Contoh: Bahasa Indonesia"></label></div>
        <div class="modal-actions"><button type="button" class="btn btn--secondary" (click)="closeEditor()">Batal</button><button class="btn btn--primary" [disabled]="subjectForm.invalid || saving()">Simpan mata pelajaran</button></div>
      </form></div>
    }

    @if (editor() === 'assignment') {
      <div class="modal-backdrop" (click)="closeEditor()"><form class="modal" [formGroup]="assignmentForm" (ngSubmit)="saveAssignment()" (click)="$event.stopPropagation()">
        <div class="modal-heading"><div><span class="eyebrow">Hak akses Guru</span><h2>Tambah penugasan</h2><p>Guru hanya dapat menginput nilai untuk kombinasi ini.</p></div><button type="button" class="modal-close" (click)="closeEditor()">×</button></div>
        <div class="form-grid"><label class="span-2">Guru<select formControlName="teacherId"><option value="">Pilih guru</option>@for (teacher of references()?.teachers ?? []; track teacher.id) { <option [value]="teacher.id">{{ teacher.fullName }}</option> }</select></label><label>Semester<select formControlName="academicPeriodId" (change)="assignmentForm.controls.classId.setValue('')"><option value="">Pilih semester</option>@for (period of references()?.periods ?? []; track period.id) { <option [value]="period.id">{{ academicPeriodLabel(period) }}</option> }</select></label><label>Kelas<select formControlName="classId"><option value="">Pilih kelas</option>@for (item of availableAssignmentClasses(); track item.id) { <option [value]="item.id">Kelas {{ item.name }}</option> }</select></label><label>Mata pelajaran<select formControlName="subjectId"><option value="">Pilih pelajaran</option>@for (item of references()?.subjects ?? []; track item.id) { <option [value]="item.id">{{ item.name }}</option> }</select></label></div>
        <div class="modal-actions"><button type="button" class="btn btn--secondary" (click)="closeEditor()">Batal</button><button class="btn btn--primary" [disabled]="assignmentForm.invalid || saving()">Simpan penugasan</button></div>
      </form></div>
    }
  `,
})
export class MasterDataComponent {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  readonly references = signal<ReferenceData | null>(null);
  readonly editor = signal<EditorMode>(null);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly classForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(30)]],
    gradeLevel: [7, [Validators.required, Validators.min(1), Validators.max(12)]],
    academicYear: ['', Validators.required],
    homeroomTeacherId: [''],
  });
  readonly subjectForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(20)]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    passingGrade: [75, [Validators.required, Validators.min(0), Validators.max(100)]],
  });
  readonly assignmentForm = this.fb.nonNullable.group({
    teacherId: ['', Validators.required],
    classId: ['', Validators.required],
    subjectId: ['', Validators.required],
    academicPeriodId: ['', Validators.required],
  });

  constructor() { this.load(); }
  load() {
    this.http.get<ReferenceData>('/api/v1/reference-data').subscribe({
      next: (data) => this.references.set(data), error: (error) => this.error.set(errorMessage(error)),
    });
  }
  periodLabel(id: string) {
    const period = this.references()?.periods.find((item) => item.id === id);
    return period ? academicPeriodLabel(period) : 'Semester tidak diketahui';
  }
  academicPeriodLabel = academicPeriodLabel;
  academicYears() { return [...new Set((this.references()?.periods ?? []).map((period) => period.name))]; }
  availableAssignmentClasses() {
    const period = this.references()?.periods.find((item) => item.id === this.assignmentForm.controls.academicPeriodId.value);
    return (this.references()?.classes ?? []).filter((item) => period && item.academicYear === period.name);
  }
  openClass(item?: SchoolClass) {
    const defaultYear = currentAcademicPeriod(this.references()?.periods ?? [])?.name ?? '';
    this.editingId.set(item?.id ?? null); this.editor.set('class'); this.error.set('');
    this.classForm.reset({ name: item?.name ?? '', gradeLevel: item?.gradeLevel ?? 7, academicYear: item?.academicYear ?? defaultYear, homeroomTeacherId: item?.homeroomTeacherId ?? '' });
  }
  openSubject(item?: Subject) {
    this.editingId.set(item?.id ?? null); this.editor.set('subject'); this.error.set('');
    this.subjectForm.reset({ code: item?.code ?? '', name: item?.name ?? '', passingGrade: item?.passingGrade ?? 75 });
  }
  openAssignment() {
    this.editingId.set(null); this.editor.set('assignment'); this.error.set('');
    this.assignmentForm.reset({ teacherId: '', classId: '', subjectId: '', academicPeriodId: currentAcademicPeriod(this.references()?.periods ?? [])?.id ?? '' });
  }
  closeEditor() { this.editor.set(null); this.editingId.set(null); }
  saveClass() {
    if (this.classForm.invalid) return;
    const raw = this.classForm.getRawValue();
    this.saveRequest('classes', { ...raw, homeroomTeacherId: raw.homeroomTeacherId || null }, 'Kelas berhasil disimpan.');
  }
  saveSubject() {
    if (this.subjectForm.invalid) return;
    this.saveRequest('subjects', this.subjectForm.getRawValue(), 'Mata pelajaran berhasil disimpan.');
  }
  saveAssignment() {
    if (this.assignmentForm.invalid) return;
    this.saving.set(true); this.error.set('');
    this.http.post('/api/v1/reference-data/teaching-assignments', this.assignmentForm.getRawValue()).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => { this.closeEditor(); this.message.set('Penugasan guru berhasil disimpan.'); this.load(); },
      error: (error) => this.error.set(errorMessage(error)),
    });
  }
  private saveRequest(resource: 'classes' | 'subjects', payload: object, success: string) {
    this.saving.set(true); this.error.set('');
    const id = this.editingId();
    const request = id ? this.http.patch(`/api/v1/reference-data/${resource}/${id}`, payload) : this.http.post(`/api/v1/reference-data/${resource}`, payload);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => { this.closeEditor(); this.message.set(success); this.load(); },
      error: (error) => this.error.set(errorMessage(error)),
    });
  }
  removeClass(item: SchoolClass) {
    if (!confirm(`Hapus kelas ${item.name}?`)) return;
    this.remove(`classes/${item.id}`, 'Kelas berhasil dihapus.');
  }
  removeSubject(item: Subject) {
    if (!confirm(`Hapus mata pelajaran ${item.name}?`)) return;
    this.remove(`subjects/${item.id}`, 'Mata pelajaran berhasil dihapus.');
  }
  removeAssignment(id: string) {
    if (!confirm('Cabut penugasan guru ini?')) return;
    this.remove(`teaching-assignments/${id}`, 'Penugasan guru berhasil dicabut.');
  }
  initials(name: string) { return name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase(); }
  private remove(path: string, success: string) {
    this.error.set('');
    this.http.delete(`/api/v1/reference-data/${path}`).subscribe({
      next: () => { this.message.set(success); this.load(); },
      error: (error) => this.error.set(errorMessage(error)),
    });
  }
}
