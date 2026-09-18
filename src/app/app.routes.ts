import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent) },
      { path: 'students', loadComponent: () => import('./features/students/students.component').then((m) => m.StudentsComponent) },
      { path: 'inactive-students', canActivate: [adminGuard], loadComponent: () => import('./features/inactive-students/inactive-students.component').then((m) => m.InactiveStudentsComponent) },
      { path: 'teacher-attendance', loadComponent: () => import('./features/teacher-attendance/teacher-attendance.component').then((m) => m.TeacherAttendanceComponent) },
      { path: 'student-attendance', loadComponent: () => import('./features/student-attendance/student-attendance.component').then((m) => m.StudentAttendanceComponent) },
      { path: 'teacher-schedule', loadComponent: () => import('./features/teacher-schedule/teacher-schedule.component').then((m) => m.TeacherScheduleComponent) },
      { path: 'master-data', canActivate: [adminGuard], loadComponent: () => import('./features/master-data/master-data.component').then((m) => m.MasterDataComponent) },
      { path: 'assessments', loadComponent: () => import('./features/assessments/assessments.component').then((m) => m.AssessmentsComponent) },
      { path: 'student-reports', loadComponent: () => import('./features/student-reports/student-reports.component').then((m) => m.StudentReportsComponent) },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: '' },
];
