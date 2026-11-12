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

const COOKIE_NAME = 'fenix_sid';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas
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

const sessions = new Map(); // token -> { cedula, nombre, role, createdAt, expiresAt }

function createSession(user) {
    const token = crypto.randomBytes(32).toString('base64url');
    const now = Date.now();
    sessions.set(token, {
        cedula: String(user.cedula),
        nombre: user.nombre || '',
        role: user.role || 'user',
        createdAt: now,
        expiresAt: now + SESSION_TTL_MS
    });
    return token;
}

function getSession(token) {
    if (!token) return null;
    const session = sessions.get(token);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
        sessions.delete(token);
        return null;
    }
    return session;
}

function destroySession(token) {
    if (token) sessions.delete(token);
}

/** Invalida todas las sesiones de una cédula (cambio de rol, expulsión, etc.). */
function destroySessionsForUser(cedula) {
    const target = String(cedula);
    for (const [token, session] of sessions) {
        if (session.cedula === target) sessions.delete(token);
    }
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

function sessionCookie(token) {
    return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
}

function clearSessionCookie() {
    return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
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
