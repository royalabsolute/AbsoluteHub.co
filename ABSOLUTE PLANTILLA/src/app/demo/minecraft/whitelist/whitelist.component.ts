import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { McServerService } from '../../../../app/theme/shared/service/mc-server.service';
import { CardComponent } from '../../../../app/theme/shared/components/card/card.component';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-whitelist',
    standalone: true,
    imports: [CommonModule, FormsModule, CardComponent],
    templateUrl: './whitelist.component.html',
    styleUrls: ['./whitelist.component.scss']
})
export default class WhitelistComponent implements OnInit {
    whitelist: any[] = [];
    newPlayerName: string = '';
    loading: boolean = false;
    private whitelistSubscription!: any;

    constructor(private mcService: McServerService) { }

    ngOnInit(): void {
        this.loadWhitelist();
        this.whitelistSubscription = this.mcService.getWhitelistChanged().subscribe(() => {
            this.loadWhitelist();
        });
    }

    loadWhitelist() {
        this.loading = true;
        this.mcService.getWhitelist().subscribe({
            next: (data) => {
                this.whitelist = data;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    addPlayer() {
        if (!this.newPlayerName.trim()) return;

        this.loading = true;
        this.mcService.addToWhitelist(this.newPlayerName).subscribe({
            next: () => {
                Swal.fire('Añadido', `${this.newPlayerName} ha sido añadido a la Whitelist`, 'success');
                this.newPlayerName = '';
                // No es necesario llamar a loadWhitelist() aquí, el socket lo hará
            },
            error: (err) => {
                this.loading = false;
                Swal.fire('Error', 'No se pudo añadir al jugador', 'error');
            }
        });
    }

    removePlayer(name: string) {
        Swal.fire({
            title: '¿Eliminar?',
            text: `¿Estás seguro de eliminar a ${name} de la Whitelist?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                this.loading = true;
                this.mcService.removeFromWhitelist(name).subscribe({
                    next: () => {
                        Swal.fire('Eliminado', 'Jugador borrado de la lista', 'success');
                        // No es necesario llamar a loadWhitelist() aquí, el socket lo hará
                    },
                    error: () => {
                        this.loading = false;
                        Swal.fire('Error', 'No se pudo eliminar al jugador', 'error');
                    }
                });
            }
        });
    }

    getPlayerSkin(name: string): string {
        return `https://minotar.net/avatar/${name}/64`;
    }
}
