import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CardComponent } from '../../../../app/theme/shared/components/card/card.component';

@Component({
    selector: 'app-map',
    standalone: true,
    imports: [CommonModule, CardComponent],
    templateUrl: './map.component.html',
    styleUrls: ['./map.component.scss']
})
export default class MapComponent {
    mapUrl: SafeResourceUrl;

    constructor(private sanitizer: DomSanitizer) {
        // URL por defecto para BlueMap/Dynmap (usualmente puerto 8100 o 8123)
        // Usamos la IP de ZeroTier
        this.mapUrl = this.sanitizer.bypassSecurityTrustResourceUrl('http://10.93.147.161:8100');
    }
}
