import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, map, Observable, of, shareReplay, tap } from 'rxjs';
import { AuthResponse, CurrentUser } from './models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private restoreRequest?: Observable<CurrentUser | null>;
  readonly user = signal<CurrentUser | null>(null);

  login(email: string, password: string) {
    return this.http.post<AuthResponse>('/api/v1/auth/login', { email, password }).pipe(
      tap(({ user, csrfToken }) => {
        this.user.set(user);
        sessionStorage.setItem('csrfToken', csrfToken);
      }),
    );
  }

  restore(): Observable<CurrentUser | null> {
    if (this.user()) return of(this.user());
    if (!this.restoreRequest) {
      this.restoreRequest = this.http.get<AuthResponse>('/api/v1/auth/me').pipe(
        tap(({ user, csrfToken }) => {
          this.user.set(user);
          sessionStorage.setItem('csrfToken', csrfToken);
        }),
        map((response) => response.user),
        catchError(() => {
          this.user.set(null);
          return of(null);
        }),
        finalize(() => { this.restoreRequest = undefined; }),
        shareReplay(1),
      );
    }
    return this.restoreRequest;
  }

  logout() {
    this.http.post<void>('/api/v1/auth/logout', {}).pipe(finalize(() => {
      this.user.set(null);
      sessionStorage.removeItem('csrfToken');
      void this.router.navigate(['/login']);
    })).subscribe();
  }
}
