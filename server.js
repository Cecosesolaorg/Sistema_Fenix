const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const auth = require('./src/auth');

// Que todo archivo/carpeta nuevo nazca privado: 600 para archivos, 700 para carpetas.
try { process.umask(0o077); } catch (e) { }

const PORT = 8000;   // HTTP  (fallback)
const DIRECTORY = path.join(__dirname, 'registros');
const REPORTES_DIR = path.join(__dirname, 'inventarios base de datos');
const AVATARS_DIR = path.join(DIRECTORY, 'avatars');

// Crear las carpetas con permisos de dueño (700) si no existen
function ensureSecureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    try { fs.chmodSync(dir, 0o700); } catch (e) { }
}

ensureSecureDir(DIRECTORY);
ensureSecureDir(REPORTES_DIR);
ensureSecureDir(AVATARS_DIR);

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
    const extname = path.extname(filePath).toLowerCase();
    switch (extname) {
        case '.html': return 'text/html; charset=utf-8';
        case '.js': return 'text/javascript; charset=utf-8';
        case '.css': return 'text/css; charset=utf-8';
        case '.json': return 'application/json; charset=utf-8';
        case '.png': return 'image/png';
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.gif': return 'image/gif';
        case '.svg': return 'image/svg+xml';
        case '.webp': return 'image/webp';
        case '.ico': return 'image/x-icon';
        case '.woff': return 'font/woff';
        case '.woff2': return 'font/woff2';
        default: return 'application/octet-stream';
    }
};

// ── Endurecimiento de rutas y cuerpos ───────────────────────────────────────
const ROOT_DIR = __dirname;
const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB

// Carpetas con datos personales: nunca se sirven como archivos estáticos.
const PRIVATE_DIRS = new Set(['registros', 'inventarios base de datos', 'reportes_enviados', 'avatars', 'tools']);

// Solo se entregan estas extensiones. Nada de .json (los datos viven en registros/).
const STATIC_EXTENSIONS = new Set([
    '.html', '.js', '.css', '.png', '.jpg', '.jpeg', '.gif',
    '.svg', '.webp', '.ico', '.woff', '.woff2'
]);

// Archivos del proyecto que no deben descargarse aunque su extensión esté permitida.
const STATIC_BLOCKLIST = new Set(['server.js']);

/**
 * true si `target` está estrictamente dentro de `dir` (no el directorio mismo
 * y no un hermano con prefijo común, ej. "datos_extra" vs "datos").
 */
function isInside(dir, target) {
    const rel = path.relative(dir, target);
    return rel !== '' && rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
}

/**
 * Limpia un nombre de archivo: quita rutas, caracteres raros, puntos iniciales
 * y limita el largo. Devuelve `fallback` si no queda nada usable.
 */
function safeFileStem(value, fallback) {
    const stem = String(value == null ? '' : value)
        .replace(/\.xlsx$/i, '')
        .replace(/[^A-Za-z0-9._ -]/g, '')
        .replace(/^\.+/, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100);
    return stem || fallback;
}

/**
 * Traduce una URL a una ruta real dentro del proyecto, o null si escapa,
 * apunta a una carpeta privada o usa una extensión no permitida.
 */
function resolveStaticPath(rawUrl) {
    let pathname;
    try {
        pathname = decodeURIComponent(String(rawUrl || '/').split('?')[0].split('#')[0]);
    } catch (e) {
        return null; // codificación inválida
    }

    if (pathname === '/' || pathname === '') pathname = '/index.html';
    if (pathname.includes('\0')) return null;

    const resolved = path.resolve(ROOT_DIR, '.' + pathname);
    if (!isInside(ROOT_DIR, resolved)) return null;

    const relParts = path.relative(ROOT_DIR, resolved).split(path.sep);
    if (PRIVATE_DIRS.has(relParts[0])) return null;
    if (relParts.some(p => p === '..')) return null;
    if (STATIC_BLOCKLIST.has(relParts[0].toLowerCase())) return null;

    if (!STATIC_EXTENSIONS.has(path.extname(resolved).toLowerCase())) return null;

    return resolved;
}

function serveStatic(req, res) {
    const resolved = resolveStaticPath(req.url);
    if (!resolved) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
    }

    fs.stat(resolved, (err, stat) => {
        if (err || !stat.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not found');
            return;
        }

        fs.readFile(resolved, (readErr, content) => {
            if (readErr) {
                const notFound = readErr.code === 'ENOENT';
                res.writeHead(notFound ? 404 : 500);
                res.end(notFound ? 'File not found' : 'Server error');
                return;
            }

            res.writeHead(200, {
                'Content-Type': getContentType(resolved),
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Surrogate-Control': 'no-store'
            });
            res.end(content);
        });
    });
}



