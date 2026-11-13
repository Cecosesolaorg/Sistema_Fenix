'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Crear o actualizar un administrador del Sistema Fénix
//
// Uso:
//   node tools/crear-admin.js
//   node tools/crear-admin.js --cedula 12345678 --nombre "Ana Perez" --clave "Secreta1"
//   node tools/crear-admin.js --listar
//
// - Escribe en registros/ con el mismo formato que el servidor.
// - Si la cédula ya existe, actualiza la clave y el rol sin duplicarla.
// - No requiere dependencias ni permisos de administrador.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const auth = require('../src/auth');

const CEDULA_RE = /^[0-9A-Za-z_-]{1,40}$/;
const NOMBRE_RE = /^[\p{L}\p{N} .,'_\-]{1,80}$/u;
const ROLES = ['user', 'coordinador', 'admin'];
const STATE_FILES = new Set([
    'historial.json', 'cierres.json', 'pendientes.json',
    'pasillos_config.json', 'qrcodes.json', 'session_control.json',
    'settings.json', 'feedback.json'
]);

function leerArgumentos(argv) {
    const opciones = { rol: 'admin' };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const siguiente = () => {
            const valor = argv[++i];
            if (valor === undefined) throw new Error(`Falta el valor de ${arg}`);
            return valor;
        };
        switch (arg) {
            case '--cedula': opciones.cedula = siguiente(); break;
            case '--nombre': opciones.nombre = siguiente(); break;
            case '--clave': opciones.clave = siguiente(); break;
            case '--rol': opciones.rol = siguiente(); break;
            case '--dir': opciones.dir = siguiente(); break;
            case '--listar': opciones.listar = true; break;
            case '--ayuda':
            case '-h':
            case '--help': opciones.ayuda = true; break;
            default: throw new Error(`Opción desconocida: ${arg}`);
        }
    }
    return opciones;
}

function ayuda() {
    console.log('');
    console.log('  Crear o actualizar un administrador del Sistema Fenix');
    console.log('');
    console.log('  Uso:');
    console.log('    node tools/crear-admin.js');
    console.log('    node tools/crear-admin.js --cedula 12345678 --nombre "Ana Perez" --clave "Secreta1"');
    console.log('    node tools/crear-admin.js --listar');
    console.log('');
    console.log('  Opciones:');
    console.log('    --cedula  Cédula del administrador');
    console.log('    --nombre  Nombre visible');
    console.log('    --clave   Contraseña (mínimo 4 caracteres)');
    console.log('    --rol     admin (por defecto), coordinador o user');
    console.log('    --listar  Muestra los usuarios registrados y sale');
    console.log('');
}

function preguntar(texto) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(texto, (respuesta) => {
            rl.close();
            resolve(respuesta.trim());
        });
    });
}

/** Lee la contraseña sin mostrarla. Si no hay terminal, lee una línea normal. */
function preguntarOculto(texto) {
    return new Promise((resolve) => {
        const stdin = process.stdin;
        if (!stdin.isTTY) {
            const rl = readline.createInterface({ input: stdin, output: process.stdout });
            rl.once('line', (linea) => {
                rl.close();
                resolve(linea.trim());
            });
            return;
        }

        process.stdout.write(texto);
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');
        let valor = '';

        const limpiar = () => {
            stdin.removeListener('data', alEscribir);
            try { stdin.setRawMode(false); } catch (e) { }
            stdin.pause();
        };

        function alEscribir(textoTecla) {
            for (const tecla of textoTecla) {
                if (tecla === '\r' || tecla === '\n' || tecla === '\u0004') {
                    limpiar();
                    process.stdout.write('\n');
                    resolve(valor);
                    return;
                }
                if (tecla === '\u0003') {
                    limpiar();
                    process.stdout.write('\n');
                    process.exit(1);
                }
                if (tecla === '\u007f' || tecla === '\b') {
                    if (valor) {
                        valor = valor.slice(0, -1);
                        process.stdout.write('\b \b');
                    }
                    continue;
                }
                if (tecla >= ' ') {
                    valor += tecla;
                    process.stdout.write('*');
                }
            }
        }

        stdin.on('data', alEscribir);
    });
}

function listarUsuarios(dir) {
    const usuarios = [];
    if (fs.existsSync(dir)) {
        for (const archivo of fs.readdirSync(dir)) {
            if (!archivo.endsWith('.json') || STATE_FILES.has(archivo)) continue;
            try {
                const datos = JSON.parse(fs.readFileSync(path.join(dir, archivo), 'utf8'));
                if (datos && typeof datos === 'object' && datos.cedula) {
                    usuarios.push({ archivo, ...datos });
                }
            } catch (e) { /* archivo corrupto: se ignora */ }
        }
    }

    console.log('');
    console.log(`  Carpeta: ${dir}`);
    console.log('');
    if (usuarios.length === 0) {
        console.log('  No hay usuarios registrados en esta carpeta.');
        console.log('  Crea un administrador con: node tools/crear-admin.js');
        console.log('');
        return;
    }

    for (const u of usuarios) {
        const guardada = String(u.password_hash || u.password || '');
        const tipo = guardada.startsWith('scrypt$') ? 'hash' : (guardada ? 'texto plano' : 'sin clave');
        console.log(`  ${String(u.cedula).padEnd(14)} ${String(u.rol || u.role || 'user').padEnd(12)} ${tipo.padEnd(12)} ${u.nombre || ''}`);
    }
    console.log('');
}

