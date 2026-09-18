import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const securityInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const csrfToken = sessionStorage.getItem('csrfToken');
  const mutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  const secured = req.clone({
    withCredentials: true,
    setHeaders: mutation && csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
  });

  return next(secured).pipe(catchError((error: HttpErrorResponse) => {
    if (error.status === 401 && !req.url.endsWith('/auth/login')) {
      sessionStorage.removeItem('csrfToken');
      void router.navigate(['/login']);
    }
    return throwError(() => error);
  }));
};

export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    return error.error?.error?.message ?? 'Permintaan tidak dapat diproses.';
  }
  return 'Terjadi kesalahan. Silakan coba lagi.';
}
