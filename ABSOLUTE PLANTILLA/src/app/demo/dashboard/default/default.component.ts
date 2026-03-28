// angular import
import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';

// project import
import { McServerService } from '../../../../app/theme/shared/service/mc-server.service';

// icons
import { IconService, IconDirective } from '@ant-design/icons-angular';
import { FallOutline, RiseOutline, SettingOutline, DatabaseOutline, ApiOutline, MonitorOutline, CodeOutline, CheckCircleOutline, CloseCircleOutline, UserAddOutline, FrownOutline, WarningOutline } from '@ant-design/icons-angular/icons';
import { CardComponent } from '../../../../app/theme/shared/components/card/card.component';
import { Subscription } from 'rxjs';
import { NgApexchartsModule } from 'ng-apexcharts';
import { AuthService } from '../../../../app/theme/shared/service/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-default',
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    IconDirective,
    NgApexchartsModule
  ],
  templateUrl: './default.component.html',
  styleUrls: ['./default.component.scss']
})
export class DefaultComponent implements OnInit, OnDestroy {
  private iconService = inject(IconService);
  serverStatus: string = 'offline';
  serverStats: any = { cpu: 0, ram: 0, mods: 0, size: '0 MB', uptime: 0, players: [] };

  // Network Info
  networkInfo = {
    minecraftIp: 'Cargando...',
    zeroTierIp: 'Cargando...',
    zeroTierId: '...'
  };

  activeWebSessions: any[] = [];
  isHost: boolean = false;

  private statsSubscription: Subscription;
  private presenceSubscription: Subscription;
  private logoutSubscription: Subscription;
  private sessionClosedSubscription: Subscription;

  // Chart options
  chartOptions: any;
  cpuHistory: number[] = Array(15).fill(0);
  ramHistory: number[] = Array(15).fill(0);

  constructor(
    public mcService: McServerService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.iconService.addIcon(...[RiseOutline, FallOutline, SettingOutline, DatabaseOutline, ApiOutline, MonitorOutline, CodeOutline, CheckCircleOutline, CloseCircleOutline, UserAddOutline, FrownOutline, WarningOutline]);
    this.isHost = this.authService.user?.role === 'host';
  }

  ngOnInit() {
    this.initChart();
    this.checkInitialStatus();
    this.loadNetworkInfo();
    this.statsSubscription = this.mcService.getStatsUpdate().subscribe(data => {
      setTimeout(() => {
        this.serverStats = { ...this.serverStats, ...data };
        this.serverStatus = data.status || 'online';
        
        // Update history
        this.cpuHistory.push(data.cpu || 0);
        this.cpuHistory.shift(); // keep 15 points
        
        const ramVal = data.ram ? parseInt(data.ram.toString().replace(/\D/g,'')) : 0;
        this.ramHistory.push(ramVal);
        this.ramHistory.shift();

        this.updateChart();
        this.cdr.detectChanges();
      });
    });

    this.presenceSubscription = this.mcService.getPresenceUpdate().subscribe(users => {
      this.activeWebSessions = users;
      this.cdr.detectChanges();
    });

    this.logoutSubscription = this.mcService.getForcedLogout().subscribe(msg => {
      alert(msg);
      this.authService.logout().subscribe(() => {
          this.router.navigate(['/login']);
      });
    });

    this.sessionClosedSubscription = this.mcService.getSessionClosed().subscribe(() => {
        this.authService.logout().subscribe(() => {
          this.router.navigate(['/login']);
        });
    });
  }

  initChart() {
    this.chartOptions = {
        series: [
            { name: 'CPU %', data: this.cpuHistory },
            { name: 'RAM (MB)', data: this.ramHistory }
        ],
        chart: { type: 'area', height: 260, animations: { enabled: true, easing: 'linear', dynamicAnimation: { speed: 1000 } }, toolbar: { show: false }, background: 'transparent' },
        colors: ['#068fff', '#ffb020'],
        stroke: { curve: 'smooth', width: 2 },
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 90, 100] } },
        dataLabels: { enabled: false },
        xaxis: { labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false }, tooltip: { enabled: false } },
        yaxis: [
            { seriesName: 'CPU %', show: false, min: 0, max: 100 },
            { seriesName: 'RAM (MB)', show: false, min: 0 }
        ],
        grid: { show: false, padding: { top: 0, right: 0, bottom: 0, left: -10 } },
        theme: { mode: 'dark' },
        legend: { show: false }
    };
  }

  updateChart() {
      if(this.chartOptions && this.chartOptions.series) {
          this.chartOptions.series = [
              { name: 'CPU %', data: [...this.cpuHistory] },
              { name: 'RAM (MB)', data: [...this.ramHistory] }
          ];
      }
  }

  ngOnDestroy() {
    if (this.statsSubscription) this.statsSubscription.unsubscribe();
    if (this.presenceSubscription) this.presenceSubscription.unsubscribe();
    if (this.logoutSubscription) this.logoutSubscription.unsubscribe();
    if (this.sessionClosedSubscription) this.sessionClosedSubscription.unsubscribe();
  }

  checkInitialStatus() {
    this.mcService.getStatus().subscribe({
      next: (data) => {
        setTimeout(() => {
          this.serverStatus = data.status;
          this.serverStats = { ...this.serverStats, ...data };
          this.cdr.detectChanges();
        });
      },
      error: () => {
        setTimeout(() => {
          this.serverStatus = 'offline';
          this.cdr.detectChanges();
        });
      }
    });
  }

  getUptimeFormat() {
    const s = this.serverStats.uptime;
    if (!s) return '0s';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m ${s % 60}s`;
  }

  getPlayerSkin(name: string): string {
    return `https://minotar.net/avatar/${name}/32`;
  }

  loadNetworkInfo() {
    this.mcService.getNetworkInfo().subscribe({
      next: (data) => {
        Promise.resolve().then(() => {
          this.networkInfo = data;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        console.error('Error loading network info');
      }
    });
  }

  kickWebUser(name: string) {
      if (confirm(`¿Estás seguro de que quieres desconectar a ${name}?`)) {
          this.mcService.kickUser(name);
      }
  }

  closeHost() {
      if (confirm('¿Estás seguro de que quieres cerrar el Host? Esto desconectará a todos los visitantes.')) {
          // Primero cierra la sesión en el servidor (notifica a todos los visitantes)
          this.mcService.closeHostSession();
          // Luego hace logout local inmediatamente y redirige al login
          setTimeout(() => {
              this.authService.logout().subscribe(() => {
                  this.router.navigate(['/login']);
              });
          }, 500);
      }
  }
}