function nombreArchivoSeguro(nombre) {
    return (nombre.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 60)) || 'Usuario';
}

function marcaDeTiempo() {
    const ahora = new Date();
    return ahora.getFullYear().toString() +
        String(ahora.getMonth() + 1).padStart(2, '0') +
        String(ahora.getDate()).padStart(2, '0') + '_' +
        String(ahora.getHours()).padStart(2, '0') +
        String(ahora.getMinutes()).padStart(2, '0') +
        String(ahora.getSeconds()).padStart(2, '0');
}

function buscarUsuarioPorCedula(dir, cedula) {
    if (!fs.existsSync(dir)) return null;
    for (const archivo of fs.readdirSync(dir)) {
        if (!archivo.endsWith('.json') || STATE_FILES.has(archivo)) continue;
        try {
            const datos = JSON.parse(fs.readFileSync(path.join(dir, archivo), 'utf8'));
            if (datos && String(datos.cedula) === String(cedula)) {
                return { archivo, datos };
            }
        } catch (e) { /* archivo corrupto: se ignora */ }
    }
    return null;
}

async function principal() {
    let opciones;
    try {
        opciones = leerArgumentos(process.argv.slice(2));
    } catch (e) {
        console.error('');
        console.error(`  ERROR: ${e.message}`);
        ayuda();
        process.exit(1);
    }

    const dir = opciones.dir
        ? path.resolve(opciones.dir)
        : path.join(__dirname, '..', 'registros');

    if (opciones.ayuda) {
        ayuda();
        return;
    }
    if (opciones.listar) {
        listarUsuarios(dir);
        return;
    }

    console.log('');
    console.log('  Crear administrador del Sistema Fenix');
    console.log('');

    let cedula = opciones.cedula ? String(opciones.cedula).trim() : '';
    let nombre = opciones.nombre ? String(opciones.nombre).trim() : '';
    let clave = opciones.clave ? String(opciones.clave) : '';
    let rol = String(opciones.rol || 'admin').trim().toLowerCase();

    if (!cedula) cedula = await preguntar('  Cédula: ');
    if (!nombre) nombre = await preguntar('  Nombre completo: ');
    if (!clave) {
        clave = await preguntarOculto('  Contraseña (no se muestra): ');
        const repetida = await preguntarOculto('  Repetir contraseña: ');
        if (clave !== repetida) {
            console.error('');
            console.error('  ERROR: las contraseñas no coinciden.');
            process.exit(1);
        }
    }

    if (!CEDULA_RE.test(cedula)) {
        console.error('');
        console.error('  ERROR: cédula inválida (solo letras, números, - y _, hasta 40).');
        process.exit(1);
    }
    if (!NOMBRE_RE.test(nombre)) {
        console.error('');
        console.error("  ERROR: nombre inválido (letras, números, espacios y . , ' - _).");
        process.exit(1);
    }
    if (clave.length < 4 || clave.length > 200) {
        console.error('');
        console.error('  ERROR: la contraseña debe tener entre 4 y 200 caracteres.');
        process.exit(1);
    }
    if (!ROLES.includes(rol)) {
        console.error('');
        console.error(`  ERROR: rol inválido. Usa: ${ROLES.join(', ')}.`);
        process.exit(1);
    }

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        try { fs.chmodSync(dir, 0o700); } catch (e) { }
    }

    const existente = buscarUsuarioPorCedula(dir, cedula);
    const claveHasheada = auth.hashPassword(clave);

    if (existente) {
        const datos = existente.datos;
        datos.nombre = nombre || datos.nombre;
        datos.password_hash = claveHasheada;
        datos.rol = rol || datos.rol || datos.role || 'admin';
        delete datos.password;
        const destino = path.join(dir, existente.archivo);
        fs.writeFileSync(destino, JSON.stringify(datos, null, 4), 'utf8');
        try { fs.chmodSync(destino, 0o600); } catch (e) { }
        console.log('');
        console.log('  Usuario actualizado:');
        console.log(`    Cédula: ${cedula}`);
        console.log(`    Nombre: ${datos.nombre}`);
        console.log(`    Rol:    ${datos.rol}`);
        console.log(`    Archivo: ${existente.archivo}`);
        console.log('');
        return;
    }

    const registro = {
        cedula,
        nombre,
        password_hash: claveHasheada,
        fecha: new Date().toISOString(),
        role: rol
    };
    const archivo = `${nombreArchivoSeguro(nombre)}_${cedula}_${marcaDeTiempo()}.json`;
    const destino = path.join(dir, archivo);
    fs.writeFileSync(destino, JSON.stringify(registro, null, 4), 'utf8');
    try { fs.chmodSync(destino, 0o600); } catch (e) { }

    console.log('');
    console.log('  Usuario creado:');
    console.log(`    Cédula: ${cedula}`);
    console.log(`    Nombre: ${nombre}`);
    console.log(`    Rol:    ${rol}`);
    console.log(`    Archivo: ${archivo}`);
    console.log('');
}

principal().catch((e) => {
    console.error('');
    console.error(`  ERROR: ${e.message}`);
    console.error('');
    process.exit(1);
});