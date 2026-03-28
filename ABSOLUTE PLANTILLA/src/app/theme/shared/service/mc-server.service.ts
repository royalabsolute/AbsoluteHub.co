import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';

@Injectable({
    providedIn: 'root'
})
export class McServerService {
    public apiUrl = `${window.location.protocol}//${window.location.hostname}:3000`; // LOCAL_PORT_MARKER
    private socket: Socket;

    constructor(private http: HttpClient) {
        const token = localStorage.getItem('abs_token') || '';
        this.socket = io(this.apiUrl, { 
            transports: ['websocket', 'polling'],
            auth: { token },
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10000,
            timeout: 20000
        });

        this.socket.on('connect', () => {
            console.log('[Socket] Conectado al backend');
        });

        this.socket.on('disconnect', (reason: string) => {
            console.warn('[Socket] Desconectado:', reason);
        });

        this.socket.on('connect_error', (err: Error) => {
            console.warn('[Socket] Error de conexión, reintentando...', err.message);
        });
    }

    private getHeaders() {
        const token = localStorage.getItem('abs_token') || '';
        return new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });
    }

    private getToken(): string {
        return localStorage.getItem('abs_token') || '';
    }

    // HTTP Methods
    getStatus(): Observable<any> {
        return this.http.get(`${this.apiUrl}/status`, { headers: this.getHeaders() });
    }

    startServer(): Observable<any> {
        return this.http.post(`${this.apiUrl}/server/start`, {}, { headers: this.getHeaders() });
    }

    stopServer(): Observable<any> {
        return this.http.post(`${this.apiUrl}/server/stop`, {}, { headers: this.getHeaders() });
    }

    restartServer(): Observable<any> {
        return this.http.post(`${this.apiUrl}/server/restart`, {}, { headers: this.getHeaders() });
    }

    // File Manager Methods
    listFiles(path: string = ''): Observable<any> {
        return this.http.get(`${this.apiUrl}/files/list?path=${path}`, { headers: this.getHeaders() });
    }

    createDirectory(path: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/files/mkdir`, { path }, { headers: this.getHeaders() });
    }

    renameFile(oldPath: string, newName: string): Observable<any> {
        return this.http.put(`${this.apiUrl}/files/rename`, { path: oldPath, newName }, { headers: this.getHeaders() });
    }

    uploadFiles(path: string, files: File[]): Observable<any> {
        const formData = new FormData();
        formData.append('path', path);
        files.forEach(file => {
            formData.append('files', file);
        });

        // Solo enviamos el Bearer header manualmente
        return this.http.post(`${this.apiUrl}/files/upload`, formData, {
            headers: this.getHeaders()
        });
    }

    getDownloadUrl(path: string): string {
        // Pasamos el token en queryString
        return `${this.apiUrl}/files/download?path=${encodeURIComponent(path)}&token=${this.getToken()}`;
    }

    deleteFile(path: string): Observable<any> {
        return this.http.delete(`${this.apiUrl}/files/delete`, {
            headers: this.getHeaders(),
            body: { path }
        });
    }

    readFile(path: string): Observable<any> {
        return this.http.get(`${this.apiUrl}/files/read?path=${encodeURIComponent(path)}`, { headers: this.getHeaders() });
    }

    writeFile(path: string, content: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/files/write`, { path, content }, { headers: this.getHeaders() });
    }

    // Socket Methods
    getConsoleOutput(): Observable<string> {
        return new Observable(observer => {
            this.socket.on('console-out', (data: string) => {
                observer.next(data);
            });
        });
    }

    getStatsUpdate(): Observable<any> {
        return new Observable(observer => {
            this.socket.on('stats-update', (data: any) => {
                observer.next(data);
            });
        });
    }

    getFilesChanged(): Observable<any> {
        return new Observable(observer => {
            this.socket.on('files-changed', (data: any) => {
                observer.next(data);
            });
        });
    }

    getWhitelistChanged(): Observable<any> {
        return new Observable(observer => {
            this.socket.on('whitelist-changed', () => observer.next(null));
        });
    }

    getPropertiesChanged(): Observable<any> {
        return new Observable(observer => {
            this.socket.on('properties-changed', () => observer.next(null));
        });
    }

    getBackupsChanged(): Observable<any> {
        return new Observable(observer => {
            this.socket.on('backups-changed', () => observer.next(null));
        });
    }

    getPresenceUpdate(): Observable<any> {
        return new Observable(observer => {
            this.socket.on('presence-update', (data: any) => {
                observer.next(data);
            });
        });
    }

    joinConsole() {
        this.socket.emit('join-console');
    }

    sendCommand(command: string) {
        this.socket.emit('console-command', command);
    }

    kickUser(name: string) {
        this.socket.emit('kick-user', name);
    }

    closeHostSession() {
        this.socket.emit('close-host-session');
    }

    getForcedLogout(): Observable<string> {
        return new Observable(observer => {
            this.socket.on('forced-logout', (msg: string) => observer.next(msg));
        });
    }

    getSessionClosed(): Observable<void> {
        return new Observable(observer => {
            this.socket.on('session-closed', () => observer.next());
        });
    }

    // Startup Config Methods
    getStartupConfig(): Observable<any> {
        return this.http.get(`${this.apiUrl}/server/config`, { headers: this.getHeaders() });
    }

    saveStartupConfig(config: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/server/config`, config, { headers: this.getHeaders() });
    }

    // Whitelist Methods
    getWhitelist(): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/server/whitelist`, { headers: this.getHeaders() });
    }

    addToWhitelist(name: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/server/whitelist/add`, { name }, { headers: this.getHeaders() });
    }

    removeFromWhitelist(name: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/server/whitelist/remove`, { name }, { headers: this.getHeaders() });
    }

    // Properties Methods
    getProperties(): Observable<any> {
        return this.http.get(`${this.apiUrl}/server/properties`, { headers: this.getHeaders() });
    }

    saveProperties(props: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/server/properties`, props, { headers: this.getHeaders() });
    }

    // Backup Methods
    getBackups(): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/server/backups`, { headers: this.getHeaders() });
    }

    createBackup(): Observable<any> {
        return this.http.post(`${this.apiUrl}/server/backups/create`, {}, { headers: this.getHeaders() });
    }

    deleteBackup(name: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/server/backups/delete`, { name }, { headers: this.getHeaders() });
    }

    getMods(): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/server/mods`, { headers: this.getHeaders() });
    }

    getNetworkInfo(): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/network/info`, { headers: this.getHeaders() });
    }
}
