import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/security.interceptor';

interface TeacherAccess { id: string; email: string; fullName: string; isActive: boolean; accessStatus: 'APPROVED'|'PENDING'|'REJECTED'; accessRejectionReason?: string; createdAt: string; schoolUnit: { name: string }; }

@Component({ standalone: true, imports: [DatePipe, ReactiveFormsModule], template: `
  <div class="page-heading"><div><span class="eyebrow">Manajemen akses</span><h1>Akses Guru</h1><p>Admin Cabang mengajukan akun, Admin Pusat menyetujui sebelum guru dapat masuk.</p></div></div>
  @if (error()) { <div class="alert alert--error">{{ error() }}</div> } @if (message()) { <div class="alert alert--success">{{ message() }}</div> }
  @if (!isCentral) { <section class="panel case-form-panel"><div class="panel-heading"><div><h2>Ajukan akses guru</h2><p class="muted">Akun baru belum dapat login sampai disetujui Admin Pusat.</p></div></div><form class="form-grid case-form" [formGroup]="form" (ngSubmit)="create()"><label>Nama lengkap<input formControlName="fullName" placeholder="Nama guru"></label><label>Email otomatis<input [value]="generatedEmail" readonly aria-readonly="true"><small class="muted">Email dibuat otomatis dari nama guru.</small></label><label>Kata sandi awal<input type="password" formControlName="password" placeholder="Minimal 8 karakter"></label><div class="case-form-actions span-2"><button class="btn btn--primary" [disabled]="saving()">{{ saving() ? 'Mengajukan...' : 'Ajukan akses' }}</button></div></form></section> }
  <section class="panel table-panel case-history-panel"><div class="panel-heading"><div><h2>Daftar akses guru</h2><p class="muted">{{ isCentral ? 'Periksa dan proses pengajuan dari cabang.' : 'Status akun guru di cabang Anda.' }}</p></div><span class="table-count">{{ users().length }} akun</span></div><div class="table-scroll"><table><thead><tr><th>Guru</th><th>Cabang</th><th>Status</th><th>Dibuat</th>@if (isCentral) { <th>Aksi</th> }</tr></thead><tbody>@for (user of users(); track user.id) { <tr><td><strong>{{ user.fullName }}</strong><small class="muted">{{ user.email }}</small></td><td>{{ user.schoolUnit.name }}</td><td><span class="status-pill" [class.status-pill--warning]="user.accessStatus === 'PENDING'" [class.status-pill--danger]="user.accessStatus === 'REJECTED'">{{ statusLabel(user.accessStatus) }}</span>@if (user.accessRejectionReason) {<small class="muted">{{ user.accessRejectionReason }}</small>}</td><td>{{ user.createdAt | date:'dd/MM/yyyy' }}</td>@if (isCentral) { <td><div class="button-row">@if (user.accessStatus === 'PENDING') { <button class="btn btn--primary btn--small" (click)="decide(user, 'APPROVED')">Setujui</button><button class="btn btn--danger btn--small" (click)="decide(user, 'REJECTED')">Tolak</button> } @else { <span class="muted">Sudah diproses</span> }</div></td> }</tr> } @empty { <tr><td [attr.colspan]="isCentral ? 5 : 4" class="empty-state case-empty-state">Belum ada akun guru.</td></tr>}</tbody></table></div></section>
` })
export class TeacherAccessComponent {
  private readonly http = inject(HttpClient); private readonly fb = inject(FormBuilder); readonly auth = inject(AuthService);
  readonly users = signal<TeacherAccess[]>([]); readonly error = signal(''); readonly message = signal(''); readonly saving = signal(false);
  readonly form = this.fb.nonNullable.group({ fullName: ['', [Validators.required, Validators.minLength(2)]], password: ['', [Validators.required, Validators.minLength(8)]] });
  get generatedEmail() { const base = this.form.controls.fullName.value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').replace(/\.{2,}/g, '.'); return `${base || 'guru'}@integration.sch.id`; }
  get isCentral() { return this.auth.user()?.adminScope === 'CENTRAL'; }
  constructor() { this.load(); }
  load() { this.http.get<TeacherAccess[]>('/api/v1/teacher-access').subscribe({ next: (v) => this.users.set(v), error: (e) => this.error.set(errorMessage(e)) }); }
  statusLabel(status: TeacherAccess['accessStatus']) { return status === 'APPROVED' ? 'Aktif' : status === 'PENDING' ? 'Menunggu Admin Pusat' : 'Ditolak'; }
  create() { if (this.form.invalid) { this.form.markAllAsTouched(); return; } this.saving.set(true); this.http.post('/api/v1/teacher-access', this.form.getRawValue()).subscribe({ next: () => { this.message.set('Pengajuan akses berhasil dikirim ke Admin Pusat.'); this.form.reset(); this.saving.set(false); this.load(); }, error: (e) => { this.error.set(errorMessage(e)); this.saving.set(false); } }); }
  decide(user: TeacherAccess, decision: 'APPROVED'|'REJECTED') { const reason = decision === 'REJECTED' ? window.prompt('Alasan penolakan:')?.trim() : undefined; if (decision === 'REJECTED' && !reason) return; this.http.patch(`/api/v1/teacher-access/${user.id}/decision`, { decision, reason }).subscribe({ next: () => { this.message.set(decision === 'APPROVED' ? 'Akun guru disetujui.' : 'Pengajuan akun ditolak.'); this.load(); }, error: (e) => this.error.set(errorMessage(e)) }); }
}
