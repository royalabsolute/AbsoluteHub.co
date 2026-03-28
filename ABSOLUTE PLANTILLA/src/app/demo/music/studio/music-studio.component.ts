import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardComponent } from '../../../../app/theme/shared/components/card/card.component';
import { MusicStudioService } from '../../../../app/theme/shared/service/music-studio.service';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2/dist/sweetalert2.js';
import WaveSurfer from 'wavesurfer.js';

@Component({
    selector: 'app-music-studio',
    standalone: true,
    imports: [CommonModule, FormsModule, CardComponent],
    templateUrl: './music-studio.component.html',
    styleUrls: ['./music-studio.component.scss']
})
export default class MusicStudioComponent implements OnInit, OnDestroy {
    youtubeUrl: string = '';
    isProcessing: boolean = false;
    currentJobId: string | null = null;
    processingStep: string = 'Inactivo';
    progressPercent: number = 0;
    private progressSub!: Subscription;
    isPlaying: boolean = false;
    private alphaTabApi: any = null;

    stems: any[] = [
        { id: 'vocals', name: 'Voz (Vocals)', volume: 100, muted: false, solo: false, icon: 'customer-service', ws: null },
        { id: 'drums', name: 'Batería (Drums)', volume: 100, muted: false, solo: false, icon: 'thunderbolt', ws: null },
        { id: 'bass', name: 'Bajo (Bass)', volume: 100, muted: false, solo: false, icon: 'sound', ws: null },
        { id: 'other', name: 'Instrumentos (Other)', volume: 100, muted: false, solo: false, icon: 'audio', ws: null }
    ];

    constructor(
        private musicService: MusicStudioService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        this.progressSub = this.musicService.getMusicProgress().subscribe(data => {
            if (data.job_id === this.currentJobId) {
                this.progressPercent = data.progress;
                this.cdr.detectChanges();
            }
        });
    }

    ngOnDestroy(): void {
        if (this.progressSub) this.progressSub.unsubscribe();
        this.stems.forEach(stem => {
            if (stem.ws) stem.ws.destroy();
        });
    }

    startProcessing() {
        if (!this.youtubeUrl) return;

        // Diferimos el cambio de estado para evitar el error ExpressionChanged
        setTimeout(() => {
            this.isProcessing = true;
            this.processingStep = 'Iniciando IA...';
            this.cdr.detectChanges();
        });

        this.musicService.processMusic(this.youtubeUrl).subscribe({
            next: (res) => {
                this.currentJobId = res.job_id;
                this.checkStatus();
            },
            error: (err) => {
                Swal.fire('Error', 'No se pudo conectar con el motor de IA musical.', 'error');
                this.isProcessing = false;
            }
        });
    }

    checkStatus() {
        if (!this.currentJobId) return;

        this.musicService.getJobStatus(this.currentJobId).subscribe((res) => {
            if (res.status === 'processing') {
                this.processingStep = this.getStepLabel(res.step);
                setTimeout(() => this.checkStatus(), 3000);
            } else if (res.status === 'completed') {
                this.isProcessing = false;
                this.processingStep = 'Completado';
                Swal.fire('¡Listo!', 'La canción ha sido procesada.', 'success');
                setTimeout(() => {
                    this.initWaveSurfers(this.currentJobId!);
                    this.initAlphaTab();
                }, 100);
            } else if (res.status === 'failed') {
                this.isProcessing = false;
                Swal.fire('Error', 'Falló el procesamiento de IA: ' + res.error, 'error');
            }
        });
    }

    getStepLabel(step: string): string {
        const labels: { [key: string]: string } = {
            'downloading': 'Descargando audio de origen...',
            'separating_stems': 'Separando pistas (Demucs AI)...',
            'transcribing': 'Generando partitura MIDI...',
            'init': 'Preparando archivos...'
        };
        return labels[step] || 'Procesando...';
    }

    initWaveSurfers(jobId: string) {
        this.stems.forEach(stem => {
            if (stem.ws) stem.ws.destroy();
            stem.ws = WaveSurfer.create({
                container: `#waveform-${stem.id}`,
                waveColor: '#4e5d78',
                progressColor: '#0dcaf0',
                height: 48,
                barWidth: 2,
                barGap: 1,
                barRadius: 2,
                url: this.musicService.getFileUrl(jobId, `${stem.id}.mp3`)
            });

            // Master sync reference point
            if (stem.id === 'vocals') {
                stem.ws.on('finish', () => {
                    this.isPlaying = false;
                    this.cdr.detectChanges();
                });
            }
        });
    }

    togglePlay() {
        if (!this.stems[0]?.ws) return;
        this.isPlaying = !this.isPlaying;
        this.stems.forEach(stem => {
            if (this.isPlaying) {
                stem.ws.play();
            } else {
                stem.ws.pause();
            }
        });
        if (this.alphaTabApi) {
            this.alphaTabApi.playPause();
        }
    }

    onVolumeChange(stem: any) {
        if (stem.ws) {
            stem.ws.setVolume(stem.volume / 100);
        }
    }

    toggleMute(stem: any) {
        stem.muted = !stem.muted;
        if (stem.ws) {
            stem.ws.setMuted(stem.muted);
        }
    }

    getMidiUrl(): string {
        if (!this.currentJobId) return '#';
        return `${this.apiUrl}/music/files/${this.currentJobId}/${this.currentJobId}_basic_pitch.mid`;
    }

    initAlphaTab() {
        const midiUrl = this.getMidiUrl();
        if ((window as any).alphaTab) {
            this.renderMidi(midiUrl);
        } else {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/alphaTab.js';
            script.onload = () => this.renderMidi(midiUrl);
            document.head.appendChild(script);
        }
    }

    renderMidi(midiUrl: string) {
        setTimeout(() => {
            const container = document.getElementById('alphaTab-container');
            if (container) {
                container.innerHTML = '';
                this.alphaTabApi = new (window as any).alphaTab.AlphaTabApi(container, {
                    core: { file: midiUrl },
                    display: {
                        layoutMode: 'page',
                        staveProfile: 'scoretab'
                    },
                    player: {
                        enablePlayer: true,
                        enableCursor: true,
                        enableUserInteraction: true,
                        soundFont: 'https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/soundfont/sonivox.sf2'
                    }
                });
            }
        }, 500);
    }
    
    get apiUrl() {
        return this.musicService.apiUrl;
    }
}
