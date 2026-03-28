import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { McServerService } from '../../../../app/theme/shared/service/mc-server.service';
import { CardComponent } from '../../../../app/theme/shared/components/card/card.component';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-backups',
    standalone: true,
    imports: [CommonModule, CardComponent],
    templateUrl: './backups.component.html',
    styleUrls: ['./backups.component.scss']
})
export default class BackupsComponent implements OnInit {
    backups: any[] = [];
    loading: boolean = false;
    private backupsSubscription!: any;

    constructor(
        private mcService: McServerService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        this.loadBackups();
        this.backupsSubscription = this.mcService.getBackupsChanged().subscribe(() => {
            this.loadBackups();
        });
    }

    loadBackups() {
        this.loading = true;
        this.mcService.getBackups().subscribe({
            next: (data) => {
                this.backups = data;
                this.loading = false;
                this.cdr.detectChanges();
            },
            error: () => {
                this.loading = false;
                this.cdr.detectChanges();
            }
        });
    }

    createBackup() {
        Swal.fire({
            title: 'Creando Backup...',
            text: 'Esto puede tardar dependiendo del tamaño de tu mundo.',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        this.mcService.createBackup().subscribe({
            next: (res) => {
                Swal.fire('¡Éxito!', `Backup '${res.name}' creado correctamente.`, 'success');
                // El socket refrescará la lista automáticamente
            },
            error: (err) => {
                Swal.fire('Error', 'No se pudo crear el backup: ' + err.message, 'error');
            }
        });
    }

    deleteBackup(name: string) {
        Swal.fire({
            title: '¿Eliminar backup?',
            text: `Vas a borrar permanentemente el archivo ${name}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                this.mcService.deleteBackup(name).subscribe({
                    next: () => {
                        Swal.fire('Eliminado', 'El backup ha sido borrado.', 'success');
                        // El socket refrescará la lista automáticamente
                    },
                    error: () => {
                        Swal.fire('Error', 'No se pudo borrar el archivo.', 'error');
                    }
                });
            }
        });
    }

    formatDate(dateStr: string): string {
        const d = new Date(dateStr);
        return d.toLocaleString();
    }
}
