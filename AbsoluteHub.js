const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');
const os = require('os');

// Configuración de Colores (ANSI)
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    backend: '\x1b[34m',   // Azul
    ai: '\x1b[32m',        // Verde
    tunnels: '\x1b[36m',   // Cian
    frontend: '\x1b[35m',  // Magenta
    hub: '\x1b[33m',       // Amarillo
    error: '\x1b[31m',     // Rojo
    success: '\x1b[32m'    // Verde brillante
};

const processes = [];
const rootDir = __dirname;
const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'ABSOLUTE PLANTILLA');

// Estado de red para el resumen final
const networkState = {
    backendUrl: 'Detectando...',
    frontendUrl: 'Detectando...',
    bePort: null,
    fePort: null,
    reported: false
};

// Buffers para evitar problemas de líneas cortadas en los streams
const processBuffers = {
    BACKEND: '',
    AI: '',
    TUNNEL_BE: '',
    TUNNEL_FE: '',
    FRONTEND: ''
};

async function getFreePort(start) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(start, '0.0.0.0', () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
        server.on('error', () => {
            resolve(getFreePort(start + 1));
        });
    });
}

function log(source, message, color = colors.reset) {
    if (!message || !message.trim()) return;
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `${colors.bright}[${timestamp}] [${source}]${colors.reset}`;
    process.stdout.write(`${prefix} ${color}${message.trim()}${colors.reset}\n`);
}

function getZeroTierIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                if (iface.address.startsWith('10.93.')) {
                    return iface.address;
                }
            }
        }
    }
    return null;
}

function printSummary() {
    const ztIp = getZeroTierIp() || 'No detectada';
    
    // Timeout breve para dejar pasar los últimos logs
    setTimeout(() => {
        console.log('\n\n');
        log('HUB', '╔══════════════════════════════════════════════════════════════════════╗', colors.hub);
        log('HUB', '║   🚀 SISTEMA ABSOLUTE CARGADO Y LISTO (ZERO EDITION)                 ║', colors.hub);
        log('HUB', '╠══════════════════════════════════════════════════════════════════════╣', colors.hub);
        log('HUB', `║ 🌍 DASHBOARD LOCAL:  ${colors.bright}http://localhost:${networkState.fePort}${colors.reset}${colors.hub}                ║`, colors.hub);
        log('HUB', `║ 🟢 IP ZEROTIER:      ${colors.bright}http://${ztIp}:${networkState.fePort}${colors.reset}${colors.hub}        ║`, colors.hub);
        log('HUB', '╠══════════════════════════════════════════════════════════════════════╣', colors.hub);
        log('HUB', `║ 🎮 MINECRAFT IP:     ${colors.bright}${ztIp}:25565${colors.reset}${colors.hub}               ║`, colors.hub);
        log('HUB', '╚══════════════════════════════════════════════════════════════════════╝', colors.hub);
        console.log('\n');
    }, 1500);
}

function updateAngularServices(backendPort) {
    // Usamos el hostname actual si es posible, de lo contrario intentamos detectar la IP de ZeroTier
    const ztIp = getZeroTierIp() || 'localhost';
    const baseUrl = `http://${ztIp}`;

    const services = [
        path.join(frontendDir, 'src/app/theme/shared/service/mc-server.service.ts'),
        path.join(frontendDir, 'src/app/theme/shared/service/music-studio.service.ts'),
        path.join(frontendDir, 'src/app/theme/shared/service/auth.service.ts')
    ];

    services.forEach(file => {
        if (fs.existsSync(file)) {
            try {
                let content = fs.readFileSync(file, 'utf8');
                // Simplificamos: solo nos importa que el puerto local esté sincronizado
                // El frontend ya es inteligente para detectar su propio hostname
                const portRegex = /:(\d+)[`']\s+\/\/\s*LOCAL_PORT_MARKER/;

                if (content.includes('LOCAL_PORT_MARKER')) {
                    content = content.replace(/:\d+([`'])\s+\/\/\s*LOCAL_PORT_MARKER/, `:${backendPort}$1 // LOCAL_PORT_MARKER`);
                }

                fs.writeFileSync(file, content);
                log('HUB', `Sincronizado: ${path.basename(file)}`, colors.hub);
            } catch (err) {
                log('HUB', `Error al sincronizar ${path.basename(file)}: ${err.message}`, colors.error);
            }
        }
    });
}

