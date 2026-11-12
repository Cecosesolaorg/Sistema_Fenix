const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 8000;   // HTTP  (fallback)
const DIRECTORY = path.join(__dirname, 'registros');
const REPORTES_DIR = path.join(__dirname, 'inventarios base de datos');
const AVATARS_DIR = path.join(DIRECTORY, 'avatars');

// Crear la carpeta si no existe
if (!fs.existsSync(DIRECTORY)) fs.mkdirSync(DIRECTORY, { recursive: true });
if (!fs.existsSync(REPORTES_DIR)) fs.mkdirSync(REPORTES_DIR, { recursive: true });
if (!fs.existsSync(AVATARS_DIR)) fs.mkdirSync(AVATARS_DIR, { recursive: true });

const SESSION_CONTROL_FILE = path.join(DIRECTORY, 'session_control.json');
let sessionControl = { global_logout: 0, kicked_users: {} };
if (fs.existsSync(SESSION_CONTROL_FILE)) {
    try { sessionControl = JSON.parse(fs.readFileSync(SESSION_CONTROL_FILE, 'utf8')); } catch (e) { }
}
function saveSessionControl() {
    fs.writeFileSync(SESSION_CONTROL_FILE, JSON.stringify(sessionControl, null, 4), 'utf8');
}

const getFolderName = (aisleName) => {
    const now = new Date();
    const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

    const dayName = days[now.getDay()].toUpperCase();
    const dayNum = now.getDate();
    const monthName = months[now.getMonth()].toUpperCase();

    const safeAisle = aisleName.replace(/[^a-zA-Z0-9\s-]/g, '').trim().toUpperCase();

    // Carpeta principal: "SABADO 18 DE JULIO"
    const globalFolder = `${dayName} ${dayNum} DE ${monthName}`;

    // Carpeta anidada: "PASILLO PASTA"
    const subFolder = safeAisle;

    return path.join(globalFolder, subFolder);
};

const getContentType = (filePath) => {
    const extname = path.extname(filePath);
    switch (extname) {
        case '.html': return 'text/html';
        case '.js': return 'text/javascript';
        case '.css': return 'text/css';
        case '.json': return 'application/json';
        case '.png': return 'image/png';
        case '.jpg': return 'image/jpg';
        default: return 'text/plain';
    }
};



