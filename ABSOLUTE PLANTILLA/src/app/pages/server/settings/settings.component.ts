import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardComponent } from '../../../theme/shared/components/card/card.component';
import { McServerService } from '../../../theme/shared/service/mc-server.service';
import Swal from 'sweetalert2';
import { IconDirective, IconService } from '@ant-design/icons-angular';
import {
    SettingOutline,
    SaveOutline,
    SyncOutline
} from '@ant-design/icons-angular/icons';

@Component({
    selector: 'app-settings',
    standalone: true,
    imports: [CommonModule, FormsModule, CardComponent, IconDirective],
    templateUrl: './settings.component.html',
    styleUrls: ['./settings.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsComponent implements OnInit, OnDestroy {
    settings: any = {};
    settingKeys: string[] = [];
    loading: boolean = false;
    startupConfig: any = { maxRam: '4G', minRam: '2G', jarName: 'fabric-server-launch.jar' };
    loadingStartup: boolean = false;
    private propertiesSubscription!: any;

    // Opciones de RAM
    ramOptions = ['1G', '2G', '4G', '6G', '8G', '10G', '12G', '16G'];

    private mcService = inject(McServerService);
    private cdr = inject(ChangeDetectorRef);
    private iconService = inject(IconService);

    // Ajustes comunes para mostrar primero
    commonKeys = [
        'difficulty',
        'gamemode',
        'max-players',
        'motd',
        'pvp',
        'level-seed',
        'view-distance',
        'simulation-distance',
        'white-list',
        'enforce-whitelist',
        'online-mode',
        'spawn-protection'
    ];

    constructor() {
        this.iconService.addIcon(...[SettingOutline, SaveOutline, SyncOutline]);
    }

    ngOnInit() {
        this.loadSettings();
        this.loadStartupConfig();
        
        this.propertiesSubscription = this.mcService.getPropertiesChanged().subscribe(() => {
            console.log("[SETTINGS] Cambio en propiedades detectado, recargando...");
            this.loadSettings();
        });
    }

    ngOnDestroy() {
        if (this.propertiesSubscription) {
            this.propertiesSubscription.unsubscribe();
        }
    }

    loadStartupConfig() {
        this.loadingStartup = true;
        this.mcService.getStartupConfig().subscribe({
            next: (config) => {
                this.startupConfig = config;
                this.loadingStartup = false;
                this.cdr.markForCheck();
            },
            error: () => {
                this.loadingStartup = false;
                this.cdr.markForCheck();
            }
        });
    }

    loadSettings() {
        this.loading = true;
        this.cdr.markForCheck();

        this.mcService.getProperties().subscribe({
            next: (data) => {
                this.settings = data;
                this.settingKeys = Object.keys(data).sort((a, b) => {
                    const aIndex = this.commonKeys.indexOf(a);
                    const bIndex = this.commonKeys.indexOf(b);
                    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                    if (aIndex !== -1) return -1;
                    if (bIndex !== -1) return 1;
                    return a.localeCompare(b);
                });
                this.loading = false;
                this.cdr.markForCheck();
            },
            error: (err) => {
                this.loading = false;
                this.cdr.markForCheck();
                Swal.fire({
                    icon: 'warning',
                    title: 'Advertencia',
                    text: 'No se pudo cargar la configuración.',
                    background: '#000000',
                    color: '#e2e8f0'
                });
            }
        });
    }

    saveSettings() {
        Swal.fire({
            title: 'Guardando ajustes...',
            allowOutsideClick: false,
            background: '#000000',
            color: '#e2e8f0',
            didOpen: () => Swal.showLoading()
        });

        // Guardar configuración de inicio también
        this.mcService.saveStartupConfig(this.startupConfig).subscribe();

        this.mcService.saveProperties(this.settings).subscribe({
            next: () => {
                Swal.fire({
                    icon: 'success',
                    title: '¡Guardado!',
                    text: 'Los ajustes se han actualizado correctamente. Reinicie el servidor para aplicar los cambios.',
                    background: '#000000',
                    color: '#e2e8f0',
                    confirmButtonColor: '#00e5ff'
                });
            },
            error: (err) => {
                Swal.fire({
                    icon: 'error',
                    title: 'Error al guardar',
                    text: err.message,
                    background: '#000000',
                    color: '#f87171'
                });
            }
        });
    }

    getType(key: string): string {
        const val = this.settings[key];
        if (typeof val === 'boolean') return 'boolean';
        if (typeof val === 'number') return 'number';
        return 'string';
    }

    getFriendlyLabel(key: string): string {
        return key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
}
