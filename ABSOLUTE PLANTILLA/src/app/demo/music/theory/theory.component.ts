import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent } from '../../../../app/theme/shared/components/card/card.component';
import { Scale, Key, Note, Chord } from '@tonaljs/tonal';

@Component({
    selector: 'app-theory',
    standalone: true,
    imports: [CommonModule, CardComponent],
    templateUrl: './theory.component.html',
    styleUrls: ['./theory.component.scss']
})
export default class TheoryComponent implements OnInit {
    selectedRoot: string = 'C';
    selectedScale: string = 'major'; // Nombres reales de tonalJS

    roots: string[] = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];
    scales: { name: string, label: string }[] = [
        { name: 'major', label: 'Major (Jónico)' },
        { name: 'minor', label: 'Minor (Eólico)' },
        { name: 'dorian', label: 'Dorian' },
        { name: 'phrygian', label: 'Phrygian' },
        { name: 'lydian', label: 'Lydian' },
        { name: 'mixolydian', label: 'Mixolydian' },
        { name: 'locrian', label: 'Locrian' },
        { name: 'minor pentatonic', label: 'Minor Pentatonic' },
        { name: 'major pentatonic', label: 'Major Pentatonic' }
    ];

    calculatedNotes: string[] = [];
    chords: string[] = [];
    dynamicTip: string = '';

    constructor() { }

    ngOnInit(): void {
        this.calculateTheory();
    }

    selectRoot(root: string) {
        this.selectedRoot = root;
        this.calculateTheory();
    }

    selectScale(scale: string) {
        this.selectedScale = scale;
        this.calculateTheory();
    }

    calculateTheory() {
        // Generar notas
        const scaleType = this.selectedRoot + ' ' + this.selectedScale;
        const scaleData = Scale.get(scaleType);
        
        if (!scaleData.empty) {
            this.calculatedNotes = scaleData.notes.map(Note.simplify);
        } else {
            this.calculatedNotes = [];
        }

        // Generar acordes (Campo armónico)
        if (this.selectedScale === 'major') {
            const keyData = Key.majorKey(this.selectedRoot);
            this.chords = [...keyData.chords];
            this.dynamicTip = `La escala ${this.selectedScale} es ideal para crear atmósferas brillantes y alegres. Prueba usar el acorde ${this.chords[4] || 'V7'} para crear tensión antes de resolver a ${this.calculatedNotes[0]}.`;
        } else if (this.selectedScale === 'minor') {
            const keyData = Key.minorKey(this.selectedRoot);
            this.chords = [...keyData.natural.chords];
            this.dynamicTip = `La escala ${this.selectedScale} genera emoción y melancolía. Puedes usar ${keyData.harmonic.chords[4] || 'V7'} (de la menor armónica) para resolver con más fuerza a ${this.calculatedNotes[0]}m.`;
        } else {
            // Para modos y pentatónicas donde Key no está directo, derivamos triadas básicas
            this.chords = [];
            if (this.calculatedNotes.length >= 7) {
                for (let i = 0; i < 7; i++) {
                    const root = this.calculatedNotes[i];
                    const third = this.calculatedNotes[(i + 2) % 7];
                    const fifth = this.calculatedNotes[(i + 4) % 7];
                    // Un análisis simplificado
                    this.chords.push(root + ' triad'); // Placeholder real o aproximación
                }
            } else {
                this.chords = this.calculatedNotes.map(n => n + '5'); // Power chords para pentatónicas
            }
            this.dynamicTip = `El modo ${this.selectedScale} tiene un color único. Experimenta tocando progresiones sobre un bajo pedal en ${this.calculatedNotes[0]}.`;
        }
    }
}
