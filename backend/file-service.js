const fs = require('fs-extra');
const path = require('path');

class FileService {
    constructor() {
        const defaultPath = path.join(__dirname, '..', 'files');
        this.basePath = process.env.SHARED_FILES_PATH || (process.platform === 'win32' ? 'E:\\ABSOLUTE FILES' : defaultPath);
        this.ensureDir();
    }

    async setPath(newPath) {
        if (!newPath) return;
        this.basePath = path.resolve(newPath);
        await this.ensureDir();
        console.log(`[FILES] Nueva ruta configurada: ${this.basePath}`);
    }

    async ensureDir() {
        try {
            await fs.ensureDir(this.basePath);
        } catch (e) {
            console.error("Error creating base path:", e);
        }
    }

    // Seguridad: Prevenir Directory Traversal y Normalize en Windows
    resolvePath(reqPath = '') {
        // Si el cliente pide la raíz literal (vacío o '/')
        if (!reqPath || reqPath === '/' || reqPath === '\\') {
            return this.basePath;
        }

        // Aseguramos que reqPath sea siempre un string sin travesías '..'
        const safeReq = (reqPath || '').toString().replace(/^(\.\.[\/\\])+/, '');
        const fullPath = path.resolve(this.basePath, safeReq);

        // Convertir ambas rutas a un formato unificado (lowercase y con el mismo tipo de barra)
        // Esto es vital en Windows donde E:\A != E:\a
        const baseNorm = path.normalize(this.basePath).toLowerCase().replace(/\\/g, '/');
        const fullNorm = path.normalize(fullPath).toLowerCase().replace(/\\/g, '/');

        if (!fullNorm.startsWith(baseNorm)) {
            console.warn(`[SECURITY] Intento de acceso denegado: Base[${baseNorm}] vs Full[${fullNorm}]`);
            throw new Error("Acceso denegado: Fuera de los límites permitidos.");
        }
        return fullPath;
    }

    async listFiles(dirPath = '') {
        const fullPath = this.resolvePath(dirPath);
        const items = await fs.readdir(fullPath, { withFileTypes: true });

        const result = [];
        for (const item of items) {
            const itemPath = path.join(fullPath, item.name);
            let size = null;
            try {
                if (item.isFile()) {
                    const stats = await fs.stat(itemPath);
                    size = stats.size;
                }
            } catch (e) {
                console.error(`Error getting size for ${item.name}:`, e);
            }

            result.push({
                name: item.name,
                isDirectory: item.isDirectory(),
                path: path.join(dirPath, item.name).replace(/\\/g, '/'),
                size: size
            });
        }
        return result;
    }

    async deleteFile(filePath) {
        const fullPath = this.resolvePath(filePath);
        await fs.remove(fullPath);
    }

    async createDirectory(dirPath) {
        const fullPath = this.resolvePath(dirPath);
        await fs.ensureDir(fullPath);
    }

    async renameFile(oldPath, newName) {
        const fullOldPath = this.resolvePath(oldPath);
        // Validar que el archivo viejo exista
        if (!(await fs.pathExists(fullOldPath))) {
            throw new Error(`El archivo o directorio original no existe: ${oldPath}`);
        }

        // El nuevo nombre es relativo a la misma ruta base
        const dirName = path.dirname(fullOldPath);
        // Validamos que el nombre nuevo no intente salir de la carpeta (ej. ../../etc)
        const safeNewName = path.basename(newName);
        const fullNewPath = path.join(dirName, safeNewName);

        // Prevenir reescritura de un archivo existente (opcional, pero buena práctica)
        if (await fs.pathExists(fullNewPath)) {
            throw new Error(`El destino ya existe: ${safeNewName}`);
        }

        await fs.rename(fullOldPath, fullNewPath);
    }

    async readFile(filePath) {
        const fullPath = this.resolvePath(filePath);
        // Verificar si es un archivo de texto/configuración permitido
        const ext = path.extname(fullPath).toLowerCase();
        const allowedExts = ['.properties', '.json', '.txt', '.yml', '.yaml', '.log', '.js', '.ts', '.css', '.scss', '.html', '.md'];
        const fileName = path.basename(fullPath);

        if (!allowedExts.includes(ext) && !fileName.startsWith('.')) {
            // Documento: Aquí podrías lanzar error o simplemente dejar pasar si confías en resolvePath
        }

        return await fs.readFile(fullPath, 'utf8');
    }

    async writeFile(filePath, content) {
        const fullPath = this.resolvePath(filePath);
        await fs.writeFile(fullPath, content, 'utf8');
    }
}

module.exports = new FileService();
