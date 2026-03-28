import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { io, Socket } from 'socket.io-client';

@Injectable({
    providedIn: 'root'
})
export class MusicStudioService {
    public apiUrl = `${window.location.protocol}//${window.location.hostname}:3000`; // LOCAL_PORT_MARKER
    private socket!: Socket;

    constructor(private http: HttpClient) { }

    private getToken(): string {
        return localStorage.getItem('abs_token') || '';
    }

    private getHeaders() {
        const token = this.getToken();
        return new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });
    }

    getFileUrl(jobId: string, filename: string): string {
        return `${this.apiUrl}/music/files/${jobId}/htdemucs/${jobId}/${filename}`;
    }

    processMusic(source: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/music/process`, { source }, { headers: this.getHeaders() });
    }

    getJobStatus(jobId: string): Observable<any> {
        return this.http.get(`${this.apiUrl}/music/status/${jobId}`, { headers: this.getHeaders() });
    }

    getMusicProgress(): Observable<any> {
        return new Observable(observer => {
            if (!this.socket || (this.socket as any).io.uri !== this.apiUrl) {
                if (this.socket) this.socket.disconnect();
                this.socket = io(this.apiUrl, {
                    auth: { token: this.getToken() }
                });
            }
            this.socket.on('music-progress', (data: any) => {
                observer.next(data);
            });
        });
    }
}