// ── Usuarios, sesiones y respuestas ─────────────────────────────────────────
const CEDULA_RE = /^[0-9A-Za-z_-]{1,40}$/;
// Nombres visibles: sin etiquetas HTML ni comillas, largo acotado.
const NOMBRE_RE = /^[\p{L}\p{N} .,'_\-]{1,80}$/u;

// Archivos de estado que viven en registros/ pero no son usuarios.
const STATE_FILES = new Set([
    'historial.json', 'cierres.json', 'pendientes.json',
    'pasillos_config.json', 'qrcodes.json', 'session_control.json',
    'settings.json', 'feedback.json'
]);

function sendJson(res, status, payload) {
    if (res.headersSent || res.writableEnded) return;
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
}

function readJsonBody(req, res, onJson) {
    let body = '';
    let finished = false;

    req.on('data', (chunk) => {
        if (finished || res.headersSent) return;
        body += chunk;
        if (body.length > MAX_BODY_BYTES) {
            finished = true;
            sendJson(res, 413, { status: 'error', message: 'Cuerpo de la petición demasiado grande (máximo 5 MB)' });
        }
    });

    req.on('end', () => {
        if (finished || res.headersSent) return;
        finished = true;
        let data;
        try {
            data = JSON.parse(body || '{}');
        } catch (e) {
            sendJson(res, 400, { status: 'error', message: 'JSON inválido' });
            return;
        }
        onJson(data);
    });
}

/** Lee todos los usuarios de registros/ sin exponer el nombre del archivo. */
function readUsers() {
    const users = [];
    if (!fs.existsSync(DIRECTORY)) return users;

    for (const file of fs.readdirSync(DIRECTORY)) {
        if (!file.endsWith('.json') || STATE_FILES.has(file)) continue;
        try {
            const data = JSON.parse(fs.readFileSync(path.join(DIRECTORY, file), 'utf8'));
            if (data && typeof data === 'object' && data.cedula) {
                data.__file = file;
                users.push(data);
            }
        } catch (e) { /* archivo corrupto: se ignora */ }
    }
    return users;
}

function findUserByCedula(cedula) {
    if (!CEDULA_RE.test(String(cedula || ''))) return null;
    return readUsers().find(u => String(u.cedula) === String(cedula)) || null;
}

/** Datos de usuario seguros para enviar al cliente (nunca contraseñas). */
function publicUser(user) {
    return {
        cedula: user.cedula,
        nombre: user.nombre,
        role: user.role || 'user',
        fecha: user.fecha
    };
}

function timestampNow() {
    const now = new Date();
    return now.getFullYear().toString() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') + '_' +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0');
}

/** Aplica 700 a las carpetas de datos y 600 a todos sus archivos. */
function securePermissions() {
    const walk = (dir) => {
        if (!fs.existsSync(dir)) return;
        try { fs.chmodSync(dir, 0o700); } catch (e) { }

        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }

        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else {
                try { fs.chmodSync(full, 0o600); } catch (e) { }
            }
        }
    };

    walk(DIRECTORY);
    walk(REPORTES_DIR);
    walk(path.join(__dirname, 'reportes_enviados'));
}

/**
 * Convierte a hash las contraseñas en texto plano que queden en registros/.
 * Se ejecuta al arrancar, para que nadie dependa de haber iniciado sesión.
 */
// ── Productos: datos en JSON, nunca en código ────────────────────────────────
// src/products.json es la única fuente de verdad. src/products.js es una
// plantilla sin datos: el servidor inyecta el JSON serializado al servirla.
const PRODUCTS_JSON = path.join(__dirname, 'src', 'products.json');
const PRODUCTS_TEMPLATE = path.join(__dirname, 'src', 'products.js');
const PRODUCTS_MARKER = '/*__PRODUCTS_JSON__*/{}';
const MAX_PRODUCTOS_POR_PASILLO = 3000;
const MAX_LARGO_PRODUCTO = 120;
const PASILLO_ID_RE = /^[\p{L}\p{N} _-]{1,80}$/u;

