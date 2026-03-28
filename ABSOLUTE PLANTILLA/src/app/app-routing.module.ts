// angular import
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// Project import
import { AdminComponent } from './theme/layouts/admin-layout/admin-layout.component';
import { AuthGuard } from './theme/shared/guard/auth.guard';

const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(c => c.LoginComponent)
  },
  {
    path: '',
    component: AdminComponent,
    canActivate: [AuthGuard],
    children: [
      {
        path: '',
        redirectTo: '/dashboard/default',
        pathMatch: 'full'
      },
      {
        path: 'dashboard/default',
        loadComponent: () => import('./demo/dashboard/default/default.component').then((c) => c.DefaultComponent)
      },
      {
        path: 'server/console',
        loadComponent: () => import('./pages/server/console/console.component').then((c) => c.ConsoleComponent)
      },
      {
        path: 'server/files',
        loadComponent: () => import('./pages/server/files/files.component').then((c) => c.FilesComponent)
      },
      {
        path: 'server/whitelist',
        loadComponent: () => import('./demo/minecraft/whitelist/whitelist.component')
      },
      {
        path: 'server/backups',
        loadComponent: () => import('./demo/minecraft/backups/backups.component')
      },
      {
        path: 'music/studio',
        loadComponent: () => import('./demo/music/studio/music-studio.component')
      },
      {
        path: 'music/theory',
        loadComponent: () => import('./demo/music/theory/theory.component')
      },
      {
        path: 'server/mods',
        loadComponent: () => import('./demo/minecraft/mods/mods.component')
      },
      {
        path: 'server/settings',
        loadComponent: () => import('./pages/server/settings/settings.component').then((c) => c.SettingsComponent)
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
