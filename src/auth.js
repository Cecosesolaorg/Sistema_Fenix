'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Autenticación del servidor Fénix
//
// - Contraseñas con scrypt (node:crypto, sin dependencias).
// - Sesiones en memoria con cookie HttpOnly.
// - Compatibilidad con contraseñas en texto plano heredadas: se verifican una
//   sola vez y se migran a hash desde server.js.
// ─────────────────────────────────────────────────────────────────────────────

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const COOKIE_NAME = 'fenix_sid';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas

// Las sesiones se guardan en registros/sesiones.json (sólo hashes) para que
// reiniciar el servidor no obligue a todos a volver a iniciar sesión.
const SESSIONS_FILE = path.join(__dirname, '..', 'registros', 'sesiones.json');
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(String(password), salt, KEY_LEN, {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P
    });
    return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function isHashed(value) {
    return typeof value === 'string' && value.startsWith('scrypt$');
}

/**
 * Compara una contraseña con un valor guardado (hash scrypt o texto plano).
 * Devuelve true/false. Nunca lanza por un formato inválido.
 */
function verifyPassword(password, stored) {
    if (typeof stored !== 'string' || stored.length === 0) return false;

    if (!isHashed(stored)) {
        // Contraseña heredada en texto plano: comparación en tiempo constante.
        const a = Buffer.from(String(password));
        const b = Buffer.from(stored);
        return a.length === b.length && crypto.timingSafeEqual(a, b);
    }

    const parts = stored.split('$');
    if (parts.length !== 6) return false;

    const n = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

    let salt;
    let expected;
    try {
        salt = Buffer.from(parts[4], 'hex');
        expected = Buffer.from(parts[5], 'hex');
    } catch (e) {
        return false;
    }
    if (salt.length === 0 || expected.length === 0) return false;

    try {
        const actual = crypto.scryptSync(String(password), salt, expected.length, { N: n, r, p });
        return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
    } catch (e) {
        return false;
    }
}

// ── Sesiones ────────────────────────────────────────────────────────────────

// token (hash) -> { cedula, nombre, role, createdAt, expiresAt }
const sessions = new Map();

/** La cookie nunca se guarda en disco: sólo su hash. */
function tokenHash(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function guardarSesiones() {
    try {
        const ahora = Date.now();
        const data = {};
        for (const [hash, session] of sessions) {
            if (session && Number(session.expiresAt) > ahora) data[hash] = session;
        }
        const dir = path.dirname(SESSIONS_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
        try { fs.chmodSync(SESSIONS_FILE, 0o600); } catch (e) { }
    } catch (e) {
        // Nunca debe romper el login por un problema de disco.
        console.error('No se pudieron guardar las sesiones:', e.message);
    }
}

function cargarSesiones() {
    try {
        if (!fs.existsSync(SESSIONS_FILE)) return;
        const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8')) || {};
        const ahora = Date.now();
        for (const hash of Object.keys(data)) {
            const session = data[hash];
            if (!session || !session.cedula) continue;
            if (Number(session.expiresAt) <= ahora) continue;
            sessions.set(hash, session);
        }
    } catch (e) {
        console.error('No se pudieron leer las sesiones guardadas:', e.message);
    }
}

cargarSesiones();

function createSession(user) {
    const token = crypto.randomBytes(32).toString('base64url');
    const now = Date.now();
    sessions.set(tokenHash(token), {
        cedula: String(user.cedula),
        nombre: user.nombre || '',
        role: user.role || 'user',
        createdAt: now,
        expiresAt: now + SESSION_TTL_MS
    });
    guardarSesiones();
    return token;
}

function getSession(token) {
    if (!token) return null;
    const hash = tokenHash(token);
    const session = sessions.get(hash);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
        sessions.delete(hash);
        guardarSesiones();
        return null;
    }
    return session;
}

function destroySession(token) {
    if (!token) return;
    if (sessions.delete(tokenHash(token))) guardarSesiones();
}

/** Invalida todas las sesiones de una cédula (cambio de rol, expulsión, etc.). */
function destroySessionsForUser(cedula) {
    const target = String(cedula);
    let cambio = false;
    for (const [hash, session] of sessions) {
        if (session.cedula === target) {
            sessions.delete(hash);
            cambio = true;
        }
    }
    if (cambio) guardarSesiones();
}

function parseCookies(header) {
    const out = {};
    if (!header) return out;
    for (const part of String(header).split(';')) {
        const index = part.indexOf('=');
        if (index === -1) continue;
        const key = part.slice(0, index).trim();
        if (!key) continue;
        let value = part.slice(index + 1).trim();
        try { value = decodeURIComponent(value); } catch (e) { /* valor crudo */ }
        out[key] = value;
    }
    return out;
}

function sessionCookie(token, secure) {
    // Secure solo bajo HTTPS: en HTTP el navegador descartaría la cookie.
    const extra = secure ? '; Secure' : '';
    return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${extra}`;
}

function clearSessionCookie(secure) {
    const extra = secure ? '; Secure' : '';
    return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${extra}`;
}

module.exports = {
    COOKIE_NAME,
    SESSION_TTL_MS,
    hashPassword,
    isHashed,
    verifyPassword,
    createSession,
    getSession,
    destroySession,
    destroySessionsForUser,
    parseCookies,
    sessionCookie,
    clearSessionCookie
};
