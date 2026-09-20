import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/security.interceptor';

interface BranchAdmin { id: string; fullName: string; email: string; isActive: boolean; createdAt: string; schoolUnit: { code: string; name: string; address?: string }; }
interface SchoolUnit { id: string; code: string; name: string; }

@Component({ standalone: true, imports: [DatePipe, ReactiveFormsModule], template: `
  <div class="page-heading"><div><span class="eyebrow">Administrasi pusat</span><h1>Admin Cabang</h1><p>Daftar pengelola unit sekolah yang berada di bawah pengawasan Admin Pusat.</p></div></div>
  @if (error()) { <div class="alert alert--error">{{ error() }}</div> } @if (message()) { <div class="alert alert--success">{{ message() }}</div> }
  @if (isCentral) { <section class="panel case-form-panel"><div class="panel-heading"><div><h2>Tambah Admin Cabang</h2><p class="muted">Akun langsung aktif dan email dibuat otomatis berdasarkan kode cabang.</p></div></div><form class="form-grid case-form" [formGroup]="form" (ngSubmit)="create()"><label>Nama lengkap<input formControlName="fullName" placeholder="Nama Admin Cabang"></label><label>Cabang<select formControlName="schoolUnitId"><option value="">Pilih cabang</option>@for (unit of units(); track unit.id) { <option [value]="unit.id">{{ unit.name }} ({{ unit.code }})</option> }</select></label><label>Kata sandi awal<input type="password" formControlName="password" placeholder="Minimal 8 karakter"></label><div class="case-form-actions span-2"><button class="btn btn--primary" [disabled]="saving()">{{ saving() ? 'Menyimpan...' : 'Tambah Admin Cabang' }}</button></div></form></section> }
  <section class="panel table-panel case-history-panel"><div class="panel-heading"><div><h2>Daftar Admin Cabang</h2><p class="muted">Informasi akun dan unit sekolah masing-masing admin.</p></div><span class="table-count">{{ admins().length }} admin</span></div><div class="table-scroll"><table><thead><tr><th>Admin</th><th>Unit sekolah</th><th>Alamat</th><th>Status</th><th>Dibuat</th></tr></thead><tbody>@for (admin of admins(); track admin.id) { <tr><td><strong>{{ admin.fullName }}</strong><small class="muted">{{ admin.email }}</small></td><td><strong>{{ admin.schoolUnit.name }}</strong><small class="muted">{{ admin.schoolUnit.code }}</small></td><td>{{ admin.schoolUnit.address || '—' }}</td><td><span class="status-pill" [class.status-pill--danger]="!admin.isActive">{{ admin.isActive ? 'Aktif' : 'Nonaktif' }}</span></td><td>{{ admin.createdAt | date:'dd/MM/yyyy' }}</td></tr>} @empty {<tr><td colspan="5" class="empty-state case-empty-state">Belum ada Admin Cabang.</td></tr>}</tbody></table></div></section>
` })
export class AdminAccountsComponent {
  private readonly http = inject(HttpClient); private readonly fb = inject(FormBuilder); readonly admins = signal<BranchAdmin[]>([]); readonly units = signal<SchoolUnit[]>([]); readonly error = signal(''); readonly message = signal(''); readonly saving = signal(false);
  readonly form = this.fb.nonNullable.group({ fullName: ['', [Validators.required, Validators.minLength(2)]], schoolUnitId: ['', Validators.required], password: ['', [Validators.required, Validators.minLength(8)]] });
  get isCentral() { return this.authScope === 'CENTRAL'; }
  private readonly auth = inject(AuthService); get authScope() { return this.auth.user()?.adminScope; }
  constructor() { this.load(); if (this.isCentral) this.http.get<SchoolUnit[]>('/api/v1/admin-accounts/units').subscribe({ next: (v) => this.units.set(v), error: (e) => this.error.set(errorMessage(e)) }); }
  load() { this.http.get<BranchAdmin[]>('/api/v1/admin-accounts').subscribe({ next: (v) => this.admins.set(v), error: (e) => this.error.set(errorMessage(e)) }); }
  create() { if (this.form.invalid) { this.form.markAllAsTouched(); return; } this.saving.set(true); this.http.post('/api/v1/admin-accounts', this.form.getRawValue()).subscribe({ next: (user) => { this.message.set(`Admin berhasil dibuat. Email login: ${(user as BranchAdmin).email}`); this.form.reset(); this.saving.set(false); this.load(); }, error: (e) => { this.error.set(errorMessage(e)); this.saving.set(false); } }); }
}
