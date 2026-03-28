import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../theme/shared/service/auth.service';
import { timeout, catchError } from 'rxjs/operators';
import { of, throwError } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit, OnDestroy {
  mode: 'select' | 'host' | 'visitor' = 'select';
  hostForm: FormGroup;
  visitorForm: FormGroup;
  sessions: any[] = [];
  error: string | null = null;
  loading = false;

  // Modos de formulario Host: 0 = Master Password, 1 = Configuración de sesión
  hostStep = 0; 
  
  // Explorador de directorios nativo
  explorerLoading = false;

  // Auto-refresh para modo visitante
  private autoRefreshInterval: any = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.hostForm = this.fb.group({
      masterPassword: ['', Validators.required],
      hostName: ['Jagger (Host)', Validators.required],
      sessionPassword: ['', Validators.required],
      mcPath: ['', Validators.required],
      sharedPath: ['', Validators.required]
    });

    this.visitorForm = this.fb.group({
      sessionId: ['', Validators.required],
      visitorName: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  ngOnInit() {
    // Si ya está logueado, redirigir
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/']);
    }
  }

  ngOnDestroy() {
    this.stopAutoRefresh();
  }

  setMode(newMode: 'select' | 'host' | 'visitor') {
    this.mode = newMode;
    this.error = null;
    this.hostStep = 0;
    this.sessions = [];
    this.stopAutoRefresh();

    if (newMode === 'visitor') {
      this.loadSessions();
      // Auto-refresca cada 5 segundos mientras espera al host
      this.autoRefreshInterval = setInterval(() => {
        if (this.sessions.length === 0 && !this.loading) {
          this.loadSessions();
        } else if (this.sessions.length > 0) {
          this.stopAutoRefresh(); // Ya encontró sesiones, detiene el auto-refresh
        }
      }, 5000);
    }
  }

  stopAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }

  loadSessions() {
    this.loading = true;
    this.error = null;
    this.cdr.detectChanges(); // Forzar actualización inicial
    this.authService.getSessions().pipe(
      timeout(5000),
      catchError(err => {
        return throwError(() => err);
      })
    ).subscribe({
      next: (data) => {
        console.log('[LoginComponent] Sesiones cargadas:', data);
        this.sessions = data;
        this.loading = false;
        if (data && data.length > 0) {
          this.stopAutoRefresh(); // Sesiones encontradas, detener polling
        }
        this.cdr.detectChanges(); // Forzar actualización del DOM
      },
      error: (err) => {
        console.error('[LoginComponent] Error cargando sesiones:', err);
        this.error = 'No se pudo contactar al servidor backend. Verifica que el sistema Absolute esté activo.';
        this.loading = false;
        this.cdr.detectChanges(); // Forzar actualización del DOM
      }
    });
  }

  onHostNextStep() {
    if (this.hostForm.get('masterPassword')?.value) {
      this.hostStep = 1;
    }
  }

  onHostSubmit() {
    if (this.hostForm.invalid) return;
    this.loading = true;
    this.error = null;

    const values = this.hostForm.value;
    const data = {
      masterPassword: values.masterPassword,
      hostName: values.hostName,
      sessionPassword: values.sessionPassword,
      config: {
        mcPath: values.mcPath,
        sharedPath: values.sharedPath
      }
    };

    this.authService.loginHost(data).subscribe({
      next: () => {
        this.router.navigate(['/dashboard/default']);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Error al iniciar sesión como Host';
        this.hostStep = 0;
        this.hostForm.get('masterPassword')?.reset();
      }
    });
  }

  // Explorador de archivos NATIVO
  openExplorer(target: 'mcPath' | 'sharedPath') {
    this.explorerLoading = true;
    const mp = this.hostForm.get('masterPassword')?.value;
    
    this.authService.exploreFolder(mp, '').subscribe({
      next: (res) => {
        if (res.selectedPath) {
          setTimeout(() => {
            this.hostForm.patchValue({ [target]: res.selectedPath });
          });
        }
        setTimeout(() => this.explorerLoading = false);
      },
      error: (err) => {
        setTimeout(() => {
          this.error = err.error?.error || 'Diálogo cancelado o no soportado';
          this.explorerLoading = false;
        });
      }
    });
  }

  onVisitorSubmit() {
    if (this.visitorForm.invalid) return;
    this.loading = true;
    this.error = null;

    this.authService.loginVisitor(this.visitorForm.value).subscribe({
      next: () => {
        this.stopAutoRefresh();
        this.router.navigate(['/dashboard/default']);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Error al conectar a la sesión';
      }
    });
  }
}
