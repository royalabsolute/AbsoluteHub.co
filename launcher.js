const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn, execSync } = require('child_process');

async function isPortFree(port) {
    return new Promise((resolve) => {
        const server = net.createServer()
            .once('error', () => resolve(false))
            .once('listening', () => {
                server.close();
                resolve(true);
            })
            .listen(port);
    });
}

async function getFreePort(startPort) {
    let port = startPort;
    while (!(await isPortFree(port))) {
        port++;
    }
    return port;
}

async function checkDependencies() {
    console.log('> Verificando dependencias...');
    try {
        execSync('java -version', { stdio: 'ignore' });
        console.log('✓ Java detectado.');
    } catch (e) {
        console.error('❌ Java no detectado. Por favor instálalo.');
        process.exit(1);
    }
}

async function start() {
    const rootDir = __dirname;
    const backendDir = path.join(rootDir, 'backend');
    const frontendDir = path.join(rootDir, 'ABSOLUTE PLANTILLA');

    console.log('--- Absolute Dashboard Launcher v2.1 ---');
    await checkDependencies();

    // 1. Buscar puertos
    const backendPort = await getFreePort(3000);
    const frontendPort = await getFreePort(4200);

    console.log(`> Backend: http://localhost:${backendPort}`);
    console.log(`> Frontend: http://localhost:${frontendPort}`);

    // 2. Actualizar backend/.env (Ruta absoluta)
    const envPath = path.join(backendDir, '.env');
    if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        envContent = envContent.replace(/PORT=\d+/, `PORT=${backendPort}`);
        fs.writeFileSync(envPath, envContent);
        console.log('✓ .env actualizado.');
    }

    // 3. Actualizar mc-server.service.ts (Regex flexible para comentarios)
    const servicePath = path.join(frontendDir, 'src', 'app', 'theme', 'shared', 'service', 'mc-server.service.ts');
    if (fs.existsSync(servicePath)) {
        let serviceContent = fs.readFileSync(servicePath, 'utf8');
        // Busca 'apiUrl = 'http://localhost:XXXX'' y reemplaza solo la parte de la URL
        serviceContent = serviceContent.replace(/private apiUrl = 'http:\/\/localhost:\d+'/g, `private apiUrl = 'http://localhost:${backendPort}'`);
        fs.writeFileSync(servicePath, serviceContent);
        console.log('✓ Angular Service actualizado.');
    }

    // 4. Verificar dependencias
    if (!fs.existsSync(path.join(backendDir, 'node_modules'))) {
        console.log('> Instalando dependencias del Backend...');
        execSync('npm install', { cwd: backendDir, stdio: 'inherit' });
    }

    console.log('\n--- Lanzamiento de Ecosistema Absolute ---');

    const isWin = process.platform === 'win32';

    // A. Iniciar Backend (Node.js)
    console.log('> [1/4] Iniciando Servidor Core Hub...');
    if (isWin) {
        spawn('cmd.exe', ['/c', 'start', "Absolute CORE", 'npm', 'start'], {
            cwd: backendDir,
            stdio: 'ignore'
        });
    } else {
        spawn('npm', ['start'], {
            cwd: backendDir,
            stdio: 'ignore',
            detached: true
        }).unref();
    }

    // B. Iniciar AI Worker (Python)
    const musicDir = path.join(backendDir, 'music');
    const pythonExe = isWin ? path.join(musicDir, 'python_stable', 'python.exe') : 'python3';
    console.log('> [2/4] Despertando Cerebro de IA Musical...');
    if (isWin) {
        spawn('cmd.exe', ['/c', 'start', "Absolute AI", pythonExe, "ai_worker.py"], {
            cwd: musicDir,
            stdio: 'ignore'
        });
    } else {
        spawn(pythonExe, ['ai_worker.py'], {
            cwd: musicDir,
            stdio: 'ignore',
            detached: true
        }).unref();
    }

    // D. Iniciar Frontend (Angular)
    console.log('> [3/4] Cargando Interfaz Dashboard Pro...');
    if (isWin) {
        spawn('cmd.exe', ['/c', 'start', "Absolute DASHBOARD", 'npm', 'start', '--', '--port', frontendPort.toString()], {
            cwd: frontendDir,
            stdio: 'ignore'
        });
    } else {
        spawn('npm', ['start', '--', '--port', frontendPort.toString()], {
            cwd: frontendDir,
            stdio: 'ignore',
            detached: true
        }).unref();
    }

    updateAngularServices(frontendDir, backendPort);

    console.log('\n=============================================');
    console.log('✓ SISTEMA ABSOLUTE INICIADO CON ÉXITO');
    console.log(`✓ Local: http://localhost:${frontendPort}`);
    console.log('=============================================');
}

function updateAngularServices(frontendDir, backendPort) {
    const services = [
        path.join(frontendDir, 'src', 'app', 'theme', 'shared', 'service', 'mc-server.service.ts'),
        path.join(frontendDir, 'src', 'app', 'theme', 'shared', 'service', 'music-studio.service.ts')
    ];

    services.forEach(servicePath => {
        if (fs.existsSync(servicePath)) {
            let content = fs.readFileSync(servicePath, 'utf8');
            // También asegura que el puerto local sea el correcto si cambió
            content = content.replace(/:(\d+)([`'])\s+\/\/\s*LOCAL_PORT_MARKER/g, `:${backendPort}$2 // LOCAL_PORT_MARKER`);
            fs.writeFileSync(servicePath, content);
            console.log(`✓ Sincronizado: ${path.basename(servicePath)}`);
        }
    });
}

start().catch(err => {
    console.error('Error fatal en el launcher:', err);
    process.exit(1);
});
