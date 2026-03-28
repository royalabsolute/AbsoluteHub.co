const { spawn, exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const pidusage = require('pidusage');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const EventEmitter = require('events');
const AdmZip = require('adm-zip');

class McServerService extends EventEmitter {
    constructor() {
        super();
        const defaultPath = path.join(__dirname, '..', 'minecraft_server');
        this.mcPath = process.env.MC_SERVER_PATH || (process.platform === 'win32' ? 'E:\\ABSOLUTE FILES\\MINECRAFT SERVER 1.20.1 FABRIC' : defaultPath);
        this.serverProcess = null;
        this.status = 'offline';
        this.logs = [];
        this.onlinePlayers = []; // Lista de jugadores conectados
        this.currentStats = {
            cpu: 0,
            ram: 0,
            uptime: 0,
            ping: 0,
            status: 'offline',
            mods: 0,
            size: '0 MB',
            players: []
        };
        this.statsInterval = null;
        this.startTime = null;
        this.isUpdatingMetrics = false;
        this.isUpdatingSize = false;
        this.cachedChildPid = null;

        this.updateModsAndSize();
    }

    async setPath(newPath) {
        if (!newPath) return;
        this.mcPath = path.resolve(newPath);
        await this.updateModsAndSize();
        console.log(`[MC] Nueva ruta configurada: ${this.mcPath}`);
    }

    async updateModsAndSize() {
        if (this.isUpdatingSize) return;
        this.isUpdatingSize = true;
        try {
            const modsPath = path.join(this.mcPath, 'mods');
            if (await fs.exists(modsPath)) {
                const files = await fs.readdir(modsPath);
                this.currentStats.mods = files.filter(f => f.endsWith('.jar')).length;
            }

            // Obtener el tamaño de forma asíncrona
            if (process.platform === 'win32') {
                const sizeCmd = `powershell -Command "(Get-ChildItem '${this.mcPath}' -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum"`;
                const { stdout } = await execPromise(sizeCmd);
                const totalSize = parseInt(stdout.trim()) || 0;
                this.currentStats.size = (totalSize / 1024 / 1024).toFixed(2) + ' MB';
            } else {
                // Linux/macOS
                try {
                    const { stdout } = await execPromise(`du -sb "${this.mcPath}"`);
                    const totalSize = parseInt(stdout.split('\t')[0]) || 0;
                    this.currentStats.size = (totalSize / 1024 / 1024).toFixed(2) + ' MB';
                } catch (e) {}
            }

            this.emit('stats', this.currentStats);
        } catch (e) {
            console.error("Error updating mods and size:", e);
        } finally {
            this.isUpdatingSize = false;
        }
    }

    async getStartupConfig() {
        const configPath = path.join(__dirname, 'server-config.json');
        try {
            if (await fs.exists(configPath)) {
                return await fs.readJson(configPath);
            }
        } catch (e) {
            console.error("Error reading startup config:", e);
        }
        return { maxRam: '4G', minRam: '2G', jarName: 'fabric-server-launch.jar' };
    }

    async saveStartupConfig(config) {
        const configPath = path.join(__dirname, 'server-config.json');
        await fs.writeJson(configPath, config, { spaces: 4 });
    }

    async startServer() {
        if (this.serverProcess) return;

        const config = await this.getStartupConfig();
        this.status = 'starting';
        this.startTime = Date.now();
        this.updateModsAndSize();

        this.serverProcess = spawn('java', [`-Xmx${config.maxRam}`, `-Xms${config.minRam}`, '-jar', config.jarName, 'nogui'], {
            cwd: this.mcPath
        });

        this.serverProcess.on('error', (err) => {
            const errorMsg = `[ERROR DE SISTEMA] No se pudo iniciar el servidor: ${err.message}\nVerifica que Java esté instalado y sea accesible desde el PATH.\n`;
            this.logs.push(errorMsg);
            this.emit('log', errorMsg);
            this.status = 'offline';
            this.serverProcess = null;
        });

        let stdoutBuffer = '';

        this.serverProcess.stdout.on('data', (data) => {
            stdoutBuffer += data.toString();
            let lines = stdoutBuffer.split('\n');
            stdoutBuffer = lines.pop(); // Keep the incomplete line in the buffer

            for (const line of lines) {
                this.logs.push(line);

                // Detección de entrada de jugadores
            // [12:00:00] [Server thread/INFO]: PlayerName joined the game
            const joinMatch = line.match(/\[.*\]\s+\[Server thread\/INFO\]:\s+(\w+)\s+joined the game/);
            if (joinMatch) {
                const playerName = joinMatch[1];
                if (!this.onlinePlayers.includes(playerName)) {
                    this.onlinePlayers.push(playerName);
                    this.currentStats.players = this.onlinePlayers;
                    this.emit('stats', this.getStatus());
                }
            }

            // Detección de salida de jugadores
            // [12:05:00] [Server thread/INFO]: PlayerName left the game
            const leaveMatch = line.match(/\[.*\]\s+\[Server thread\/INFO\]:\s+(\w+)\s+left the game/);
            if (leaveMatch) {
                const playerName = leaveMatch[1];
                this.onlinePlayers = this.onlinePlayers.filter(p => p !== playerName);
                this.currentStats.players = this.onlinePlayers;
                this.emit('stats', this.getStatus());
            }

                if (line.includes('Done (') && line.includes(')! For help, type "help"')) {
                    this.status = 'online';
                    this.currentStats.status = 'online';
                    this.emit('stats', this.getStatus());
                }

                if (this.logs.length > 500) this.logs.shift();
                this.emit('log', line);
            }
        });

        this.serverProcess.stderr.on('data', (data) => {
            const line = `[STDERR] ${data.toString()}`;
            this.logs.push(line);
            this.emit('log', line);
        });

        this.serverProcess.on('close', (code) => {
            const exitMsg = `[INFO] El servidor se ha cerrado con código: ${code}\n`;
            this.logs.push(exitMsg);
            this.emit('log', exitMsg);
            this.status = 'offline';
            this.serverProcess = null;
            this.startTime = null;
            this.onlinePlayers = []; // Reset de jugadores
            if (this.statsInterval) clearInterval(this.statsInterval);
            this.cachedChildPid = null;
            this.isUpdatingMetrics = false;
            this.currentStats.cpu = 0;
            this.currentStats.ram = 0;
            this.currentStats.players = [];
            this.currentStats.status = 'offline';
            this.emit('stats', this.currentStats);
        });

        // No poner online hasta que termine de cargar
        this.status = 'starting';
        this.currentStats.status = 'starting';
        this.startMetrics();
    }

    startMetrics() {
        if (this.statsInterval) clearInterval(this.statsInterval);
        this.statsInterval = setInterval(async () => {
            if (this.serverProcess && this.serverProcess.pid && !this.isUpdatingMetrics) {
                this.isUpdatingMetrics = true;
                try {
                    let targetPid = this.cachedChildPid || this.serverProcess.pid;

                    // Lógica asíncrona para detectar procesos hijos
                    if (process.platform === 'win32' && !this.cachedChildPid) {
                        try {
                            const psCmd = `powershell -Command "Get-CimInstance Win32_Process -Filter \\"ParentProcessId = ${this.serverProcess.pid}\\" | Select-Object -ExpandProperty ProcessId"`;
                            const { stdout } = await execPromise(psCmd);
                            const childPid = parseInt(stdout.trim());
                            if (!isNaN(childPid)) {
                                this.cachedChildPid = childPid;
                                targetPid = childPid;
                            }
                        } catch (err) { }
                    } else if (process.platform === 'linux' && !this.cachedChildPid) {
                        try {
                            const { stdout } = await execPromise(`pgrep -P ${this.serverProcess.pid}`);
                            const childPid = parseInt(stdout.trim().split('\n')[0]);
                            if (!isNaN(childPid)) {
                                this.cachedChildPid = childPid;
                                targetPid = childPid;
                            }
                        } catch (err) { }
                    }

                    // Verificar si el targetPid sigue vivo
                    try {
                        process.kill(targetPid, 0);
                    } catch (e) {
                        this.cachedChildPid = null;
                        targetPid = this.serverProcess.pid;
                    }

                    const stats = await pidusage(targetPid);
                    let ramMB = Math.round(stats.memory / 1024 / 1024);
                    let cpuUsage = Math.round(stats.cpu);

                    // Refuerzo asíncrono con PowerShell si falla pidusage
                    if (process.platform === 'win32' && (ramMB < 50 || cpuUsage === 0)) {
                        try {
                            const psStatsCmd = `powershell -Command "(Get-Process -Id ${targetPid} | Select-Object WorkingSet, @{Name='CPU';Expression={$_.CPU}} | ConvertTo-Json)"`;
                            const { stdout: psOut } = await execPromise(psStatsCmd);
                            if (psOut) {
                                const data = JSON.parse(psOut);
                                if (data.WorkingSet) ramMB = Math.round(data.WorkingSet / 1024 / 1024);
                            }
                        } catch (err) { }
                    }

                    this.currentStats.cpu = cpuUsage;
                    this.currentStats.ram = ramMB;
                    this.currentStats.uptime = Math.round((Date.now() - this.startTime) / 1000);
                    
                    // Solo actualizar tamaño cada 10 ciclos de métricas (aprox cada 100s) para no saturar
                    this.metricCycles = (this.metricCycles || 0) + 1;
                    if (this.metricCycles % 10 === 0) {
                        this.updateModsAndSize();
                    }

                    this.emit('stats', this.currentStats);
                } catch (e) { 
                    this.cachedChildPid = null; // Reset cache on error
                } finally {
                    this.isUpdatingMetrics = false;
                }
            }
        }, 2000); // Intervalo de 2s para mayor fluidez en tiempo real
    }

    stopServer() {
        if (this.serverProcess) {
            this.serverProcess.stdin.write('stop\n');
        }
    }

    restartServer() {
        this.stopServer();
        setTimeout(() => this.startServer(), 5000);
    }

    sendCommand(command) {
        if (this.serverProcess) {
            this.serverProcess.stdin.write(`${command}\n`);
        }
    }

    async getWhitelist() {
        const whitelistPath = path.join(this.mcPath, 'whitelist.json');
        try {
            if (await fs.exists(whitelistPath)) {
                return await fs.readJson(whitelistPath);
            }
        } catch (e) {
            console.error("Error reading whitelist:", e);
        }
        return [];
    }

    async addToWhitelist(name) {
        this.sendCommand(`whitelist add ${name}`);
        this.emit('whitelist-changed');
        // Esperamos un poco para que el servidor actualice el archivo
        setTimeout(() => this.emit('stats', this.getStatus()), 1000);
        return { success: true };
    }

    async removeFromWhitelist(name) {
        this.sendCommand(`whitelist remove ${name}`);
        this.emit('whitelist-changed');
        // Esperamos un poco para que el servidor actualice el archivo
        setTimeout(() => this.emit('stats', this.getStatus()), 1000);
        return { success: true };
    }

    async getProperties() {
        const propsPath = path.join(this.mcPath, 'server.properties');
        try {
            if (await fs.exists(propsPath)) {
                const content = await fs.readFile(propsPath, 'utf8');
                const props = {};
                content.split('\n').forEach(line => {
                    if (line && !line.startsWith('#')) {
                        const [key, ...valueParts] = line.split('=');
                        if (key) props[key.trim()] = valueParts.join('=').trim();
                    }
                });
                return props;
            }
        } catch (e) {
            console.error("Error reading properties:", e);
        }
        return {};
    }

    async saveProperties(props) {
        const propsPath = path.join(this.mcPath, 'server.properties');
        try {
            let content = '# Minecraft server properties\n# Modified by Absolute Dashboard\n';
            for (const [key, value] of Object.entries(props)) {
                content += `${key}=${value}\n`;
            }
            await fs.writeFile(propsPath, content);
            this.emit('properties-changed');
            return { success: true };
        } catch (e) {
            console.error("Error saving properties:", e);
            throw e;
        }
    }

    async createBackup() {
        const backupsDir = path.join(this.mcPath, 'backups_absolute');
        const worldDir = path.join(this.mcPath, 'world');

        try {
            await fs.ensureDir(backupsDir);
            if (!(await fs.pathExists(worldDir))) throw new Error("No se encontró la carpeta 'world'");

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const zipName = `backup-${timestamp}.zip`;
            const zipPath = path.join(backupsDir, zipName);

            const zip = new AdmZip();
            zip.addLocalFolder(worldDir, 'world');
            await zip.writeZipPromise(zipPath);

            this.emit('backups-changed');
            return { success: true, name: zipName };
        } catch (e) {
            console.error("Error creating backup:", e);
            throw e;
        }
    }

    async listBackups() {
        const backupsDir = path.join(this.mcPath, 'backups_absolute');
        try {
            await fs.ensureDir(backupsDir);
            const files = await fs.readdir(backupsDir);
            const list = [];
            for (const file of files) {
                if (file.endsWith('.zip')) {
                    const stats = await fs.stat(path.join(backupsDir, file));
                    list.push({
                        name: file,
                        size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
                        date: stats.mtime
                    });
                }
            }
            return list.sort((a, b) => b.date - a.date);
        } catch (e) {
            console.error("Error listing backups:", e);
            return [];
        }
    }

    async deleteBackup(name) {
        const filePath = path.join(this.mcPath, 'backups_absolute', name);
        try {
            if (await fs.pathExists(filePath)) {
                await fs.remove(filePath);
                this.emit('backups-changed');
                return { success: true };
            }
        } catch (e) {
            console.error("Error deleting backup:", e);
            throw e;
        }
    }

    async getMods() {
        const modsDir = path.join(this.mcPath, 'mods');
        try {
            if (await fs.pathExists(modsDir)) {
                const files = await fs.readdir(modsDir);
                return files.filter(f => f.endsWith('.jar')).map(f => ({ name: f }));
            }
        } catch (e) {
            console.error("Error reading mods:", e);
        }
        return [];
    }

    getStatus() {
        return {
            status: this.status,
            ...this.currentStats
        };
    }

    getNetworkInfo() {
        const interfaces = os.networkInterfaces();
        let ztIp = 'Unknown';

        // Buscar interfaz de ZeroTier (usualmente empieza por 'Ethernet' o tiene un nombre específico en Windows)
        // O buscar la IP que empiece por 10.93 (según el dashboard previo)
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    if (iface.address.startsWith('10.93.')) {
                        ztIp = iface.address;
                        break;
                    }
                }
            }
        }

        return {
            zeroTierIp: ztIp,
            zeroTierId: process.env.ZT_NETWORK_ID || '166359304ea8c674',
            minecraftIp: ztIp
        };
    }
}

module.exports = new McServerService();