/** Nombre de producto: sin controles ni etiquetas, con largo acotado. */
function validProductName(value) {
    if (typeof value !== 'string') return null;
    const nombre = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
    if (!nombre || nombre.length > MAX_LARGO_PRODUCTO) return null;
    if (/[<>"`\\]/.test(nombre)) return null;
    return nombre;
}

function validPasilloId(value) {
    if (typeof value !== 'string') return null;
    const id = value.trim();
    return PASILLO_ID_RE.test(id) ? id : null;
}

function readProductsData() {
    try {
        const data = JSON.parse(fs.readFileSync(PRODUCTS_JSON, 'utf8'));
        return (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
    } catch (e) {
        return {};
    }
}

/** Escritura atómica del JSON de productos (nunca se escribe código). */
function writeProductsData(data) {
    const tmp = PRODUCTS_JSON + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 4) + '\n', { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, PRODUCTS_JSON);
    try { fs.chmodSync(PRODUCTS_JSON, 0o600); } catch (e) { }
}

let productsScriptCache = { stamp: '', body: '' };

/** Genera el JS que consume el navegador, inyectando los datos como JSON. */
function productsScript() {
    const statJson = fs.statSync(PRODUCTS_JSON);
    const statTpl = fs.statSync(PRODUCTS_TEMPLATE);
    const stamp = `${statJson.mtimeMs}:${statJson.size}:${statTpl.mtimeMs}:${statTpl.size}`;
    if (productsScriptCache.stamp === stamp) return productsScriptCache.body;

    const template = fs.readFileSync(PRODUCTS_TEMPLATE, 'utf8');
    if (!template.includes(PRODUCTS_MARKER)) throw new Error('Plantilla de productos inválida');

    const json = JSON.stringify(readProductsData(), null, 4);
    const body = template.replace(PRODUCTS_MARKER, () => json);
    productsScriptCache = { stamp, body };
    return body;
}

// ── Ajustes de la aplicación ────────────────────────────────────────────────
// Los trabajadores consultan estos valores al abrir la calculadora y al
// exportar un Excel. Solo un admin los puede cambiar.
const SETTINGS_PATH = path.join(DIRECTORY, 'settings.json');
const INVENTORY_MODES = new Set(['calculator', 'quick_notes']);
const DEFAULT_SETTINGS = { inventoryMode: 'calculator', enableFeedback: false };

/** Lee los ajustes, ignorando cualquier valor fuera de rango. */
function readSettings() {
    const ajustes = Object.assign({}, DEFAULT_SETTINGS);
    try {
        const guardado = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
        if (guardado && typeof guardado === 'object' && !Array.isArray(guardado)) {
            if (INVENTORY_MODES.has(guardado.inventoryMode)) ajustes.inventoryMode = guardado.inventoryMode;
            if (typeof guardado.enableFeedback === 'boolean') ajustes.enableFeedback = guardado.enableFeedback;
        }
    } catch (e) { /* sin archivo o corrupto: valores por defecto */ }
    return ajustes;
}

/** Escritura atómica de los ajustes con permisos privados. */
function writeSettings(ajustes) {
    const tmp = SETTINGS_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(ajustes, null, 4) + '\n', { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, SETTINGS_PATH);
    try { fs.chmodSync(SETTINGS_PATH, 0o600); } catch (e) { }
}

// ── Comentarios de los trabajadores ─────────────────────────────────────────
const FEEDBACK_PATH = path.join(DIRECTORY, 'feedback.json');
const MAX_FEEDBACK = 2000;

/** Texto de una línea: sin controles, espacios normalizados y largo acotado. */
function cleanSingleLine(value, max) {
    return String(value == null ? '' : value)
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max);
}

/** Texto con saltos de línea: conserva párrafos, quita controles raros. */
function cleanMultiline(value, max) {
    return String(value == null ? '' : value)
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, max);
}

function readFeedback() {
    try {
        const lista = JSON.parse(fs.readFileSync(FEEDBACK_PATH, 'utf8'));
        return Array.isArray(lista) ? lista : [];
    } catch (e) {
        return [];
    }
}

function writeFeedback(lista) {
    const tmp = FEEDBACK_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(lista, null, 4) + '\n', { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, FEEDBACK_PATH);
    try { fs.chmodSync(FEEDBACK_PATH, 0o600); } catch (e) { }
}

function migratePlaintextPasswords() {
    let migrated = 0;
    let weak = 0;

    for (const user of readUsers()) {
        if (!user.password || auth.isHashed(user.password)) continue;

        const plano = String(user.password);
        if (plano === String(user.cedula) || plano.length < 6) weak += 1;

        try {
            const file = user.__file;
            const filepath = path.join(DIRECTORY, file || '');
            if (!file || !isInside(DIRECTORY, filepath)) continue;

            user.password_hash = auth.hashPassword(plano);
            delete user.password;
            delete user.__file;

            fs.writeFileSync(filepath, JSON.stringify(user, null, 4), { encoding: 'utf8', mode: 0o600 });
            try { fs.chmodSync(filepath, 0o600); } catch (e) { }
            migrated += 1;
        } catch (e) {
            console.error(`No se pudo migrar la contraseña de ${user.cedula}:`, e.message);
        }
    }

    return { migrated, weak };
}

