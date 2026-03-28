import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent } from '../../../theme/shared/components/card/card.component';
import { McServerService } from '../../../theme/shared/service/mc-server.service';
import Swal from 'sweetalert2';
import { Subscription } from 'rxjs';
import { IconDirective, IconService } from '@ant-design/icons-angular';
import {
    FolderOpenOutline,
    ArrowLeftOutline,
    FolderFill,
    FileFill,
    DeleteOutline,
    DownloadOutline,
    UploadOutline,
    EditOutline,
    PlusOutline,
    SaveOutline,
    TagOutline
} from '@ant-design/icons-angular/icons';

@Component({
    selector: 'app-files',
    standalone: true,
    imports: [CommonModule, CardComponent, IconDirective],
    templateUrl: './files.component.html',
    styleUrls: ['./files.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class FilesComponent implements OnInit, OnDestroy {
    files: any[] = [];
    currentPath: string = '';
    private iconService = inject(IconService);
    private cdr = inject(ChangeDetectorRef);
    private filesSubscription!: Subscription;

    constructor(private mcService: McServerService) {
        this.iconService.addIcon(...[
            FolderOpenOutline,
            ArrowLeftOutline,
            FolderFill,
            FileFill,
            DeleteOutline,
            DownloadOutline,
            UploadOutline,
            EditOutline,
            PlusOutline,
            SaveOutline,
            TagOutline
        ]);
    }

    ngOnInit() {
        this.loadFiles();

        // Escucha cambios en los archivos de forma global (WebSocket)
        this.filesSubscription = this.mcService.getFilesChanged().subscribe(() => {
            console.log("[FILES] Cambio detectado, recargando...");
            this.loadFiles();
        });
    }

    ngOnDestroy() {
        if (this.filesSubscription) {
            this.filesSubscription.unsubscribe();
        }
    }

    loadFiles() {
        this.mcService.listFiles(this.currentPath).subscribe(data => {
            this.files = data;
            this.cdr.markForCheck();
        });
    }

    navigateTo(path: string) {
        this.currentPath = path;
        this.loadFiles();
    }

    goBack() {
        const parts = this.currentPath.split(/[/\\]/);
        parts.pop();
        this.currentPath = parts.join('/');
        this.loadFiles();
    }

    // Upload Logic
    onFileSelected(event: any) {
        const files: FileList = event.target.files;
        if (files.length > 0) {
            const fileArray = Array.from(files);

            Swal.fire({
                title: 'Subiendo archivos...',
                text: 'Por favor, espere. No cierre esta ventana.',
                allowOutsideClick: false,
                background: '#11141e',
                color: '#e2e8f0',
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            this.mcService.uploadFiles(this.currentPath, fileArray).subscribe({
                next: () => {
                    this.loadFiles();
                    // Resetear el input
                    event.target.value = '';
                    this.cdr.markForCheck();
                    Swal.fire({
                        icon: 'success',
                        title: '¡Subida completada!',
                        text: `${fileArray.length} archivo(s) se subieron con éxito.`,
                        background: '#11141e',
                        color: '#e2e8f0',
                        confirmButtonColor: '#00e5ff'
                    });
                },
                error: (err) => {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error de Subida',
                        text: err.message,
                        background: '#11141e',
                        color: '#f87171',
                        confirmButtonColor: '#00e5ff'
                    });
                }
            });
        }
    }

    async createFolder() {
        const result = await Swal.fire({
            title: 'Nueva Carpeta',
            input: 'text',
            inputLabel: 'Ingrese el nombre de la carpeta',
            inputPlaceholder: 'Ej. world_backup',
            showCancelButton: true,
            confirmButtonText: 'Crear',
            cancelButtonText: 'Cancelar',
            background: '#11141e',
            color: '#e2e8f0',
            confirmButtonColor: '#00e5ff',
            inputValidator: (value) => {
                if (!value || value.trim() === '') {
                    return 'El nombre no puede estar vacío';
                }
                return null;
            }
        });

        if (result.isConfirmed) {
            const folderName = result.value;
            const targetPath = this.currentPath ? `${this.currentPath}/${folderName}` : folderName;

            Swal.fire({ title: 'Creando...', allowOutsideClick: false, didOpen: () => Swal.showLoading(), background: '#11141e', color: '#e2e8f0' });

            this.mcService.createDirectory(targetPath).subscribe({
                next: () => {
                    this.loadFiles();
                    this.cdr.markForCheck();
                    Swal.close();
                },
                error: (err) => Swal.fire({ icon: 'error', title: 'Error al crear', text: err.message, background: '#11141e', color: '#f87171' })
            });
        }
    }

    async renameFile(file: any) {
        const result = await Swal.fire({
            title: 'Renombrar',
            input: 'text',
            inputValue: file.name,
            inputLabel: `Nuevo nombre para ${file.isDirectory ? 'la carpeta' : 'el archivo'}`,
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText: 'Cancelar',
            background: '#11141e',
            color: '#e2e8f0',
            confirmButtonColor: '#00e5ff',
            inputValidator: (value) => {
                if (!value || value.trim() === '' || value === file.name) {
                    return 'Ingrese un nombre válido y diferente.';
                }
                return null;
            }
        });

        if (result.isConfirmed) {
            const newName = result.value;
            Swal.fire({ title: 'Renombrando...', allowOutsideClick: false, didOpen: () => Swal.showLoading(), background: '#11141e', color: '#e2e8f0' });

            this.mcService.renameFile(file.path, newName).subscribe({
                next: () => {
                    this.loadFiles();
                    this.cdr.markForCheck();
                    Swal.close();
                },
                error: (err) => Swal.fire({ icon: 'error', title: 'Error al renombrar', text: err.message, background: '#11141e', color: '#f87171' })
            });
        }
    }

    downloadFile(file: any) {
        if (!file.isDirectory) {
            const url = this.mcService.getDownloadUrl(file.path);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = file.name;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
        }
    }

    async deleteFile(path: string) {
        const result = await Swal.fire({
            title: '¿Estás seguro?',
            text: "¡No podrás revertir esto!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#f87171',
            cancelButtonColor: '#475569',
            confirmButtonText: 'Sí, ¡eliminar!',
            cancelButtonText: 'Cancelar',
            background: '#11141e',
            color: '#e2e8f0'
        });

        if (result.isConfirmed) {
            Swal.fire({ title: 'Eliminando...', allowOutsideClick: false, didOpen: () => Swal.showLoading(), background: '#11141e', color: '#e2e8f0' });

            this.mcService.deleteFile(path).subscribe({
                next: () => {
                    this.loadFiles();
                    this.cdr.markForCheck();
                    Swal.fire({ icon: 'success', title: 'Eliminado!', text: 'El elemento ha sido borrado.', background: '#11141e', color: '#e2e8f0', confirmButtonColor: '#00e5ff' });
                },
                error: (err) => Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#11141e', color: '#f87171' })
            });
        }
    }

    formatSize(bytes: number | null): string {
        if (bytes === null) return '-';
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async editFile(file: any) {
        Swal.fire({
            title: `Editando ${file.name}`,
            allowOutsideClick: false,
            background: '#000000',
            color: '#e2e8f0',
            didOpen: () => Swal.showLoading()
        });

        this.mcService.readFile(file.path).subscribe({
            next: (data) => {
                Swal.fire({
                    title: `Editando: ${file.name}`,
                    input: 'textarea',
                    inputValue: data.content,
                    inputAttributes: {
                        'style': 'height: 400px; font-family: monospace; background: #0a0a0a; color: #00e5ff; border: 1px solid #1f1f1f;',
                        'spellcheck': 'false'
                    },
                    showCancelButton: true,
                    confirmButtonText: 'Guardar Cambios',
                    cancelButtonText: 'Cancelar',
                    background: '#000000',
                    color: '#e2e8f0',
                    confirmButtonColor: '#00e5ff',
                    cancelButtonColor: '#1f1f1f',
                    width: '80%',
                    customClass: {
                        input: 'p-3'
                    }
                }).then((result) => {
                    if (result.isConfirmed) {
                        this.saveFile(file.path, result.value);
                    }
                });
            },
            error: (err) => {
                Swal.fire({ icon: 'error', title: 'Error al abrir', text: err.message, background: '#000000', color: '#f87171' });
            }
        });
    }

    saveFile(path: string, content: string) {
        Swal.fire({ title: 'Guardando...', allowOutsideClick: false, background: '#000000', color: '#e2e8f0', didOpen: () => Swal.showLoading() });
        this.mcService.writeFile(path, content).subscribe({
            next: () => {
                Swal.fire({ icon: 'success', title: '¡Guardado!', text: 'El archivo se actualizó correctamente.', background: '#000000', color: '#e2e8f0', confirmButtonColor: '#00e5ff' });
            },
            error: (err) => {
                Swal.fire({ icon: 'error', title: 'Error al guardar', text: err.message, background: '#000000', color: '#f87171' });
            }
        });
    }

    isEditable(fileName: string): boolean {
        const ext = fileName.split('.').pop()?.toLowerCase();
        const allowed = ['properties', 'json', 'txt', 'yml', 'yaml', 'log', 'js', 'ts', 'css', 'scss', 'html', 'md'];
        return allowed.includes(ext || '');
    }
}
