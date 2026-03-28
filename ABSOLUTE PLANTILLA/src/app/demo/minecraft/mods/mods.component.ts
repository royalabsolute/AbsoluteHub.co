import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { McServerService } from '../../../../app/theme/shared/service/mc-server.service';
import { CardComponent } from '../../../../app/theme/shared/components/card/card.component';

@Component({
    selector: 'app-mods',
    standalone: true,
    imports: [CommonModule, CardComponent],
    templateUrl: './mods.component.html',
    styleUrls: ['./mods.component.scss']
})
export default class ModsComponent implements OnInit {
    mods: any[] = [];
    loading: boolean = false;

    constructor(
        private mcService: McServerService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        this.loadMods();
    }

    loadMods() {
        this.loading = true;
        this.mcService.getMods().subscribe({
            next: (data) => {
                this.mods = data;
                this.loading = false;
                this.cdr.detectChanges();
            },
            error: () => {
                this.loading = false;
                this.cdr.detectChanges();
            }
        });
    }
}
