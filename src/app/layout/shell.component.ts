import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-shell" [class.sidebar-open]="menuOpen()">
      <aside class="sidebar">
        <div class="brand brand--light"><span class="brand__mark">IS</span><span>Integration System</span></div>
        <nav>
          <a routerLink="/dashboard" routerLinkActive="active"><span class="nav-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg></span>Dashboard</a>
          <a routerLink="/students" routerLinkActive="active"><span class="nav-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20H3.5Z"/><path d="M16 5.3a3 3 0 0 1 0 5.4M17 14a5 5 0 0 1 3.5 4.8V20H17"/></svg></span>Data Siswa</a>
          @if (auth.user()?.role === 'ADMIN') { <a routerLink="/inactive-students" routerLinkActive="active"><span class="nav-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20H3.5ZM17 9h5"/></svg></span>Siswa Nonaktif</a> }
          <a routerLink="/teacher-attendance" routerLinkActive="active"><span class="nav-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18m-12 5 2 2 4-4"/></svg></span>Absensi Guru</a>
          <a routerLink="/teacher-schedule" routerLinkActive="active"><span class="nav-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h4M7 18h7"/></svg></span>Jadwal Guru</a>
          @if (auth.user()?.role === 'ADMIN') { <a routerLink="/master-data" routerLinkActive="active"><span class="nav-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/></svg></span>Master Data</a> }
          @if (auth.user()?.role === 'ADMIN') { <a routerLink="/teacher-cases" routerLinkActive="active"><span class="nav-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h5M8 16h3"/><path d="m16 15 2 2 3-4"/></svg></span>Kasus Guru</a> }
          @if (auth.user()?.role === 'ADMIN') { <a routerLink="/teacher-access" routerLinkActive="active"><span class="nav-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20H3.5Z"/><path d="M17 8h5M19.5 5.5v5"/></svg></span>Akses Guru</a> }
          @if (auth.user()?.role === 'ADMIN' && auth.user()?.adminScope === 'CENTRAL') { <a routerLink="/admin-accounts" routerLinkActive="active"><span class="nav-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20H3.5Z"/><path d="M16 6h5M18.5 3.5v5M16 13h5"/></svg></span>Admin Cabang</a> }
          <a routerLink="/assessments" routerLinkActive="active"><span class="nav-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4.5h6V2H9v2.5Zm0 11 2 2 4-4"/></svg></span>Penilaian</a>
          <a routerLink="/student-reports" routerLinkActive="active"><span class="nav-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h8l4 4v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M15 3v5h4M9 12h6M9 16h6"/></svg></span>Rekap Nilai</a>
        </nav>
      </aside>
      <section class="workspace">
        <header class="topbar">
          <button class="menu-button" (click)="menuOpen.set(!menuOpen())" aria-label="Buka menu">☰</button>
          <div class="school-context"><small>Unit sekolah</small><strong>{{ auth.user()?.schoolUnit?.name }}</strong></div>
          <div class="account">
            <button class="account-summary" type="button" (click)="profileOpen.set(true)" aria-label="Buka profil pengguna"><div class="avatar">{{ initials }}</div><div class="account-copy"><strong>{{ auth.user()?.fullName }}</strong><small>{{ auth.user()?.role === 'ADMIN' ? 'Administrator' : 'Guru' }}</small></div></button>
            <button class="btn btn--ghost btn--small" (click)="auth.logout()">Keluar</button>
          </div>
        </header>
        <main class="content"><router-outlet /></main>
      </section>
      @if (menuOpen()) { <button class="sidebar-backdrop" (click)="menuOpen.set(false)" aria-label="Tutup menu"></button> }
      @if (profileOpen()) { <div class="profile-backdrop" (click)="profileOpen.set(false)"><section class="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title" (click)="$event.stopPropagation()"><div class="profile-modal__header"><div><span class="eyebrow">Profil akun</span><h2 id="profile-title">{{ auth.user()?.fullName }}</h2></div><button class="icon-button" type="button" (click)="profileOpen.set(false)" aria-label="Tutup profil">×</button></div><div class="profile-details"><div><span>Nama lengkap</span><strong>{{ auth.user()?.fullName }}</strong></div><div><span>Email sekolah</span><strong>{{ auth.user()?.email }}</strong></div><div><span>Peran</span><strong>{{ auth.user()?.role === 'ADMIN' ? 'Administrator' : 'Guru' }}</strong></div><div><span>Unit sekolah</span><strong>{{ auth.user()?.schoolUnit?.name }}</strong></div>@if (auth.user()?.role === 'ADMIN') { <div><span>Lingkup akses</span><strong>{{ auth.user()?.adminScope === 'CENTRAL' ? 'Admin Pusat' : 'Admin Cabang' }}</strong></div> }</div><button class="btn btn--secondary profile-close" type="button" (click)="profileOpen.set(false)">Tutup</button></section></div> }
    </div>
  `,
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly menuOpen = signal(false);
  readonly profileOpen = signal(false);
  get initials() {
    return (this.auth.user()?.fullName ?? 'US').split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }
}