function startProcess(name, command, args, cwd, color) {
    const isWin = os.platform() === 'win32';
    // On Linux, we might want to ensure the command is in the path
    const proc = spawn(command, args, { cwd, shell: isWin });

    const processOutput = (data) => {
        processBuffers[name] += data.toString();
        let lines = processBuffers[name].split(/\r?\n/);
        processBuffers[name] = lines.pop();

        lines.forEach(line => {
            if (!line) return;
            log(name, line, color);
        });
    };

    proc.stdout.on('data', processOutput);
    proc.stderr.on('data', processOutput);

    proc.on('error', (err) => {
        log(name, `Error crítico: ${err.message}`, colors.error);
    });

    processes.push(proc);
}

async function init() {
    console.clear();
    log('HUB', '================================================', colors.hub);
    log('HUB', '   ABSOLUTE TERMINAL HUB v3.6 - ZERO EDITION    ', colors.hub);
    log('HUB', '================================================', colors.hub);

    log('HUB', 'Verificando dependencias...', colors.hub);
    try {
        execSync('java -version', { stdio: 'ignore' });
        log('HUB', 'Java detectado.', colors.success);
    } catch (e) {
        log('HUB', 'Java NO detectado. Es necesario para el servidor de Minecraft.', colors.error);
    }

    log('HUB', 'Limpiando sesiones previas...', colors.hub);
    try {
        if (os.platform() === 'win32') {
            execSync('taskkill /F /IM cloudflared.exe /IM python.exe /T', { stdio: 'ignore' });
            const currentPid = process.pid;
            const tasklist = execSync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH').toString();
            tasklist.split('\n').forEach(row => {
                const parts = row.split('","');
                if (parts.length > 1) {
                    const pid = parts[1].replace(/"/g, '');
                    if (parseInt(pid) !== currentPid) {
                        try { execSync(`taskkill /F /PID ${pid} /T`); } catch (e) { }
                    }
                }
            });
        } else {
            // Linux/macOS cleaning
            try { execSync('pkill -f cloudflared', { stdio: 'ignore' }); } catch (e) {}
            try { execSync('pkill -f python3', { stdio: 'ignore' }); } catch (e) {}
            
            // Safer way to kill other node processes without killing ourselves
            try {
                const currentPid = process.pid;
                // Get all node PIDs, filter out the current or parent of current
                const res = execSync('pgrep node').toString().trim();
                if (res) {
                    res.split('\n').forEach(pid => {
                        const p = parseInt(pid.trim());
                        if (p && p !== currentPid) {
                            try { execSync(`kill -9 ${p}`); } catch (e) {}
                        }
                    });
                }
            } catch (e) {}
        }
    } catch (e) { }

    networkState.bePort = await getFreePort(3000);
    networkState.fePort = await getFreePort(4200);

    log('HUB', `Puertos: Backend=${networkState.bePort}, Frontend=${networkState.fePort}`, colors.hub);

    const envPath = path.join(backendDir, '.env');
    if (fs.existsSync(envPath)) {
        try {
            let env = fs.readFileSync(envPath, 'utf8');
            env = env.replace(/PORT=\d+/, `PORT=${networkState.bePort}`);
            fs.writeFileSync(envPath, env);
            log('HUB', '.env sincronizado.', colors.hub);
        } catch (e) { }
    }

    startProcess('BACKEND', 'node', ['index.js'], backendDir, colors.backend);

    const isWin = os.platform() === 'win32';
    const py = isWin 
        ? path.join(backendDir, 'music/python_stable/python.exe')
        : (fs.existsSync(path.join(backendDir, 'music/venv/bin/python')) 
            ? path.join(backendDir, 'music/venv/bin/python') 
            : 'python3');
    
    if (isWin) {
        if (fs.existsSync(py)) {
            startProcess('AI', py, ['ai_worker.py'], path.join(backendDir, 'music'), colors.ai);
        }
    } else {
        startProcess('AI', py, ['ai_worker.py'], path.join(backendDir, 'music'), colors.ai);
    }

    startProcess('FRONTEND', 'npm', ['start', '--', '--port', networkState.fePort.toString()], frontendDir, colors.frontend);

    log('HUB', 'Sincronizando servicios Angular...', colors.hub);
    updateAngularServices(networkState.bePort);

    log('HUB', 'Sistema en marcha. Mostrando resumen final...', colors.hub);

    const ztIp = getZeroTierIp() || 'No detectada';
    networkState.backendUrl = `http://${ztIp}:${networkState.bePort}`;
    networkState.frontendUrl = `http://${ztIp}:${networkState.fePort}`;
    printSummary();
}

process.on('SIGINT', () => {
    log('HUB', 'Cerrando Absolute...', colors.error);
    processes.forEach(p => { try { p.kill(); } catch (e) { } });
    setTimeout(() => process.exit(), 1000);
});

init().catch(err => log('HUB', `ERROR: ${err.message}`, colors.error));