/** Sesión activa de la petición, respetando los cierres remotos del panel. */
function currentSession(req) {
    const cookies = auth.parseCookies(req.headers.cookie);
    const token = cookies[auth.COOKIE_NAME];
    const session = auth.getSession(token);
    if (!session) return null;

    const globalTime = sessionControl.global_logout || 0;
    const kickTime = (sessionControl.kicked_users || {})[session.cedula] || 0;
    if (globalTime > session.createdAt || kickTime > session.createdAt) {
        auth.destroySession(token);
        return null;
    }
    return session;
}

// ── Límite de intentos de login ─────────────────────────────────────────────
const LOGIN_WINDOW_MS = 5 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const loginAttempts = new Map(); // "ip|cedula" -> { count, first }

function loginKey(req, cedula) {
    const ip = (req.socket && req.socket.remoteAddress) || 'desconocida';
    return `${ip}|${cedula}`;
}

function isLoginBlocked(key) {
    const record = loginAttempts.get(key);
    if (!record) return false;
    if (Date.now() - record.first > LOGIN_WINDOW_MS) {
        loginAttempts.delete(key);
        return false;
    }
    return record.count >= LOGIN_MAX_ATTEMPTS;
}

function recordLoginFailure(key) {
    const now = Date.now();
    const record = loginAttempts.get(key);
    if (!record || now - record.first > LOGIN_WINDOW_MS) {
        loginAttempts.set(key, { count: 1, first: now });
    } else {
        record.count += 1;
    }
}

// ── Política de acceso por endpoint ─────────────────────────────────────────
// Rutas /api/ que se pueden usar sin sesión.
const PUBLIC_API = new Set([
    '/api/login',
    '/api/logout',
    '/api/register',
    '/api/server-ip',
    '/api/session-status',
    '/api/avatars'
]);

// POST que además exigen rol admin.
const ADMIN_POST = new Set([
    '/api/actualizar-rol',
    '/api/limpiar-historial',
    '/api/force-logout-all',
    '/api/force-logout-user',
    '/api/agregar-pasillo',
    '/api/agregar-producto',
    '/api/eliminar-pasillo',
    '/api/pasillos-config',
    '/api/resolver-pendiente',
    '/api/cerrar-pasillo',
    '/api/settings'
]);

