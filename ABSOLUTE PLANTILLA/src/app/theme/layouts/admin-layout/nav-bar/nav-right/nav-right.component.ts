// angular import
import { Component, inject, input, output } from '@angular/core';
import { RouterModule } from '@angular/router';

// project import

// icon
import { IconService, IconDirective } from '@ant-design/icons-angular';
import {
  BellOutline,
  SettingOutline,
  GiftOutline,
  MessageOutline,
  PhoneOutline,
  CheckCircleOutline,
  LogoutOutline,
  EditOutline,
  UserOutline,
  ProfileOutline,
  WalletOutline,
  QuestionCircleOutline,
  LockOutline,
  CommentOutline,
  UnorderedListOutline,
  ArrowRightOutline,
  GithubOutline
} from '@ant-design/icons-angular/icons';
import { NgbDropdownModule, NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../shared/service/auth.service';
import { McServerService } from '../../../../shared/service/mc-server.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-nav-right',
  standalone: true,
  imports: [RouterModule, CommonModule, NgbDropdownModule],
  templateUrl: './nav-right.component.html',
  styleUrls: ['./nav-right.component.scss']
})
export class NavRightComponent {
  private iconService = inject(IconService);
  public authService = inject(AuthService);
  private mcService = inject(McServerService);

  styleSelectorToggle = input<boolean>();
  Customize = output();
  windowWidth: number;
  screenFull: boolean = true;
  
  connectedUsers: any[] = [];
  private presenceSub: Subscription;

  constructor() {
    this.windowWidth = window.innerWidth;
    this.iconService.addIcon(
      ...[
        CheckCircleOutline,
        GiftOutline,
        MessageOutline,
        SettingOutline,
        PhoneOutline,
        LogoutOutline,
        UserOutline,
        EditOutline,
        ProfileOutline,
        QuestionCircleOutline,
        LockOutline,
        CommentOutline,
        UnorderedListOutline,
        ArrowRightOutline,
        BellOutline,
        GithubOutline,
        WalletOutline
      ]
    );
  }

  ngOnInit() {
    if (this.authService.user?.role === 'host') {
      this.presenceSub = this.mcService.getPresenceUpdate().subscribe(users => {
        this.connectedUsers = users;
      });
    }
  }

  ngOnDestroy() {
    if (this.presenceSub) this.presenceSub.unsubscribe();
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => {
        window.location.href = '/login';
      },
      error: () => {
        // Aunque el backend falle, limpiamos la sesión local y redirigimos
        localStorage.removeItem('abs_token');
        localStorage.removeItem('abs_user');
        window.location.href = '/login';
      }
    });
  }

  profile = [];
  setting = [];
}

