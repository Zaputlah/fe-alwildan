import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/security.interceptor';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <main class="login-page">
      <section class="login-visual">
        <div class="brand brand--light"><span class="brand__mark">IS</span><span>Integration System</span></div>
        <div class="login-copy">
          <span class="eyebrow eyebrow--light">Student Assessment</span>
          <h1>Data penilaian yang rapi, keputusan yang lebih berarti.</h1>
          <p>Kelola siswa, assessment, dan perkembangan hasil belajar dalam satu ruang kerja sekolah.</p>
          <div class="feature-pills"><span>Nilai terintegrasi</span><span>Role & audit</span><span>Analitik real-time</span></div>
        </div>
        <div class="visual-orb visual-orb--one"></div><div class="visual-orb visual-orb--two"></div>
      </section>
      <section class="login-panel">
        <form class="login-card" [formGroup]="form" (ngSubmit)="submit()">
          <div class="mobile-brand brand"><span class="brand__mark">IS</span><span>Integration System</span></div>
          <span class="eyebrow">Selamat datang</span>
          <h2>Masuk ke akun Anda</h2>
          <p class="muted">Gunakan akun sekolah yang telah didaftarkan.</p>
          @if (error()) { <div class="alert alert--error">{{ error() }}</div> }
          <label>Email sekolah<input type="email" formControlName="email" autocomplete="username" placeholder="nama@sekolah.sch.id"></label>
          <label>Kata sandi<input type="password" formControlName="password" autocomplete="current-password" placeholder="Minimal 8 karakter"></label>
          <button class="btn btn--primary btn--block" [disabled]="loading() || form.invalid">
            {{ loading() ? 'Memeriksa akun…' : 'Masuk ke sistem' }}
          </button>
          <button
            type="button"
            class="demo-toggle"
            (click)="showDemoAccounts.set(true)"
          >
            <span><strong>Akun demo</strong><small>Lihat daftar akun untuk pengujian</small></span>
            <span class="demo-toggle__icon">→</span>
          </button>
          @if (showDemoAccounts()) {
            <div class="modal-backdrop" (click)="showDemoAccounts.set(false)">
              <div class="modal demo-modal" id="demo-account-list" role="dialog" aria-modal="true" aria-labelledby="demo-account-title" (click)="$event.stopPropagation()">
                <div class="modal-heading">
                  <div><span class="eyebrow">Akun pengujian</span><h2 id="demo-account-title">Pilih akun demo</h2><p>Klik akun untuk mengisi form login secara otomatis.</p></div>
                  <button type="button" class="modal-close" aria-label="Tutup" (click)="showDemoAccounts.set(false)">×</button>
                </div>
                <div class="demo-box">
                  <button type="button" class="demo-account" (click)="useAccount('admin@integration.sch.id')">
                    <span><strong>Admin</strong><small>Administrator sekolah</small></span>
                    <code>admin&#64;integration.sch.id</code>
                  </button>
                  <button type="button" class="demo-account" (click)="useAccount('admin.pusat@integration.sch.id')">
                    <span><strong>Admin Pusat</strong><small>Approval akhir seluruh cabang</small></span>
                    <code>admin.pusat&#64;integration.sch.id</code>
                  </button>
                  <button type="button" class="demo-account" (click)="useAccount('guru@integration.sch.id')">
                    <span><strong>Wali kelas 7A</strong><small>Ahmad Fauzan · mengajar IPA</small></span>
                    <code>guru&#64;integration.sch.id</code>
                  </button>
                  <div class="demo-divider"><span>Akun guru untuk pengujian</span></div>
                  <button type="button" class="demo-account" (click)="useAccount('guru.ipa.test@integration.sch.id')">
                    <span><strong>Wali kelas 7B</strong><small>Siti Rahmawati · mengajar IPA</small></span>
                    <code>guru.ipa.test&#64;integration.sch.id</code>
                  </button>
                  <button type="button" class="demo-account" (click)="useAccount('guru.matematika.test@integration.sch.id')">
                    <span><strong>Guru Matematika</strong><small>Budi Santoso, S.Pd.</small></span>
                    <code>guru.matematika.test&#64;integration.sch.id</code>
                  </button>
                  <button type="button" class="demo-account" (click)="useAccount('guru.pai.test@integration.sch.id')">
                    <span><strong>Guru PAI</strong><small>Nur Aisyah, S.Pd.I.</small></span>
                    <code>guru.pai.test&#64;integration.sch.id</code>
                  </button>
                  <button type="button" class="demo-account" (click)="useAccount('guru.ips.7b@integration.sch.id')">
                    <span><strong>Guru IPS 7B</strong><small>Rina Puspita · bukan wali kelas</small></span>
                    <code>guru.ips.7b&#64;integration.sch.id</code>
                  </button>
                  <div class="demo-password"><span>Password semua akun</span><code>Integration123!</code></div>
                </div>
              </div>
            </div>
          }
        </form>
      </section>
    </main>
  `,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly showDemoAccounts = signal(false);
  readonly form = this.fb.nonNullable.group({
    email: ['admin@integration.sch.id', [Validators.required, Validators.email]],
    password: ['Integration123!', [Validators.required, Validators.minLength(8)]],
  });

  useAccount(email: string) {
    this.error.set('');
    this.form.setValue({ email, password: 'Integration123!' });
    this.showDemoAccounts.set(false);
  }

  submit() {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.form.getRawValue().email, this.form.getRawValue().password).pipe(
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: () => void this.router.navigate(['/dashboard']),
      error: (error) => this.error.set(errorMessage(error)),
    });
  }
}