const requestHandler = (req, res) => {
    // Cabeceras de seguridad para todas las respuestas
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-XSS-Protection', '0');
    // El panel usa manejadores inline, así que 'unsafe-inline' sigue siendo
    // necesario; el resto de la política bloquea orígenes, objetos y frames.
    res.setHeader('Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com https://cdnjs.cloudflare.com; " +
        "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
        "img-src 'self' data:; " +
        "connect-src 'self'; " +
        "object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");

    // Límite global de tamaño de cuerpo (todos los POST)
    let bodyBytes = 0;
    let bodyLimitHit = false;
    req.on('error', () => { });
    req.on('data', (chunk) => {
        if (bodyLimitHit) return;
        bodyBytes += chunk.length;
        if (bodyBytes > MAX_BODY_BYTES) {
            bodyLimitHit = true;
            const payload = JSON.stringify({
                status: 'error',
                message: 'Cuerpo de la petición demasiado grande (máximo 5 MB)'
            });
            if (!res.headersSent) {
                res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(payload, () => { try { req.destroy(); } catch (e) { } });
            } else {
                try { req.destroy(); } catch (e) { }
            }
        }
    });

    const pathname = String(req.url || '/').split('?')[0];
    const session = currentSession(req);

    // Política de acceso: todo /api/ exige sesión salvo la lista pública.
    if (pathname.startsWith('/api/') && !PUBLIC_API.has(pathname)) {
        if (!session) {
            sendJson(res, 401, { status: 'error', message: 'Sesión no válida. Volvé a ingresar.' });
            return;
        }
        if (req.method === 'POST' && ADMIN_POST.has(pathname) && session.role !== 'admin') {
            sendJson(res, 403, { status: 'error', message: 'Solo un administrador puede hacer esto.' });
            return;
        }
    }

    // CSRF básico: si el navegador manda Origin, tiene que coincidir con el Host.
    if (req.method === 'POST' && req.headers.origin) {
        let originHost = null;
        try { originHost = new URL(req.headers.origin).host; } catch (e) { originHost = null; }
        if (!originHost || originHost !== req.headers.host) {
            sendJson(res, 403, { status: 'error', message: 'Origen no permitido' });
            return;
        }
    }

    if (req.method === 'GET' && req.url === '/api/users') {
        // Requiere sesión (cualquier rol). Nunca devuelve contraseñas ni hashes.
        const users = readUsers().map(publicUser);
        sendJson(res, 200, users);

    } else if (req.method === 'POST' && req.url === '/api/login') {
        readJsonBody(req, res, (data) => {
            const cedula = String(data.cedula || '').trim();
            const password = String(data.password || '');

            if (!cedula || !password) {
                sendJson(res, 400, { status: 'error', message: 'Cédula y contraseña son obligatorias' });
                return;
            }

            const key = loginKey(req, cedula);
            if (isLoginBlocked(key)) {
                sendJson(res, 429, { status: 'error', message: 'Demasiados intentos fallidos. Esperá 5 minutos.' });
                return;
            }

            const user = findUserByCedula(cedula);
            const stored = user ? (user.password_hash || user.password) : null;

            if (!user || !auth.verifyPassword(password, stored)) {
                recordLoginFailure(key);
                sendJson(res, 401, { status: 'error', message: 'Cédula o contraseña incorrecta' });
                return;
            }

            loginAttempts.delete(key);

            // Migración perezosa: la primera vez que entra, la clave pasa a scrypt.
            if (!auth.isHashed(stored)) {
                try {
                    const file = user.__file;
                    user.password_hash = auth.hashPassword(password);
                    delete user.password;
                    delete user.__file;

                    const filepath = path.join(DIRECTORY, file || '');
                    if (file && isInside(DIRECTORY, filepath)) {
                        fs.writeFileSync(filepath, JSON.stringify(user, null, 4), 'utf8');
                        try { fs.chmodSync(filepath, 0o600); } catch (e) { }
                    }
                } catch (e) {
                    console.error('No se pudo migrar la contraseña a hash:', e.message);
                }
            }

            const token = auth.createSession(user);
            res.setHeader('Set-Cookie', auth.sessionCookie(token));
            sendJson(res, 200, { status: 'success', user: publicUser(user) });
        });

    } else if (req.method === 'POST' && req.url === '/api/logout') {
        const cookies = auth.parseCookies(req.headers.cookie);
        auth.destroySession(cookies[auth.COOKIE_NAME]);
        res.setHeader('Set-Cookie', auth.clearSessionCookie());
        sendJson(res, 200, { status: 'success' });

    } else if (req.method === 'GET' && req.url === '/api/me') {
        if (!session) {
            sendJson(res, 401, { status: 'error', message: 'No autenticado' });
        } else {
            sendJson(res, 200, {
                status: 'success',
                user: { cedula: session.cedula, nombre: session.nombre, role: session.role }
            });
        }

    } else if (req.method === 'GET' && req.url === '/api/settings') {
        sendJson(res, 200, readSettings());

    } else if (req.method === 'POST' && req.url === '/api/settings') {
        readJsonBody(req, res, (data) => {
            const ajustes = readSettings();

            if (data.inventoryMode !== undefined) {
                if (!INVENTORY_MODES.has(data.inventoryMode)) {
                    sendJson(res, 400, { status: 'error', message: 'Modo de inventario inválido' });
                    return;
                }
                ajustes.inventoryMode = data.inventoryMode;
            }

            if (data.enableFeedback !== undefined) {
                if (typeof data.enableFeedback !== 'boolean') {
                    sendJson(res, 400, { status: 'error', message: 'Valor de opinión inválido' });
                    return;
                }
                ajustes.enableFeedback = data.enableFeedback;
            }

            try {
                writeSettings(ajustes);
            } catch (e) {
                sendJson(res, 500, { status: 'error', message: 'No se pudieron guardar los ajustes' });
                return;
            }

            sendJson(res, 200, { status: 'success', settings: ajustes });
        });

    } else if (req.method === 'POST' && req.url === '/api/feedback') {
        readJsonBody(req, res, (data) => {
            const pasillo = cleanSingleLine(data.pasillo, 80);
            const mensaje = cleanMultiline(data.mensaje, 1000);

            if (!mensaje) {
                sendJson(res, 400, { status: 'error', message: 'Escribí un comentario antes de enviar' });
                return;
            }

            const lista = readFeedback();
            lista.unshift({
                pasillo,
                mensaje,
                usuario: (session && session.nombre) || 'Desconocido',
                cedula: (session && session.cedula) || '',
                fecha: new Date().toISOString()
            });

            try {
                writeFeedback(lista.slice(0, MAX_FEEDBACK));
            } catch (e) {
                sendJson(res, 500, { status: 'error', message: 'No se pudo guardar el comentario' });
                return;
            }

            sendJson(res, 200, { status: 'success' });
        });

    } else if (req.method === 'GET' && req.url === '/api/feedback') {
        if (!session || session.role !== 'admin') {
            sendJson(res, 403, { status: 'error', message: 'Solo un administrador puede ver los comentarios' });
        } else {
            sendJson(res, 200, readFeedback().slice(0, 200));
        }

    } else if (req.method === 'POST' && req.url === '/api/change-password') {
        readJsonBody(req, res, (data) => {
            const actual = String(data.actual || '');
            const nueva = String(data.nueva || '');

            if (!actual || !nueva) {
                sendJson(res, 400, { status: 'error', message: 'Completá la contraseña actual y la nueva' });
                return;
            }
            if (nueva.length < 6) {
                sendJson(res, 400, { status: 'error', message: 'La nueva contraseña debe tener al menos 6 caracteres' });
                return;
            }
            if (nueva === actual) {
                sendJson(res, 400, { status: 'error', message: 'La nueva contraseña debe ser distinta de la actual' });
                return;
            }

            const user = findUserByCedula(session.cedula);
            const stored = user ? (user.password_hash || user.password) : null;
            if (!user || !auth.verifyPassword(actual, stored)) {
                sendJson(res, 401, { status: 'error', message: 'La contraseña actual no es correcta' });
                return;
            }

            try {
                const file = user.__file;
                const filepath = path.join(DIRECTORY, file || '');
                if (!file || !isInside(DIRECTORY, filepath)) throw new Error('Ruta inválida');

                user.password_hash = auth.hashPassword(nueva);
                delete user.password;
                delete user.__file;

                fs.writeFileSync(filepath, JSON.stringify(user, null, 4), { encoding: 'utf8', mode: 0o600 });
                try { fs.chmodSync(filepath, 0o600); } catch (e) { }

                // Cerrar las demás sesiones y renovar la de este dispositivo.
                auth.destroySessionsForUser(session.cedula);
                const token = auth.createSession(user);
                res.setHeader('Set-Cookie', auth.sessionCookie(token));
                sendJson(res, 200, { status: 'success', message: 'Contraseña actualizada' });
            } catch (e) {
                sendJson(res, 500, { status: 'error', message: e.message });
            }
        });

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
        let relativeFileName = '';
        try {
            relativeFileName = decodeURIComponent(req.url.split('/api/descargar-reporte/')[1] || '');
        } catch (e) {
            relativeFileName = '';
        }
        const filePath = path.resolve(REPORTES_DIR, relativeFileName);

        if (relativeFileName && isInside(REPORTES_DIR, filePath) &&
            fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
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
        // Alta pública de usuarios. El rol SIEMPRE es 'user': el cliente no puede
        // escalar privilegios ni sobrescribir una cédula existente.
        readJsonBody(req, res, (data) => {
            try {
                const cedula = String(data.cedula || '').trim();
                const nombre = String(data.nombre || '').trim();
                const password = String(data.password || '');

                if (!CEDULA_RE.test(cedula)) throw new Error('Cédula inválida');
                if (!NOMBRE_RE.test(nombre)) {
                    throw new Error('El nombre solo puede tener letras, números, espacios y . , \' - _');
                }
                if (password.length < 4) throw new Error('La contraseña debe tener al menos 4 caracteres');
                if (password.length > 200) throw new Error('Contraseña demasiado larga');

                if (findUserByCedula(cedula)) {
                    sendJson(res, 409, {
                        status: 'error',
                        message: 'Esta cédula ya está registrada. Iniciá sesión.'
                    });
                    return;
                }

                const safeNombre = nombre.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 60) || 'Usuario';
                const record = {
                    cedula,
                    nombre,
                    password_hash: auth.hashPassword(password),
                    fecha: new Date().toISOString(),
                    role: 'user'
                };

                const filepath = path.join(DIRECTORY, `${safeNombre}_${cedula}_${timestampNow()}.json`);
                if (!isInside(DIRECTORY, filepath)) throw new Error('Ruta inválida');

                fs.writeFileSync(filepath, JSON.stringify(record, null, 4), 'utf8');
                try { fs.chmodSync(filepath, 0o600); } catch (e) { }

                // Auto-login tras registrarse.
                const token = auth.createSession(record);
                res.setHeader('Set-Cookie', auth.sessionCookie(token));
                sendJson(res, 200, {
                    status: 'success',
                    message: 'Registrado correctamente',
                    user: publicUser(record)
                });
            } catch (e) {
                sendJson(res, 400, { status: 'error', message: e.message });
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
                if (!CEDULA_RE.test(String(cedula))) throw new Error('Cédula inválida');
                if (!['user', 'coordinador', 'admin'].includes(newRole)) throw new Error('Rol inválido');

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
                    // El rol cambia: forzamos re-login para que la sesión lo refleje.
                    auth.destroySessionsForUser(cedula);
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
                const accion = String(data.accion || '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
                if (!accion) throw new Error('Faltan datos');
                if (accion.length > 160) throw new Error('Acción demasiado larga');

                const historialPath = path.join(DIRECTORY, 'historial.json');
                let historial = [];
                if (fs.existsSync(historialPath)) {
                    historial = JSON.parse(fs.readFileSync(historialPath, 'utf8'));
                }
                if (!Array.isArray(historial)) historial = [];

                // El usuario sale de la sesión, no del cuerpo de la petición.
                const evento = {
                    usuario: (session && session.nombre) || 'Desconocido',
                    accion,
                    fecha: new Date().toISOString()
                };

                // Agregamos al inicio para que el más reciente esté primero
                historial.unshift(evento);
                if (historial.length > 5000) historial = historial.slice(0, 5000);

                fs.writeFileSync(historialPath, JSON.stringify(historial, null, 4), { encoding: 'utf8', mode: 0o600 });

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

                const cedula = String(data.cedula).replace(/[^0-9A-Za-z_-]/g, '');
                if (!cedula || cedula.length > 40) throw new Error('Cédula inválida');

                // Solo imágenes en data URL: nada de HTML ni URLs externas.
                const foto = String(data.fotoBase64);
                if (foto.length > MAX_BODY_BYTES) throw new Error('La foto es demasiado grande');
                if (!/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(foto)) {
                    throw new Error('Formato de foto no permitido');
                }

                // Cada usuario cambia su avatar; solo admin puede tocar el de otro.
                if (session && session.role !== 'admin' && String(session.cedula) !== cedula) {
                    sendJson(res, 403, { status: 'error', message: 'No podés cambiar el avatar de otro usuario' });
                    return;
                }

                const filepath = path.join(AVATARS_DIR, `${cedula}.txt`);
                if (!isInside(AVATARS_DIR, filepath)) throw new Error('Ruta inválida');
                fs.writeFileSync(filepath, foto, { encoding: 'utf8', mode: 0o600 });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'success' }));
            } catch (e) {
                sendJson(res, 400, { status: 'error', message: e.message });
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

                const pasilloId = validPasilloId(data.pasillo || '');
                const nombreProducto = validProductName(String(data.name));
                const codigo = String(data.code).replace(/[^0-9A-Za-z_-]/g, '').slice(0, 40);
                if (!pasilloId || !nombreProducto) throw new Error('Datos de producto inválidos');

                const pendientesPath = path.join(DIRECTORY, 'pendientes.json');
                let pendientes = [];
                if (fs.existsSync(pendientesPath)) {
                    pendientes = JSON.parse(fs.readFileSync(pendientesPath, 'utf8'));
                }
                if (!Array.isArray(pendientes)) pendientes = [];

                const pendiente = {
                    id: Date.now().toString(),
                    fecha: new Date().toISOString(),
                    code: codigo,
                    name: nombreProducto,
                    pasillo: pasilloId
                };
                const existente = pendientes.find(p => p && p.name === pendiente.name && p.pasillo === pendiente.pasillo);
                if (!existente) pendientes.push(pendiente);
                if (pendientes.length > 500) pendientes = pendientes.slice(-500);

                fs.writeFileSync(pendientesPath, JSON.stringify(pendientes, null, 4), { encoding: 'utf8', mode: 0o600 });

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
                const aisle = safeFileStem(data.aisleName, 'Pasillo').replace(/\s+/g, '_');
                const resp = safeFileStem(data.responsable, 'Responsable').replace(/\s+/g, '_');

                const now = new Date();
                const filename = `${aisle}_${resp}.json`;

                const rawAisleName = data.aisleName || 'Pasillo';
                const folderName = getFolderName(rawAisleName);
                const targetDir = path.join(REPORTES_DIR, folderName);
                ensureSecureDir(targetDir);

                const filepath = path.join(targetDir, filename);
                if (!isInside(REPORTES_DIR, filepath)) throw new Error('Ruta inválida');

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
                let cleanOriginal = safeFileStem(originalFileName, 'reporte');
                const filename = `${cleanOriginal}.xlsx`;

                const folderName = getFolderName(aisleName);
                const targetDir = path.join(REPORTES_DIR, folderName);
                ensureSecureDir(targetDir);

                const xlsxPath = path.join(targetDir, filename);
                if (!isInside(REPORTES_DIR, xlsxPath)) throw new Error('Ruta inválida');

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
                    if (!CEDULA_RE.test(String(cedula))) throw new Error('Cédula inválida');
                    sessionControl.kicked_users[cedula] = Date.now();
                    saveSessionControl();
                    auth.destroySessionsForUser(cedula);
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'success' }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: e.message }));
            }
        });

    } else if (req.method === 'POST' && req.url === '/api/agregar-pasillo') {
        readJsonBody(req, res, (data) => {
            const id = validPasilloId(data.id);
            const nombre = String(data.nombre || '').trim();
            const productos = Array.isArray(data.productos) ? data.productos : [];

            if (!id) {
                sendJson(res, 400, { status: 'error', message: 'Identificador de pasillo inválido' });
                return;
            }
            if (!nombre || nombre.length > 80) {
                sendJson(res, 400, { status: 'error', message: 'Nombre de pasillo inválido' });
                return;
            }
            if (productos.length > MAX_PRODUCTOS_POR_PASILLO) {
                sendJson(res, 400, { status: 'error', message: 'Demasiados productos para un pasillo' });
                return;
            }

            const limpios = [];
            for (const p of productos) {
                const nombreProducto = validProductName(p);
                if (!nombreProducto) {
                    sendJson(res, 400, { status: 'error', message: 'Hay un nombre de producto inválido' });
                    return;
                }
                limpios.push(nombreProducto);
            }

            const catalogo = readProductsData();
            if (Object.prototype.hasOwnProperty.call(catalogo, id)) {
                sendJson(res, 200, { status: 'exists', message: 'El pasillo ya existe' });
                return;
            }

            catalogo[id] = limpios;
            try {
                writeProductsData(catalogo);
            } catch (e) {
                sendJson(res, 500, { status: 'error', message: 'No se pudo guardar el pasillo' });
                return;
            }

            sendJson(res, 200, { status: 'success', message: `Pasillo "${nombre}" creado` });

        });

    } else if (req.method === 'POST' && req.url === '/api/agregar-producto') {
        readJsonBody(req, res, (data) => {
            const pasilloId = validPasilloId(data.pasilloId);
            const productoNombre = validProductName(data.productoNombre);

            if (!pasilloId || !productoNombre) {
                sendJson(res, 400, { status: 'error', message: 'Datos de producto inválidos' });
                return;
            }

            const catalogo = readProductsData();
            if (!Array.isArray(catalogo[pasilloId])) {
                sendJson(res, 404, { status: 'error', message: 'Pasillo no encontrado' });
                return;
            }
            if (catalogo[pasilloId].length >= MAX_PRODUCTOS_POR_PASILLO) {
                sendJson(res, 400, { status: 'error', message: 'El pasillo alcanzó el máximo de productos' });
                return;
            }

            if (!catalogo[pasilloId].includes(productoNombre)) {
                catalogo[pasilloId].push(productoNombre);
            }

            try {
                writeProductsData(catalogo);
            } catch (e) {
                sendJson(res, 500, { status: 'error', message: 'No se pudo guardar el producto' });
                return;
            }

            sendJson(res, 200, { status: 'success', message: 'Producto agregado' });

        });

    } else if (req.method === 'POST' && req.url === '/api/eliminar-pasillo') {
        readJsonBody(req, res, (data) => {
            const pasilloId = validPasilloId(data.pasilloId);
            if (!pasilloId) {
                sendJson(res, 400, { status: 'error', message: 'Pasillo inválido' });
                return;
            }

            const catalogo = readProductsData();
            if (!Object.prototype.hasOwnProperty.call(catalogo, pasilloId)) {
                sendJson(res, 404, { status: 'error', message: 'Pasillo no encontrado' });
                return;
            }

            delete catalogo[pasilloId];

            try {
                writeProductsData(catalogo);
            } catch (e) {
                sendJson(res, 500, { status: 'error', message: 'No se pudo eliminar el pasillo' });
                return;
            }

            sendJson(res, 200, { status: 'success', message: 'Pasillo eliminado' });

        });

    } else if (req.method === 'GET' && pathname === '/src/products.js') {
        // El catálogo se sirve generado: los datos son JSON, no código.
        try {
            const body = productsScript();
            res.writeHead(200, {
                'Content-Type': 'text/javascript; charset=utf-8',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'X-Content-Type-Options': 'nosniff'
            });
            res.end(body);
        } catch (e) {
            sendJson(res, 500, { status: 'error', message: 'No se pudo cargar el catálogo' });
        }

    } else {
        // Sirviendo archivos estaticos (solo dentro del proyecto y con extension permitida)
        serveStatic(req, res);
    }
};

// ── Migración de datos y permisos al arrancar ───────────────────────────────
try {
    const { migrated, weak } = migratePlaintextPasswords();
    if (migrated > 0) console.log(`  🔐 Contraseñas migradas a hash: ${migrated}`);
    if (weak > 0) console.log(`  ⚠️  ${weak} contraseña(s) débil(es) al migrar: recomendá cambiarlas.`);
} catch (e) {
    console.error('Error migrando contraseñas:', e.message);
}
securePermissions();

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
