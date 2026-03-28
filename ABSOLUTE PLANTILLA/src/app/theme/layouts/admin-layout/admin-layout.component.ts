// Angular import
import { Component, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

// Project import

import { NavBarComponent } from './nav-bar/nav-bar.component';
import { NavigationComponent } from './navigation/navigation.component';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { McServerService } from '../../shared/service/mc-server.service';
import { Subscription } from 'rxjs';
import { IconService, IconDirective } from '@ant-design/icons-angular';
import { MonitorOutline, SettingOutline, DatabaseOutline, ApiOutline, FieldTimeOutline, CloudOutline, CheckCircleOutline, CloseCircleOutline } from '@ant-design/icons-angular/icons';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, BreadcrumbComponent, NavigationComponent, NavBarComponent, RouterModule, IconDirective],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminComponent {
  // public props
  navCollapsed: boolean = false;
  navCollapsedMob: boolean = false;

  serverStats = { cpu: 0, ram: 0, mods: 0, size: '0 MB', uptime: 0, ping: 0, status: 'offline' };
  private statsSubscription: Subscription;

  constructor(private mcService: McServerService, private iconService: IconService, private cdr: ChangeDetectorRef) {
    this.iconService.addIcon(...[MonitorOutline, SettingOutline, DatabaseOutline, ApiOutline, FieldTimeOutline, CloudOutline, CheckCircleOutline, CloseCircleOutline]);
  }

  ngOnInit() {
    this.checkInitialStatus();
    this.statsSubscription = this.mcService.getStatsUpdate().subscribe(data => {
      setTimeout(() => {
        this.serverStats = { ...this.serverStats, ...data };
        this.cdr.markForCheck();
      });
    });
  }

  ngOnDestroy() {
    if (this.statsSubscription) this.statsSubscription.unsubscribe();
  }

  checkInitialStatus() {
    this.mcService.getStatus().subscribe({
      next: (data) => {
        setTimeout(() => {
          this.serverStats = { ...this.serverStats, ...data };
          this.cdr.markForCheck();
        });
      },
      error: () => {
        setTimeout(() => {
          this.serverStats.status = 'offline';
          this.cdr.markForCheck();
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

  // public method
  navMobClick() {
    this.navCollapsedMob = !this.navCollapsedMob;
    // Forzar que el sidebar no esté colapsado internamente si se abre en móvil
    if (this.navCollapsedMob) {
      this.navCollapsed = false;
    }
  }

  closeMenu() {
    this.navCollapsedMob = false;
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeMenu();
    }
  }
}
