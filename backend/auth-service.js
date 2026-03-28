const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

class AuthService {
    constructor() {
        this.configPath = path.join(__dirname, 'config');
        this.sessionsFile = path.join(this.configPath, 'sessions.json');
        this.settingsFile = path.join(this.configPath, 'settings.json');
        
        this.activeSessions = []; // Shared sessions (Hosts)
        this.activeTokens = new Map(); // token -> { role, name, sessionId }
        
        this.settings = {
            mcPath: process.env.MC_SERVER_PATH || '',
            sharedPath: process.env.SHARED_FILES_PATH || ''
        };
    }

    async init() {
        await fs.ensureDir(this.configPath);
        
        // Cargar sesiones de forma segura (archivo vacío o corrupto = array vacío)
        if (await fs.pathExists(this.sessionsFile)) {
            try {
                const raw = await fs.readFile(this.sessionsFile, 'utf8');
                const trimmed = raw.trim();
                this.activeSessions = trimmed ? JSON.parse(trimmed) : [];
            } catch (e) {
                console.error('[AUTH] sessions.json corrupto, reiniciando vacío:', e.message);
                this.activeSessions = [];
                await this.saveSessions();
            }
        } else {
            await this.saveSessions();
        }
        
        if (await fs.pathExists(this.settingsFile)) {
            try {
                this.settings = await fs.readJson(this.settingsFile);
            } catch (e) {
                console.error('[AUTH] settings.json corrupto:', e.message);
                await this.saveSettings();
            }
        } else {
            await this.saveSettings();
        }
        
        // Restaurar tokens de sesiones persistentes (Host)
        this.activeSessions.forEach(s => {
            if (s.token) {
                this.activeTokens.set(s.token, { role: 'host', name: s.hostName, sessionId: s.id });
            }
        });

        console.log(`[AUTH] Inicializado. Sesiones activas: ${this.activeSessions.length}`);
    }

    async saveSettings() {
        await fs.writeJson(this.settingsFile, this.settings, { spaces: 2 });
    }

    async saveSessions() {
        try {
            await fs.writeJson(this.sessionsFile, this.activeSessions, { spaces: 2 });
        } catch (e) {
            console.error('[AUTH] Error guardando sesiones:', e.message);
        }
    }

    verifyMaster(password) {
        return password === process.env.MASTER_PASSWORD;
    }

    async createHostSession(hostName, sessionPass, config) {
        const token = crypto.randomUUID();
        const sessionId = crypto.randomBytes(4).toString('hex');
        
        const session = {
            id: sessionId,
            hostName,
            password: sessionPass,
            token,
            createdAt: new Date().toISOString()
        };

        // Reemplazar si el mismo host intenta crear otra? 
        // Por simplicidad permitimos múltiples o limpiamos anteriores.
        this.activeSessions.push(session);
        await this.saveSessions();

        this.activeTokens.set(token, { role: 'host', name: hostName, sessionId });

        if (config) {
            this.settings = { ...this.settings, ...config };
            await this.saveSettings();
        }

        return { token, sessionId, role: 'host' };
    }

    async joinVisitor(sessionId, password, visitorName) {
        const session = this.activeSessions.find(s => s.id === sessionId);
        if (!session) throw new Error('Sesión no encontrada');
        if (session.password !== password) throw new Error('Contraseña de sesión incorrecta');

        const token = crypto.randomUUID();
        this.activeTokens.set(token, { role: 'visitor', name: visitorName, sessionId });

        return { token, role: 'visitor', hostName: session.hostName };
    }

    validateToken(token) {
        return this.activeTokens.get(token);
    }

    getPublicSessions() {
        return this.activeSessions.map(s => ({
            id: s.id,
            hostName: s.hostName,
            createdAt: s.createdAt
        }));
    }

    async logout(token) {
        try {
            const info = this.activeTokens.get(token);
            if (info && info.role === 'host') {
                this.activeSessions = this.activeSessions.filter(s => s.token !== token);
                await this.saveSessions();
            }
            this.activeTokens.delete(token);
        } catch (e) {
            console.error('[AUTH] Error en logout:', e.message);
            this.activeTokens.delete(token);
        }
    }
    async deleteSession(sessionId) {
        this.activeSessions = this.activeSessions.filter(s => s.id !== sessionId);
        // Also remove tokens associated with this session
        for (const [token, info] of this.activeTokens.entries()) {
            if (info.sessionId === sessionId) {
                this.activeTokens.delete(token);
            }
        }
        await this.saveSessions();
    }
}

const instance = new AuthService();
module.exports = instance;
