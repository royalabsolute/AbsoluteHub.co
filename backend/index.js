require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');
const mcService = require('./mc-service');
const musicService = require('./music-service');
const fileService = require('./file-service');
const authService = require('./auth-service');
const os = require('os');
const fs = require('fs-extra');

const app = express();
// app.set('trust proxy', 1); // Cloudflare no longer used

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: true, // Dinámico
        methods: ["GET", "POST"],
        credentials: true
    },
    pingTimeout: 30000, 
    pingInterval: 10000,
    connectTimeout: 20000,
    transports: ['websocket', 'polling'] // Preferir websocket pero permitir polling
});

const PORT = process.env.PORT || 3000;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

app.use(cors({
    origin: true, // Permite cualquier origen de forma dinámica para desarrollo pro
    credentials: true
}));
app.use(express.json());

// Middleware de Logging (PRIMERO para ver todo)
app.use((req, res, next) => {
    console.log(`>>> [${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

// Ruta de prueba sin auth
app.get('/debug/ping', (req, res) => {
    res.json({ pong: true, time: new Date().toISOString(), message: "Backend is LIVE" });
});

// Middleware de seguridad por sesión
app.use((req, res, next) => {
    // Rutas públicas
    if (req.path === '/debug/ping' || req.path.startsWith('/auth/')) {
        return next();
    }

    let token = req.headers['authorization'] || req.query.token || '';
    if (token.startsWith('Bearer ')) token = token.slice(7);

    const session = authService.validateToken(token);
    if (session) {
        req.user = session; // Guardar info de usuario en la petición
        next();
    } else {
        res.status(401).json({ error: 'Sesión no válida o expirada' });
    }
});

// --- Endpoints de Autenticación ---

app.get('/auth/sessions', (req, res) => {
    res.json(authService.getPublicSessions());
});

app.post('/auth/login/host', async (req, res) => {
    const { masterPassword, hostName, sessionPassword, config } = req.body;
    if (authService.verifyMaster(masterPassword)) {
        try {
            const result = await authService.createHostSession(hostName, sessionPassword, config);
            // Aplicar rutas si se pasaron
            if (config?.mcPath) await mcService.setPath(config.mcPath);
            if (config?.sharedPath) await fileService.setPath(config.sharedPath);
            
            res.json(result);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    } else {
        res.status(401).json({ error: 'Contraseña maestra incorrecta' });
    }
});

app.post('/auth/login/visitor', async (req, res) => {
    const { sessionId, password, visitorName } = req.body;
    try {
        const result = await authService.joinVisitor(sessionId, password, visitorName);
        res.json(result);
    } catch (e) {
        res.status(401).json({ error: e.message });
    }
});

app.post('/auth/explore-folder', async (req, res) => {
    const { masterPassword } = req.body;
    if (!authService.verifyMaster(masterPassword)) {
        return res.status(401).json({ error: 'Contraseña maestra incorrecta' });
    }

    try {
        let cmd = '';
        if (process.platform === 'win32') {
            cmd = 'powershell -Command "Add-Type -AssemblyName System.windows.forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.ShowNewFolderButton = $true; if($f.ShowDialog() -eq \\\'OK\\\'){ $f.SelectedPath }"';
        } else if (process.platform === 'darwin') {
            cmd = `osascript -e 'POSIX path of (choose folder)'`;
        } else {
            // Linux (requiere zenity). Agregamos DISPLAY=:0 y xhost o sudo -u para GUI
            cmd = 'DISPLAY=:0 zenity --file-selection --directory --title="Selecciona la carpeta" || DISPLAY=:1 zenity --file-selection --directory --title="Selecciona la carpeta"';
        }

        const { exec } = require('child_process');
        const util = require('util');
        const execPromise = util.promisify(exec);

        const { stdout } = await execPromise(cmd);
        const selectedPath = stdout.trim();

        if (selectedPath) {
            res.json({ selectedPath });
        } else {
            res.status(400).json({ error: 'No se seleccionó ninguna carpeta' });
        }
    } catch (error) {
        // En Linux, cancelar Zenity arroja error por exit code != 0
        res.status(400).json({ error: 'Operación cancelada o herramienta no disponible' });
    }
});

app.post('/auth/logout', async (req, res) => {
    const token = req.headers['authorization']?.replace('Bearer ', '') || req.query.token;
    await authService.logout(token);
    res.json({ success: true });
});

// Servir archivos de música procesados
app.use('/music/files', express.static(path.join(__dirname, 'music', 'outputs')));

// Rutas de Telemetría y Control
app.get('/status', (req, res) => {
    res.json(mcService.getStatus());
});

app.get('/network/info', (req, res) => {
    res.json(mcService.getNetworkInfo());
});

app.post('/server/start', (req, res) => {
    const status = mcService.getStatus().status;
    if (status === 'offline') {
        mcService.startServer();
        res.json({ message: 'Starting server...' });
    } else {
        res.status(400).json({ message: `El servidor ya está ${status}` });
    }
});

app.post('/server/stop', (req, res) => {
    mcService.stopServer();
    res.json({ message: 'Stopping server...' });
});

app.post('/server/restart', (req, res) => {
    mcService.restartServer();
    res.json({ message: 'Restarting server...' });
});

// Configuración de Multer para la subida de archivos
const multer = require('multer');
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        try {
            // El path de destino viene en el body
            const targetPath = req.body.path || '';
            const fullTarget = fileService.resolvePath(targetPath);
            cb(null, fullTarget);
        } catch (error) {
            cb(error, null);
        }
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// Rutas de Archivos
app.get('/files/list', async (req, res) => {
    try {
        const files = await fileService.listFiles(req.query.path);
        res.json(files);
    } catch (e) {
        res.status(403).json({ error: e.message });
    }
});

app.delete('/files/delete', async (req, res) => {
    try {
        await fileService.deleteFile(req.body.path);
        console.log(`[FILES] Deleted: ${req.body.path}`);
        io.emit('files-changed', { action: 'delete', path: req.body.path });
        res.json({ success: true });
    } catch (e) {
        res.status(403).json({ error: e.message });
    }
});

app.post('/files/mkdir', async (req, res) => {
    try {
        await fileService.createDirectory(req.body.path);
        io.emit('files-changed', { action: 'mkdir', path: req.body.path });
        res.json({ success: true });
    } catch (e) {
        res.status(403).json({ error: e.message });
    }
});

app.put('/files/rename', async (req, res) => {
    try {
        await fileService.renameFile(req.body.path, req.body.newName);
        io.emit('files-changed', { action: 'rename', path: req.body.path });
        res.json({ success: true });
    } catch (e) {
        res.status(403).json({ error: e.message });
    }
});
app.get('/files/read', async (req, res) => {
    try {
        const content = await fileService.readFile(req.query.path);
        res.json({ content });
    } catch (e) {
        res.status(403).json({ error: e.message });
    }
});

app.get('/server/config', async (req, res) => {
    const config = await mcService.getStartupConfig();
    res.json(config);
});

app.post('/server/config', async (req, res) => {
    try {
        await mcService.saveStartupConfig(req.body);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/files/upload', upload.array('files'), (req, res) => {
    // Multer maneja la subida en el middleware, aquí solo cerramos la petición
    console.log(`[FILES] Uploaded files to folder`);
    io.emit('files-changed', { action: 'upload' });
    res.json({ success: true });
});

app.get('/files/download', (req, res) => {
    try {
        const fullPath = fileService.resolvePath(req.query.path);
        res.download(fullPath);
    } catch (e) {
        res.status(403).json({ error: e.message });
    }
});

app.post('/files/write', async (req, res) => {
    try {
        await fileService.writeFile(req.body.path, req.body.content);
        io.emit('files-changed', { action: 'write', path: req.body.path });
        res.json({ success: true });
    } catch (e) {
        res.status(403).json({ error: e.message });
    }
});

// Eventos globales del servidor MC (se emiten a todos los clientes conectados)
mcService.on('log', (line) => {
    io.emit('console-out', line);
});

mcService.on('stats', (stats) => {
    io.emit('stats-update', stats);
});

mcService.on('whitelist-changed', () => io.emit('whitelist-changed'));
mcService.on('properties-changed', () => io.emit('properties-changed'));
mcService.on('backups-changed', () => io.emit('backups-changed'));

// Broadcast de progreso de IA cada 1.5 segundos si hay jobs activos
setInterval(async () => {
    if (io.engine.clientsCount > 0) {
        try {
            const activeJobs = await musicService.getActiveJobsProgress();
            if (activeJobs && activeJobs.length > 0) {
                activeJobs.forEach(job => {
                    io.emit('music-progress', { job_id: job.job_id, progress: job.progress });
                });
            }
        } catch (e) {
            // Silenciar errores de polling para no ensuciar la consola
        }
    }
}, 1500);

const connectedUsers = new Map(); // socket.id -> { name, role, sessionId, ip }

io.on('connection', (socket) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    const session = authService.validateToken(token);

    if (!session) {
        console.log(`[AUTH] Conexión rechazada: Token inválido`);
        return socket.disconnect();
    }

    const clientIp = socket.handshake.address || socket.conn.remoteAddress;
    connectedUsers.set(socket.id, { 
        name: session.name, 
        role: session.role, 
        sessionId: session.sessionId,
        ip: clientIp 
    });

    console.log(`[AUTH] User ${session.name} (${session.role}) conectado`);
    
    // Notificar a los hosts de la sesión sobre el nuevo usuario
    broadcastPresence(session.sessionId);

    socket.on('join-console', () => {
        mcService.logs.forEach(log => socket.emit('console-out', log));
    });

    socket.on('console-command', (cmd) => {
        if (session.role === 'host') {
            mcService.sendCommand(cmd);
        } else {
            socket.emit('console-out', '§cError: Solo el Host puede enviar comandos.');
        }
    });

    socket.on('kick-user', (userName) => {
        if (session.role === 'host') {
            for (const [id, u] of connectedUsers.entries()) {
                if (u.name === userName && u.sessionId === session.sessionId && u.role !== 'host') {
                    io.to(id).emit('forced-logout', 'Has sido desconectado por el Host.');
                    const s = io.sockets.sockets.get(id);
                    if (s) s.disconnect();
                }
            }
        }
    });

    socket.on('close-host-session', async () => {
        if (session.role === 'host') {
            // Desconectar a todos los visitantes de esta sesión
            for (const [id, u] of connectedUsers.entries()) {
                if (u.sessionId === session.sessionId && u.role !== 'host') {
                    io.to(id).emit('forced-logout', 'La sesión ha sido cerrada por el Host.');
                    const s = io.sockets.sockets.get(id);
                    if (s) s.disconnect();
                }
            }
            // Eliminar la sesión del authService
            await authService.deleteSession(session.sessionId);
            socket.emit('session-closed');
            socket.disconnect();
        }
    });

    socket.on('disconnect', () => {
        const u = connectedUsers.get(socket.id);
        if (u) {
            connectedUsers.delete(socket.id);
            broadcastPresence(u.sessionId);
        }
        console.log(`[AUTH] User desconectado: ${socket.id}`);
    });
});

function broadcastPresence(sessionId) {
    const usersInSession = Array.from(connectedUsers.values())
        .filter(u => u.sessionId === sessionId);
    
    // Emitir solo a los sockets que pertenecen a esta sesión
    for (const [id, u] of connectedUsers.entries()) {
        if (u.sessionId === sessionId) {
            io.to(id).emit('presence-update', usersInSession);
        }
    }
}

// Endpoints para Whitelist
app.get('/server/whitelist', async (req, res) => {
    try {
        const list = await mcService.getWhitelist();
        res.json(list);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/server/whitelist/add', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    try {
        await mcService.addToWhitelist(name);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/server/whitelist/remove', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    try {
        await mcService.removeFromWhitelist(name);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Endpoints para Properties
app.get('/server/properties', async (req, res) => {
    try {
        const props = await mcService.getProperties();
        res.json(props);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/server/properties', async (req, res) => {
    try {
        await mcService.saveProperties(req.body);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Endpoints para Backups
app.get('/server/backups', async (req, res) => {
    try {
        const list = await mcService.listBackups();
        res.json(list);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/server/backups/create', async (req, res) => {
    try {
        const result = await mcService.createBackup();
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/server/backups/delete', async (req, res) => {
    const { name } = req.body;
    try {
        await mcService.deleteBackup(name);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/server/mods', async (req, res) => {
    try {
        const mods = await mcService.getMods();
        res.json(mods);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Endpoints para Music Studio
app.post('/music/process', async (req, res) => {
    const { source } = req.body;
    try {
        const result = await musicService.startProcessing(source);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/music/status/:jobId', async (req, res) => {
    try {
        const status = await musicService.getJobStatus(req.params.jobId);
        res.json(status);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

server.listen(PORT, '0.0.0.0', async () => {
    await authService.init();
    // Cargar rutas guardadas
    if (authService.settings.mcPath) await mcService.setPath(authService.settings.mcPath);
    if (authService.settings.sharedPath) await fileService.setPath(authService.settings.sharedPath);
    
    console.log(`Backend Absolute corriendo en puerto ${PORT} (Accesible desde ZeroTier)`);
});

// === GUARDIANES GLOBALES: El backend NUNCA debe caerse ===
process.on('unhandledRejection', (reason, promise) => {
    console.error('[GUARDIAN] Promesa no capturada - el backend sigue activo:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('[GUARDIAN] Excepción no capturada - el backend sigue activo:', err.message);
});
