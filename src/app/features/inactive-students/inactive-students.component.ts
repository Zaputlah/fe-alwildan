import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Student } from '../../core/models';
import { academicPeriodLabel } from '../../core/academic-period';
import { errorMessage } from '../../core/security.interceptor';

interface InactiveStudentsResponse {
  items: Student[];
  pagination: { page: number; pages: number; total: number };
}

@Component({
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule],
  template: `
    <div class="page-heading"><div><span class="eyebrow">Arsip siswa</span><h1>Siswa Nonaktif</h1><p>Data siswa tetap tersimpan bersama alasan penonaktifannya.</p></div></div>
    @if (error()) { <div class="alert alert--error">{{ error() }}</div> }
    <section class="panel table-panel">
      <form class="table-toolbar" [formGroup]="filters" (ngSubmit)="search()">
        <div class="search-box"><span>⌕</span><input formControlName="search" placeholder="Cari nama atau NIS"></div>
        <button class="btn btn--secondary" type="submit">Cari</button>
        <span class="table-count">{{ total() }} siswa nonaktif</span>
      </form>
      @if (loading()) { <div class="loading-card">Memuat siswa nonaktif…</div> }
      @else {
        <div class="table-scroll"><table><thead><tr><th>Siswa</th><th>NIS</th><th>Kelas terakhir</th><th>Semester terakhir</th><th>Dinonaktifkan</th><th>Alasan</th></tr></thead><tbody>
          @for (student of students(); track student.id) {
            <tr>
              <td><strong>{{ student.fullName }}</strong></td>
              <td><span class="mono">{{ student.nis }}</span></td>
              <td>{{ student.enrollments[0]?.class?.name ?? '—' }}</td>
              <td>{{ student.enrollments[0]?.academicPeriod ? academicPeriodLabel(student.enrollments[0].academicPeriod) : '—' }}</td>
              <td>{{ student.deactivatedAt ? (student.deactivatedAt | date:'dd/MM/yyyy') : 'Tidak tercatat' }}</td>
              <td class="reason-cell">{{ student.deactivationReason || 'Alasan belum dicatat (data lama)' }}</td>
            </tr>
          } @empty { <tr><td colspan="6" class="empty-state">Belum ada siswa nonaktif yang sesuai.</td></tr> }
        </tbody></table></div>
        @if (pages() > 1) {
          <div class="table-pagination"><button type="button" class="btn btn--secondary btn--small" [disabled]="page() === 1" (click)="changePage(page() - 1)">Sebelumnya</button><span>Halaman {{ page() }} dari {{ pages() }}</span><button type="button" class="btn btn--secondary btn--small" [disabled]="page() === pages()" (click)="changePage(page() + 1)">Berikutnya</button></div>
        }
      }
    </section>
  `,
})
export class InactiveStudentsComponent {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  readonly students = signal<Student[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pages = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly academicPeriodLabel = academicPeriodLabel;
  readonly filters = this.fb.nonNullable.group({ search: [''] });

  constructor() { this.load(); }

  search() { this.page.set(1); this.load(); }

  changePage(page: number) {
    if (page < 1 || page > this.pages()) return;
    this.page.set(page);
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.http.get<InactiveStudentsResponse>('/api/v1/students/inactive', {
      params: { search: this.filters.controls.search.value, page: this.page() },
    }).subscribe({
      next: (result) => {
        this.students.set(result.items);
        this.total.set(result.pagination.total);
        this.page.set(result.pagination.page);
        this.pages.set(result.pagination.pages);
        this.loading.set(false);
      },
      error: (error) => { this.error.set(errorMessage(error)); this.loading.set(false); },
    });
  }
}
