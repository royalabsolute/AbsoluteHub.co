import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  public apiUrl = `${window.location.protocol}//${window.location.hostname}:3000`; // LOCAL_PORT_MARKER
  private _token = new BehaviorSubject<string | null>(localStorage.getItem('abs_token'));
  private _user = new BehaviorSubject<any>(JSON.parse(localStorage.getItem('abs_user') || 'null'));

  token$ = this._token.asObservable();
  user$ = this._user.asObservable();

  constructor(private http: HttpClient) {}

  get token() { return this._token.value; }
  get user() { return this._user.value; }

  getSessions(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/auth/sessions`);
  }

  loginHost(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/login/host`, data).pipe(
      tap((res: any) => this.setSession(res))
    );
  }

  loginVisitor(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/login/visitor`, data).pipe(
      tap((res: any) => this.setSession(res))
    );
  }

  exploreFolder(masterPassword: string, targetPath: string = ''): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/explore-folder`, { masterPassword, targetPath });
  }

  private setSession(res: any) {
    localStorage.setItem('abs_token', res.token);
    localStorage.setItem('abs_user', JSON.stringify(res));
    this._token.next(res.token);
    this._user.next(res);
  }

  logout() {
    const clearLocal = () => {
      localStorage.removeItem('abs_token');
      localStorage.removeItem('abs_user');
      this._token.next(null);
      this._user.next(null);
    };
    return this.http.post(`${this.apiUrl}/auth/logout`, {}, {
        headers: { 'Authorization': `Bearer ${this.token}` }
    }).pipe(
      tap(() => clearLocal()),
      catchError(() => { clearLocal(); return of(null); })
    );
  }

  isLoggedIn(): boolean {
    return !!this.token;
  }
}