const requestHandler = (req, res) => {
    if (req.method === 'GET' && req.url === '/api/users') {
        let users = [];
        if (fs.existsSync(DIRECTORY)) {
            const files = fs.readdirSync(DIRECTORY);
            for (const file of files) {
                if (file.endsWith('.json') && file !== 'historial.json' && file !== 'cierres.json') {
                    try {
                        const data = JSON.parse(fs.readFileSync(path.join(DIRECTORY, file), 'utf8'));
                        if (data.password) {
                            users.push(data);
                        }
                    } catch (e) { }
                }
            }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(users));

    } else if (req.method === 'GET' && req.url === '/api/listar-reportes') {
        let reportes = [];
        if (fs.existsSync(REPORTES_DIR)) {
            const readFilesRecursively = (dir) => {
                let results = [];
                const list = fs.readdirSync(dir);
                list.forEach(file => {
                    const filePath = path.join(dir, file);
                    const stat = fs.statSync(filePath);
                    if (stat && stat.isDirectory()) {
                        results = results.concat(readFilesRecursively(filePath));
                    } else {
                        results.push(filePath);
                    }
                });
                return results;
            };

            const files = readFilesRecursively(REPORTES_DIR);
            // sort by modification time, newest first
            files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

            for (const filePath of files) {
                const file = path.basename(filePath);
                const relativePath = path.relative(REPORTES_DIR, filePath).replace(/\\/g, '/');
                // El nombre de la carpeta padre (ej: "PASILLO 1 inventario miércoles 27 de mayo")
                const folderName = path.basename(path.dirname(filePath));

                if (file.endsWith('.json')) {
                    try {
                        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                        data.filename = relativePath;
                        data.type = 'json';
                        data.folderName = folderName;
                        reportes.push(data);
                    } catch (e) { }
                } else if (file.endsWith('.xlsx')) {
                    // El folderName en base de datos es ahora el Pasillo (ej: PASILLO PASTA)
                    // El filename contiene el nombre de los responsables
                    const nameSinExt = file.replace('.xlsx', '');
                    const aisleName = folderName;
                    const responsable = nameSinExt;

                    let fecha_iso;
                    try {
                        const stat = fs.statSync(filePath);
                        fecha_iso = stat.mtime.toISOString();
                    } catch (e) {
                        fecha_iso = new Date().toISOString();
                    }

                    reportes.push({
                        filename: relativePath,
                        type: 'xlsx',
                        aisleName: aisleName,
                        responsable: responsable,
                        fecha_iso: fecha_iso,
                        folderName: folderName
                    });
                }
            }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(reportes));

    } else if (req.method === 'GET' && req.url.startsWith('/api/descargar-reporte/')) {
        const relativeFileName = decodeURIComponent(req.url.split('/api/descargar-reporte/')[1]);
        const filePath = path.resolve(REPORTES_DIR, relativeFileName);

        if (filePath.startsWith(REPORTES_DIR) && fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath);
            const safeName = path.basename(filePath);
            const asciiName = safeName.replace(/[^\x20-\x7E]/g, '');
            const encodedName = encodeURIComponent(safeName);
            res.writeHead(200, {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
                'Content-Length': stat.size
            });
            fs.createReadStream(filePath).pipe(res);
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: 'Archivo no encontrado' }));
        }

    } else if (req.method === 'POST' && req.url === '/api/register') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const cedula = data.cedula || 'unknown';
                const nombre = data.nombre || 'Usuario';

                // Asignar rol por defecto
                data.role = data.role || 'user';

                let safe_cedula = cedula.replace(/[^a-zA-Z0-9]/g, '');
                let safe_nombre = nombre.replace(/[^a-zA-Z0-9]/g, '_');
                if (!safe_cedula) safe_cedula = 'unknown';
                if (!safe_nombre) safe_nombre = 'Usuario';

                let existingFilename = null;
                if (fs.existsSync(DIRECTORY)) {
                    const files = fs.readdirSync(DIRECTORY);
                    for (const file of files) {
                        if (file.endsWith('.json') && file.includes(`_${safe_cedula}_`)) {
                            existingFilename = file;
                            break;
                        }
                    }
                }

                let filepath;
                if (existingFilename) {
                    filepath = path.join(DIRECTORY, existingFilename);
                    try {
                        // Preservar datos originales importantes si es una actualización (ej: durante login)
                        const oldData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
                        data.role = oldData.role || data.role;
                        data.fecha = oldData.fecha || data.fecha;
                    } catch (e) { }
                } else {
                    const now = new Date();
                    const timestamp = now.getFullYear().toString() +
                        String(now.getMonth() + 1).padStart(2, '0') +
                        String(now.getDate()).padStart(2, '0') + '_' +
                        String(now.getHours()).padStart(2, '0') +
                        String(now.getMinutes()).padStart(2, '0') +
                        String(now.getSeconds()).padStart(2, '0');

                    const filename = `${safe_nombre}_${safe_cedula}_${timestamp}.json`;
                    filepath = path.join(DIRECTORY, filename);
                }

                fs.writeFileSync(filepath, JSON.stringify(data, null, 4), 'utf8');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'success', message: 'Registrado correctamente' }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: e.message }));
            }
        });

    } else if (req.method === 'POST' && req.url === '/api/actualizar-rol') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { cedula, newRole } = data;
                if (!cedula || !newRole) throw new Error('Faltan datos');

                let updated = false;
                if (fs.existsSync(DIRECTORY)) {
                    const files = fs.readdirSync(DIRECTORY);
                    for (const file of files) {
                        // El archivo se llama: nombre_cedula_timestamp.json
                        if (file.endsWith('.json') && file.includes(`_${cedula}_`)) {
                            const filepath = path.join(DIRECTORY, file);
                            const userData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
                            userData.role = newRole;
                            fs.writeFileSync(filepath, JSON.stringify(userData, null, 4), 'utf8');
                            updated = true;
                            // Si hubieran varios (histórico de registros), podríamos actualizar todos o solo romper aquí.
                            // Rompemos en el primero que encontremos (el más reciente o único).
                            break;
                        }
                    }
                }

                if (updated) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'success', message: 'Rol actualizado correctamente' }));
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'error', message: 'Usuario no encontrado' }));
                }
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: e.message }));
            }
        });

    } else if (req.method === 'POST' && req.url === '/api/historial') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (!data.usuario || !data.accion) throw new Error('Faltan datos');

                const historialPath = path.join(DIRECTORY, 'historial.json');
                let historial = [];
                if (fs.existsSync(historialPath)) {
                    historial = JSON.parse(fs.readFileSync(historialPath, 'utf8'));
                }

                const evento = {
                    usuario: data.usuario,
                    accion: data.accion,
                    fecha: new Date().toISOString()
                };

                // Agregamos al inicio para que el más reciente esté primero
                historial.unshift(evento);

                fs.writeFileSync(historialPath, JSON.stringify(historial, null, 4), 'utf8');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'success' }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: e.message }));
            }
        });

    } else if (req.method === 'GET' && req.url === '/api/server-ip') {
        try {
            const nets = os.networkInterfaces();
            let localIp = '127.0.0.1';
            for (const name of Object.keys(nets)) {
                for (const net of nets[name]) {
                    // Buscar IPv4 no-loopback que no sea el hotspot (137.x)
                    if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('192.168.137')) {
                        localIp = net.address;
                        break;
                    }
                }
                if (localIp !== '127.0.0.1') break;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ip: localIp, port: PORT }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: e.message }));
        }

    } else if (req.method === 'GET' && req.url === '/api/qrcodes') {
        try {
            const qrPath = path.join(DIRECTORY, 'qrcodes.json');
            let qrcodes = {};
            if (fs.existsSync(qrPath)) {
                qrcodes = JSON.parse(fs.readFileSync(qrPath, 'utf8'));
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(qrcodes));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: e.message }));
        }

    } else if (req.method === 'POST' && req.url === '/api/qrcodes') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body); // expected { barcode: '123', name: 'Product Name' }
                if (!data.barcode || !data.name) throw new Error('Faltan datos');

                const qrPath = path.join(DIRECTORY, 'qrcodes.json');
                let qrcodes = {};
                if (fs.existsSync(qrPath)) {
                    qrcodes = JSON.parse(fs.readFileSync(qrPath, 'utf8'));
                }

                qrcodes[data.barcode] = data.name;

                fs.writeFileSync(qrPath, JSON.stringify(qrcodes, null, 4), 'utf8');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'success' }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: e.message }));
            }
        });

    } else if (req.method === 'GET' && req.url === '/api/avatars') {
        try {
            let avatars = {};
            if (fs.existsSync(AVATARS_DIR)) {
                const files = fs.readdirSync(AVATARS_DIR);
                for (const file of files) {
                    if (file.endsWith('.txt')) {
                        const cedula = file.replace('.txt', '');
                        const base64 = fs.readFileSync(path.join(AVATARS_DIR, file), 'utf8');
                        avatars[cedula] = base64;
                    }
                }
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(avatars));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: e.message }));
        }

    } else if (req.method === 'POST' && req.url === '/api/upload-avatar') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
            // Evitar payloads gigantes (limite ~2MB)
            if (body.length > 2 * 1024 * 1024) req.connection.destroy();
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (!data.cedula || !data.fotoBase64) throw new Error('Faltan datos');

                const filepath = path.join(AVATARS_DIR, `${data.cedula}.txt`);
                fs.writeFileSync(filepath, data.fotoBase64, 'utf8');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'success' }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: e.message }));
            }
        });

    } else if (req.method === 'GET' && req.url === '/api/historial') {
        try {
            const historialPath = path.join(DIRECTORY, 'historial.json');
            let historial = [];
            if (fs.existsSync(historialPath)) {
                historial = JSON.parse(fs.readFileSync(historialPath, 'utf8'));
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(historial));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: e.message }));
        }

    } else if (req.method === 'POST' && req.url === '/api/limpiar-historial') {
        try {
            const historialPath = path.join(DIRECTORY, 'historial.json');
            fs.writeFileSync(historialPath, JSON.stringify([], null, 4), 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'success' }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: e.message }));
        }

    } else if (req.method === 'GET' && req.url === '/api/cierres') {
        try {
            const cierresPath = path.join(DIRECTORY, 'cierres.json');
            let cierres = {};
            if (fs.existsSync(cierresPath)) {
                cierres = JSON.parse(fs.readFileSync(cierresPath, 'utf8'));
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(cierres));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: e.message }));
        }

    } else if (req.method === 'GET' && req.url.startsWith('/api/cierre-status')) {
        try {
            const urlObj = new URL(req.url, `http://${req.headers.host}`);
            const pasilloId = urlObj.searchParams.get('id');
            const cierresPath = path.join(DIRECTORY, 'cierres.json');
            let cierres = {};
            if (fs.existsSync(cierresPath)) {
                cierres = JSON.parse(fs.readFileSync(cierresPath, 'utf8'));
            }
            const lastClosed = cierres[pasilloId] || null;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ lastClosed }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: e.message }));
        }

    } else if (req.method === 'GET' && req.url.startsWith('/api/pasillos-config')) {
        try {
            const configPath = path.join(DIRECTORY, 'pasillos_config.json');
            let config = {};
            if (fs.existsSync(configPath)) {
                config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(config));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: e.message }));
        }

    } else if (req.method === 'POST' && req.url === '/api/pasillos-config') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const configPath = path.join(DIRECTORY, 'pasillos_config.json');
                fs.writeFileSync(configPath, JSON.stringify(data, null, 4), 'utf8');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'success' }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: e.message }));
            }
        });

    } else if (req.method === 'GET' && req.url === '/api/pendientes') {
        try {
            const pendientesPath = path.join(DIRECTORY, 'pendientes.json');
            let pendientes = [];
            if (fs.existsSync(pendientesPath)) {
                pendientes = JSON.parse(fs.readFileSync(pendientesPath, 'utf8'));
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(pendientes));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: e.message }));
        }

    } else if (req.method === 'POST' && req.url === '/api/pendientes') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (!data.code || !data.name) throw new Error('Faltan datos de producto');

                const pendientesPath = path.join(DIRECTORY, 'pendientes.json');
                let pendientes = [];
                if (fs.existsSync(pendientesPath)) {
                    pendientes = JSON.parse(fs.readFileSync(pendientesPath, 'utf8'));
                }

                // Add unique id
                data.id = Date.now().toString();
                data.fecha = new Date().toISOString();

                pendientes.push(data);

                fs.writeFileSync(pendientesPath, JSON.stringify(pendientes, null, 4), 'utf8');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'success' }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: e.message }));
            }
        });

    } else if (req.method === 'POST' && req.url === '/api/resolver-pendiente') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (!data.id || !data.accion) throw new Error('Faltan datos de la resolución');

                const pendientesPath = path.join(DIRECTORY, 'pendientes.json');
                let pendientes = [];
                if (fs.existsSync(pendientesPath)) {
                    pendientes = JSON.parse(fs.readFileSync(pendientesPath, 'utf8'));
                }

                pendientes = pendientes.filter(p => p.id !== data.id);

                fs.writeFileSync(pendientesPath, JSON.stringify(pendientes, null, 4), 'utf8');

                // Registrar en historial action
                const historialPath = path.join(DIRECTORY, 'historial.json');
                let historial = [];
                if (fs.existsSync(historialPath)) {
                    historial = JSON.parse(fs.readFileSync(historialPath, 'utf8'));
                }
                const evento = {
                    usuario: 'Admin',
                    accion: `${data.accion === 'aceptar' ? 'Aceptó' : 'Rechazó'} el producto ${data.name || 'nuevo'} del ${data.pasillo || 'pasillo'}`,
                    fecha: new Date().toISOString()
                };
                historial.unshift(evento);
                fs.writeFileSync(historialPath, JSON.stringify(historial, null, 4), 'utf8');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'success' }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: e.message }));
            }
        });

    } else if (req.method === 'POST' && req.url === '/api/cerrar-pasillo') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { pasilloId, pasilloName, usuario } = data;
                if (!pasilloId) throw new Error('Falta pasilloId');

                const cierresPath = path.join(DIRECTORY, 'cierres.json');
                let cierres = {};
                if (fs.existsSync(cierresPath)) {
                    cierres = JSON.parse(fs.readFileSync(cierresPath, 'utf8'));
                }
                const nowStr = new Date().toISOString();
                cierres[pasilloId] = nowStr;
                fs.writeFileSync(cierresPath, JSON.stringify(cierres, null, 4), 'utf8');

                // Registrar en historial
                const historialPath = path.join(DIRECTORY, 'historial.json');
                let historial = [];
                if (fs.existsSync(historialPath)) {
                    historial = JSON.parse(fs.readFileSync(historialPath, 'utf8'));
                }
                const evento = {
                    usuario: usuario || 'Admin',
                    accion: `Cerró e inicializó en 0 el pasillo ${pasilloName || pasilloId}`,
                    fecha: nowStr
                };
                historial.unshift(evento);
                fs.writeFileSync(historialPath, JSON.stringify(historial, null, 4), 'utf8');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'success', lastClosed: nowStr }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: e.message }));
            }
        });

    } else if (req.method === 'POST' && req.url === '/api/enviar-reporte') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const aisle = (data.aisleName || 'Pasillo').replace(/ /g, '_');
                const resp = (data.responsable || 'Responsable').replace(/ /g, '_');

                const now = new Date();
                const filename = `${aisle}_${resp}.json`;

                const rawAisleName = data.aisleName || 'Pasillo';
                const folderName = getFolderName(rawAisleName);
                const targetDir = path.join(REPORTES_DIR, folderName);
                if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

                const filepath = path.join(targetDir, filename);

                fs.writeFileSync(filepath, JSON.stringify(data, null, 4), 'utf8');

                // Registrar en historial
                try {
                    const historialPath = path.join(DIRECTORY, 'historial.json');
                    let historial = [];
                    if (fs.existsSync(historialPath)) {
                        historial = JSON.parse(fs.readFileSync(historialPath, 'utf8'));
                    }
                    const evento = {
                        usuario: (data.responsable || 'Responsable').replace(/_/g, ' ').toUpperCase(),
                        accion: `Envío reporte ${data.aisleName || 'Pasillo'}`,
                        fecha: new Date().toISOString()
                    };
                    historial.unshift(evento);
                    fs.writeFileSync(historialPath, JSON.stringify(historial, null, 4), 'utf8');
                } catch (e) {
                    console.error("Error registrando en historial:", e);
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'success', message: 'Reporte recibido correctamente' }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: e.message }));
            }
        });

    } else if (req.method === 'POST' && req.url === '/api/enviar-reporte-xlsx') {
        // Recibir multipart/form-data con el archivo .xlsx
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            try {
                const buffer = Buffer.concat(chunks);
                const contentType = req.headers['content-type'] || '';
                const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
                if (!boundaryMatch) throw new Error('No boundary in multipart');

                const rawBoundary = (boundaryMatch[1] || boundaryMatch[2]).trim();
                const boundaryBuf = Buffer.from('--' + rawBoundary);

                // Parsear partes del multipart
                const parts = [];
                let start = 0;
                // Secuencias de bytes para multipart
                const CRLF = Buffer.from([0x0D, 0x0A]);
                const CRLFCRLF = Buffer.from([0x0D, 0x0A, 0x0D, 0x0A]);
                const LF = Buffer.from([0x0A]);

                while (true) {
                    const bStart = buffer.indexOf(boundaryBuf, start);
                    if (bStart === -1) break;

                    // Comprobar si es el boundary final (--boundary--)
                    const afterBound = buffer.slice(bStart + boundaryBuf.length, bStart + boundaryBuf.length + 2);
                    if (afterBound[0] === 0x2D && afterBound[1] === 0x2D) break; // '--'

                    // Saltar el CRLF tras el boundary
                    const lineEnd = buffer.indexOf(LF, bStart + boundaryBuf.length);
                    if (lineEnd === -1) break;

                    const headerStart = lineEnd + 1;
                    const headerEnd = buffer.indexOf(CRLFCRLF, headerStart);
                    if (headerEnd === -1) break;

                    const headers = buffer.slice(headerStart, headerEnd).toString();
                    const bodyStart = headerEnd + 4; // saltar \r\n\r\n
                    const nextBoundary = buffer.indexOf(boundaryBuf, bodyStart);
                    if (nextBoundary === -1) break;

                    // Quitar el \r\n que precede al siguiente boundary
                    let bodyEnd = nextBoundary;
                    if (buffer[bodyEnd - 2] === 0x0D && buffer[bodyEnd - 1] === 0x0A) bodyEnd -= 2;
                    else if (buffer[bodyEnd - 1] === 0x0A) bodyEnd -= 1;

                    parts.push({ headers, body: buffer.slice(bodyStart, bodyEnd) });
                    start = nextBoundary;
                }

                // Extraer campos y archivo
                let aisleName = 'Pasillo', responsable = 'Responsable', companero = 'SIN AYUDANTE';
                let xlsxBuffer = null, originalFileName = 'reporte.xlsx';

                parts.forEach(part => {
                    const nameMatch = part.headers.match(/name="([^"]+)"/);
                    const fileMatch = part.headers.match(/filename="([^"]+)"/);
                    if (!nameMatch) return;

                    const fieldName = nameMatch[1].trim();
                    if (fileMatch) {
                        xlsxBuffer = part.body;
                        originalFileName = fileMatch[1].trim();
                    } else {
                        const val = part.body.toString().trim();
                        if (fieldName === 'aisleName') aisleName = val;
                        if (fieldName === 'responsable') responsable = val;
                        if (fieldName === 'companero') companero = val;
                    }
                });

                if (!xlsxBuffer) throw new Error('No se recibió el archivo xlsx');

                const now = new Date();
                // Usamos el nombre original limpio, sin timestamp extra para no ensuciar el nombre
                let cleanOriginal = originalFileName.replace(/\.xlsx$/i, '').trim();
                const filename = `${cleanOriginal}.xlsx`;

                const folderName = getFolderName(aisleName);
                const targetDir = path.join(REPORTES_DIR, folderName);
                if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

                const xlsxPath = path.join(targetDir, filename);

                fs.writeFileSync(xlsxPath, xlsxBuffer);

                // Registrar en historial
                try {
                    const historialPath = path.join(DIRECTORY, 'historial.json');
                    let historial = [];
                    if (fs.existsSync(historialPath)) {
                        historial = JSON.parse(fs.readFileSync(historialPath, 'utf8'));
                    }
                    const evento = {
                        usuario: (responsable || 'Responsable').replace(/_/g, ' ').toUpperCase(),
                        accion: `Envío reporte ${aisleName || 'Pasillo'}`,
                        fecha: new Date().toISOString()
                    };
                    historial.unshift(evento);
                    fs.writeFileSync(historialPath, JSON.stringify(historial, null, 4), 'utf8');
                } catch (e) {
                    console.error("Error registrando en historial:", e);
                }

                // Use relative path for response
                const relativePath = path.relative(REPORTES_DIR, xlsxPath).replace(/\\/g, '/');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'success', file: relativePath }));
            } catch (e) {
                console.error('Error al guardar xlsx:', e.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: e.message }));
            }
        });

    } else if (req.method === 'GET' && req.url === '/api/session-status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(sessionControl));

    } else if (req.method === 'POST' && req.url === '/api/force-logout-all') {
        sessionControl.global_logout = Date.now();
        saveSessionControl();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success' }));

    } else if (req.method === 'POST' && req.url === '/api/force-logout-user') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const { cedula } = JSON.parse(body);
                if (cedula) {
                    sessionControl.kicked_users[cedula] = Date.now();
                    saveSessionControl();
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'success' }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: e.message }));
            }
        });

    } else if (req.method === 'POST' && req.url === '/api/agregar-pasillo') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const { id, nombre, productos } = JSON.parse(body);
                if (!id || !nombre) throw new Error('Faltan datos');

                const productsPath = path.join(__dirname, 'src', 'products.js');
                let content = fs.readFileSync(productsPath, 'utf8');

                // Verificar que no exista ya
                if (content.includes(`"${id}"`)) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'exists', message: 'El pasillo ya existe en products.js' }));
                    return;
                }

                // Construir el bloque a insertar
                const prods = (productos || []).map(p => `        "${p}"`).join(',\n');
                const bloque = `    "${id}": [\n${prods ? prods + '\n' : ''}    ]`;

                // Localizar el cierre correcto de ALL_PRODUCTS usando el marcador posterior
                const marker = 'window.ALL_PRODUCTS = ALL_PRODUCTS;';
                const markerIdx = content.indexOf(marker);
                if (markerIdx === -1) throw new Error('No se encontró el marcador en products.js');

                // Buscar el '};' justo antes del marcador
                const beforeMarker = content.slice(0, markerIdx);
                const closeIdx = beforeMarker.lastIndexOf('};');
                if (closeIdx === -1) throw new Error('No se encontró el cierre del objeto ALL_PRODUCTS');

                // Añadir coma al bloque anterior si falta
                const before = content.slice(0, closeIdx).trimEnd();
                const needsComma = !before.endsWith(',');
                const after = content.slice(closeIdx + 2); // lo que viene tras '};'
                const newContent = before + (needsComma ? ',' : '') + '\n' + bloque + '\n};\n' + after;

                fs.writeFileSync(productsPath, newContent, 'utf8');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'success', message: `Pasillo "${nombre}" guardado en products.js` }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: e.message }));
            }
        });

    } else if (req.method === 'POST' && req.url === '/api/agregar-producto') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const { pasilloId, productoNombre } = JSON.parse(body);
                if (!pasilloId || !productoNombre) throw new Error('Faltan datos');

                const productsPath = path.join(__dirname, 'src', 'products.js');
                let content = fs.readFileSync(productsPath, 'utf8');

                // Regex para capturar el arreglo de este pasillo en el archivo estático
                const escapedId = pasilloId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const pasilloRegex = new RegExp(`("${escapedId}"\\s*:\\s*\\[)([\\s\\S]*?)(\\])`);
                const match = content.match(pasilloRegex);

                if (!match) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'error', message: 'Pasillo no encontrado en products.js' }));
                    return;
                }

                let insideArray = match[2];
                // Insertaremos coma si no está vacío y no la tiene aún
                if (insideArray.trim() !== '') {
                    const lineasTrimmed = insideArray.trimEnd();
                    if (!lineasTrimmed.endsWith(',')) insideArray = lineasTrimmed + ',\n';
                }

                insideArray += `        "${productoNombre}"\n    `;

                const newContent = content.replace(pasilloRegex, `$1\n${insideArray.trimStart()}$3`);
                fs.writeFileSync(productsPath, newContent, 'utf8');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'success', message: 'Producto insertado directamente' }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: e.message }));
            }
        });

    } else if (req.method === 'POST' && req.url === '/api/eliminar-pasillo') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const { pasilloId } = JSON.parse(body);
                if (!pasilloId) throw new Error('Faltan datos');

                const productsPath = path.join(__dirname, 'src', 'products.js');
                let content = fs.readFileSync(productsPath, 'utf8');

                const escapedId = pasilloId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                // Matches optional leading whitespace, the key, the colon, the array, and an optional trailing comma.
                const pasilloRegex = new RegExp(`\\s*"${escapedId}"\\s*:\\s*\\[[\\s\\S]*?\\]\\s*,?`, 'm');

                const newContent = content.replace(pasilloRegex, '');

                fs.writeFileSync(productsPath, newContent, 'utf8');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'success', message: 'Pasillo eliminado' }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: e.message }));
            }
        });

    } else {
        // Sirviendo archivos estaticos
        let filePath = '.' + req.url;
        // Quitar query params si existen
        filePath = filePath.split('?')[0];

        if (filePath === './') filePath = './index.html';

        const contentType = getContentType(filePath);

        fs.readFile(path.join(__dirname, filePath), (err, content) => {
            if (err) {
                if (err.code == 'ENOENT') {
                    res.writeHead(404);
                    res.end('File not found');
                } else {
                    res.writeHead(500);
                    res.end('Server error');
                }
            } else {
                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                    'Surrogate-Control': 'no-store'
                });
                res.end(content, 'utf-8');
            }
        });
    }
};

// ── Servidores ──────────────────────────────────────────────────────────────
const httpServer = http.createServer(requestHandler);
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`========================================================`);
    console.log(`  🚀  Servidor HTTP Iniciado`);
    console.log(`========================================================`);
    console.log(`  En esta PC (Local):`);
    console.log(`     http://localhost:${PORT}`);

    console.log(`\n  En la RED Local (Teléfonos/Tablets):`);
    const interfaces = os.networkInterfaces();
    for (let devName in interfaces) {
        let iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            let alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                console.log(`     http://${alias.address}:${PORT}`);
            }
        }
    }
    console.log(`========================================================`);
    console.log(`  Registros en: ${DIRECTORY}`);
    console.log(`========================================================`);
});
