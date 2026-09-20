import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/security.interceptor';

interface TeacherCase { id: string; teacherId: string; level: 'WARNING'|'SP1'|'SP2'|'SP3'; status: 'OPEN'|'RESOLVED'|'TERMINATED'; title: string; description: string; decision?: string; createdAt: string; teacher: { fullName: string; email: string }; schoolUnit: { name: string }; recordedBy: { fullName: string }; }
interface Teacher { id: string; fullName: string; email: string; }

@Component({
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule],
  template: `
    <div class="page-heading"><div><span class="eyebrow">Tata kelola guru</span><h1>Kasus Guru</h1><p>Catat pembinaan di cabang dan pantau keputusan Admin Pusat secara transparan.</p></div></div>
    @if (error()) { <div class="alert alert--error">{{ error() }}</div> }
    @if (message()) { <div class="alert alert--success">{{ message() }}</div> }
    @if (isBranch) {
      <section class="panel case-form-panel"><div class="panel-heading"><div><h2>Catat pembinaan</h2><p class="muted">Admin Cabang dapat membuat Peringatan, SP1, atau SP2.</p></div></div>
        <form class="form-grid case-form" [formGroup]="form" (ngSubmit)="create()"><label>Guru<select formControlName="teacherId"><option value="">Pilih guru</option>@for (teacher of teachers(); track teacher.id) { <option [value]="teacher.id">{{ teacher.fullName }} — {{ teacher.email }}</option> }</select></label><label>Tingkat<select formControlName="level"><option value="WARNING">Peringatan</option><option value="SP1">SP1</option><option value="SP2">SP2</option></select></label><label>Judul<input formControlName="title" placeholder="Contoh: Keterlambatan berulang"></label><label class="span-2">Uraian<textarea formControlName="description" rows="3" placeholder="Jelaskan kejadian dan pembinaan yang diberikan"></textarea></label><div class="span-2 case-form-actions"><button class="btn btn--primary" [disabled]="saving()">{{ saving() ? 'Menyimpan...' : 'Simpan kasus' }}</button></div></form>
      </section>
    }
    <section class="panel table-panel case-history-panel"><div class="panel-heading"><div><h2>Riwayat kasus</h2><p class="muted">{{ isCentral ? 'Seluruh kasus dari semua cabang.' : 'Kasus guru di cabang Anda.' }}</p></div><span class="table-count">{{ cases().length }} kasus</span></div>
      <div class="table-scroll"><table><thead><tr><th>Guru</th><th>Cabang</th><th>Tingkat</th><th>Status</th><th>Uraian</th><th>Tanggal</th>@if (isCentral) { <th>Aksi</th> }</tr></thead><tbody>@for (item of cases(); track item.id) { <tr><td><strong>{{ item.teacher.fullName }}</strong><small class="muted">{{ item.teacher.email }}</small></td><td>{{ item.schoolUnit.name }}</td><td><span class="status-pill" [class.status-pill--warning]="item.level === 'WARNING'" [class.status-pill--danger]="item.level === 'SP3'">{{ item.level === 'WARNING' ? 'Peringatan' : item.level }}</span></td><td>{{ statusLabel(item.status) }}</td><td class="reason-cell"><strong>{{ item.title }}</strong><br>{{ item.description }}@if (item.decision) {<br><small>Keputusan: {{ item.decision }}</small>}</td><td>{{ item.createdAt | date:'dd/MM/yyyy' }}</td>@if (isCentral) { <td><div class="button-row"><button class="btn btn--secondary btn--small" (click)="resolve(item)" [disabled]="item.status !== 'OPEN'">Selesaikan</button><button class="btn btn--danger btn--small" (click)="terminate(item)" [disabled]="item.status === 'TERMINATED'">SP3 & nonaktifkan</button></div></td> }</tr> } @empty { <tr><td [attr.colspan]="isCentral ? 7 : 6" class="empty-state case-empty-state">Belum ada kasus guru. Kasus yang dicatat akan muncul di sini.</td></tr>}</tbody></table></div>
    </section>
  `,
})
export class TeacherCasesComponent {
  private readonly http = inject(HttpClient); private readonly fb = inject(FormBuilder); readonly auth = inject(AuthService);
  readonly cases = signal<TeacherCase[]>([]); readonly teachers = signal<Teacher[]>([]); readonly error = signal(''); readonly message = signal(''); readonly saving = signal(false);
  readonly form = this.fb.nonNullable.group({ teacherId: ['', Validators.required], level: ['WARNING' as 'WARNING'|'SP1'|'SP2', Validators.required], title: ['', Validators.required], description: ['', Validators.required] });
  get isCentral() { return this.auth.user()?.adminScope === 'CENTRAL'; } get isBranch() { return !this.isCentral; }
  constructor() { this.load(); }
  load() { this.http.get<TeacherCase[]>('/api/v1/teacher-cases').subscribe({ next: (v) => this.cases.set(v), error: (e) => this.error.set(errorMessage(e)) }); if (this.isBranch) this.http.get<{ teachers: Teacher[] }>('/api/v1/reference-data').subscribe({ next: (v) => this.teachers.set(v.teachers ?? []), error: (e) => this.error.set(errorMessage(e)) }); }
  statusLabel(status: TeacherCase['status']) { return status === 'OPEN' ? 'Terbuka' : status === 'RESOLVED' ? 'Selesai' : 'Dinonaktifkan'; }
  create() { if (this.form.invalid) { this.form.markAllAsTouched(); return; } this.saving.set(true); this.http.post('/api/v1/teacher-cases', this.form.getRawValue()).subscribe({ next: () => { this.message.set('Kasus berhasil dicatat.'); this.form.reset({ teacherId: '', level: 'WARNING', title: '', description: '' }); this.saving.set(false); this.load(); }, error: (e) => { this.error.set(errorMessage(e)); this.saving.set(false); } }); }
  action(item: TeacherCase, status: 'RESOLVED'|'TERMINATED', level: 'SP1'|'SP2'|'SP3', decision: string) { this.http.patch(`/api/v1/teacher-cases/${item.id}/action`, { status, level, decision }).subscribe({ next: () => { this.message.set('Keputusan kasus diperbarui.'); this.load(); }, error: (e) => this.error.set(errorMessage(e)) }); }
  resolve(item: TeacherCase) { this.action(item, 'RESOLVED', item.level === 'WARNING' ? 'SP1' : item.level as 'SP1'|'SP2', 'Kasus telah ditindaklanjuti dan diselesaikan.'); }
  terminate(item: TeacherCase) { this.action(item, 'TERMINATED', 'SP3', 'SP3 diterbitkan; akun guru dinonaktifkan oleh Admin Pusat.'); }
}
