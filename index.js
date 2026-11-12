// ─── CACHÉ DE USUARIOS (solo con sesión iniciada) ───
// Se guardan nombre/cédula/rol para el selector de compañeros sin conexión.
// Nunca se guardan contraseñas.
function sincronizarUsuariosCache() {
    fetch('/api/users', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(serverUsers => {
            if (!Array.isArray(serverUsers)) return;
            const limpios = serverUsers.map(u => ({
                cedula: u.cedula,
                nombre: u.nombre,
                role: u.role || 'user'
            }));
            localStorage.setItem('registeredUsers', JSON.stringify(limpios));
        })
        .catch(() => { });
}

// ─── SINCRONIZAR AVATARES DEL SERVIDOR ───
(function () {
    if (localStorage.getItem('currentUser')) sincronizarUsuariosCache();

    fetch('/api/avatars')
        .then(r => r.json())
        .then(avatars => {
            if (avatars && typeof avatars === 'object') {
                for (const cedula in avatars) {
                    localStorage.setItem('fotoPerfil_' + cedula, avatars[cedula]);
                }
                // Actualizar UI si la función existe
                if (typeof actualizarAvatarUI === 'function') {
                    actualizarAvatarUI();
                }
            }
        })
        .catch(e => console.log('Trabajando de forma local, no se pudo conectar al servidor para sincronizar avatares.'));
})();

// ─── SESIÓN LOCAL: espejo de la cookie HttpOnly del servidor ───
// El servidor es la autoridad; esto es solo caché para la interfaz.
function guardarSesionLocal(user, loginTime) {
    const actual = {
        cedula: user.cedula,
        nombre: user.nombre,
        role: user.role || 'user',
        login_time: loginTime || Date.now()
    };
    localStorage.setItem('currentUser', JSON.stringify(actual));

    // Caché de nombres para el modo sin conexión. Nunca se guardan contraseñas.
    let usuarios = [];
    try { usuarios = JSON.parse(localStorage.getItem('registeredUsers') || '[]'); } catch (e) { usuarios = []; }
    if (!Array.isArray(usuarios)) usuarios = [];

    const existente = usuarios.find(u => u && u.cedula === actual.cedula);
    if (existente) {
        existente.nombre = actual.nombre;
        existente.role = actual.role;
        delete existente.password;
    } else {
        usuarios.push({ cedula: actual.cedula, nombre: actual.nombre, role: actual.role });
    }
    localStorage.setItem('registeredUsers', JSON.stringify(usuarios));

    // Refrescar la lista real de compañeros (ya hay cookie de sesión).
    if (typeof sincronizarUsuariosCache === 'function') sincronizarUsuariosCache();

    return actual;
}

function mostrarPantallaPasillos(user) {
    document.getElementById('register-screen').style.display = 'none';
    document.getElementById('selection-screen').style.display = 'flex';
    document.getElementById('welcome-message').textContent = 'BIENVENIDO, ' + user.nombre.toUpperCase();

    if (user.role === 'admin' || user.role === 'coordinador') {
        document.getElementById('btn-ir-sistema-interno').style.display = 'inline-flex';
    }
    setTimeout(function () {
        if (typeof renderizarPasillosInicio === 'function') renderizarPasillosInicio();
    }, 100);
}

// ─── AUTO-LOGIN: valida la cookie contra el servidor ───
(function () {
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem('currentUser') || 'null'); } catch (e) { cached = null; }
    if (!cached || !cached.nombre) return;

    fetch('/api/me', { cache: 'no-store' })
        .then(response => {
            if (response.status === 401) {
                localStorage.removeItem('currentUser');
                return null;
            }
            if (!response.ok) throw new Error('sin servidor');
            return response.json();
        })
        .then(data => {
            if (!data || !data.user) return;
            const user = guardarSesionLocal(data.user, cached.login_time);
            mostrarPantallaPasillos(user);
        })
        .catch(() => {
            // Sin red pero con sesión cacheada: no cortamos el trabajo en curso.
            mostrarPantallaPasillos(cached);
        });
})();

function cerrarSesion() {
    // Registrar cierre de sesión en el historial
    try {
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (user.nombre) {
            fetch('/api/historial', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usuario: user.nombre, accion: 'Cerró sesión' })
            }).catch(() => { });
        }
    } catch (e) { }

    // Destruir la sesión del servidor. keepalive para que llegue antes de navegar.
    try {
        fetch('/api/logout', { method: 'POST', keepalive: true }).catch(() => { });
    } catch (e) { }

    localStorage.removeItem('currentUser');

    // En lugar de recargar la página (que puede causar bucles o pantallas en blanco),
    // redirigimos explícitamente a la pantalla inicial (index.html) o limpiamos la UI
    window.location.href = 'index.html';
}

function verificarAccesoAdmin(e) {
    e.preventDefault();
    // Redirigir al panel de sistema donde se pide la clave de administrador
    window.location.href = 'sistema.html';
}

function transitionToPasillos() {
    const regScreen = document.getElementById('register-screen');
    const selScreen = document.getElementById('selection-screen');

    regScreen.style.opacity = '0';
    regScreen.style.transform = 'scale(0.98)';
    regScreen.style.transition = 'opacity 0.5s ease, transform 0.5s ease';

    setTimeout(() => {
        regScreen.style.display = 'none';
        selScreen.style.display = 'flex';
        selScreen.style.opacity = '0';
        selScreen.style.transform = 'scale(1.02)';

        // Trigger reflow
        selScreen.offsetHeight;

        selScreen.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        selScreen.style.opacity = '1';
        selScreen.style.transform = 'scale(1)';

        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (user.role === 'admin' || user.role === 'coordinador') {
            document.getElementById('btn-ir-sistema-interno').style.display = 'inline-flex';
        }
    }, 500);
}

let isLoginMode = true;

document.getElementById('toggle-mode').addEventListener('click', function (e) {
    e.preventDefault();
    isLoginMode = !isLoginMode;

    const groupNombre = document.getElementById('group-nombre');
    const inputNombre = document.getElementById('reg-nombre');
    const title = document.getElementById('auth-title');
    const btnSubmitText = document.getElementById('btn-submit-text');
    const toggleMode = document.getElementById('toggle-mode');

    if (isLoginMode) {
        groupNombre.style.display = 'none';
        inputNombre.removeAttribute('required');
        title.textContent = 'Iniciar Sesión';
        btnSubmitText.textContent = 'Iniciar Sesión';
        toggleMode.textContent = '¿No tienes cuenta? Regístrate aquí';
    } else {
        groupNombre.style.display = 'block';
        inputNombre.setAttribute('required', 'required');
        title.textContent = 'Registro';
        btnSubmitText.textContent = 'Registrar e Ingresar';
        toggleMode.textContent = '¿Ya tienes cuenta? Iniciar Sesión';
    }
});

document.getElementById('auth-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const cedula = document.getElementById('reg-cedula').value;
    const password = document.getElementById('reg-password').value;

    if (!isLoginMode) {
        // Modo Registro: el servidor crea el usuario con rol 'user' y abre la sesión.
        const nombre = document.getElementById('reg-nombre').value.trim();
        if (!nombre) { alert('Ingresá tu nombre.'); return; }

        fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cedula, nombre, password })
        })
            .then(async (response) => {
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    alert(data.message || 'No se pudo completar el registro.');
                    return;
                }
                guardarSesionLocal(data.user);
                document.getElementById('welcome-message').textContent = 'BIENVENIDO, ' + data.user.nombre.toUpperCase();
                fetch('/api/historial', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usuario: data.user.nombre, accion: 'Se registró en el sistema' })
                }).catch(() => { });
                transitionToPasillos();
            })
            .catch(() => alert('No se pudo conectar con el servidor. Verificá la red WiFi.'));

    } else {
        // Modo Iniciar Sesión: la contraseña la valida el servidor, no el navegador.
        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cedula, password })
        })
            .then(async (response) => {
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    alert(data.message || 'Cédula o contraseña incorrecta.');
                    return;
                }
                guardarSesionLocal(data.user);
                document.getElementById('welcome-message').textContent = 'BIENVENIDO, ' + data.user.nombre.toUpperCase();
                fetch('/api/historial', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usuario: data.user.nombre, accion: 'Inició sesión' })
                }).catch(() => { });
                transitionToPasillos();
            })
            .catch(() => alert('No se pudo conectar con el servidor. Verificá la red WiFi.'));
    }
});

// ─── PERFIL: FOTO Y NOMBRE ────────────────────────────────────────
let fotoPerfilTemporal = null; // base64 temporal mientras no se guarda

function actualizarAvatarUI() {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const foto = localStorage.getItem('fotoPerfil_' + user.cedula);
    const nombre = user.nombre || '';
    const inicial = nombre.charAt(0).toUpperCase() || '?';

    // Avatar pequeño en la pantalla de pasillos
    const circle = document.getElementById('sel-avatar-circle');
    const inicialEl = document.getElementById('sel-avatar-inicial');
    const nombreEl = document.getElementById('sel-avatar-nombre');

    if (nombreEl) nombreEl.textContent = nombre || 'Mi Perfil';

    if (foto && circle) {
        // Mostrar foto
        inicialEl.style.display = 'none';
        let img = circle.querySelector('img.av-foto');
        if (!img) {
            img = document.createElement('img');
            img.className = 'av-foto';
            img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
            circle.insertBefore(img, circle.firstChild);
        }
        img.src = foto;
    } else if (inicialEl) {
        inicialEl.style.display = '';
        inicialEl.textContent = inicial;
        const oldImg = circle && circle.querySelector('img.av-foto');
        if (oldImg) oldImg.remove();
    }
}

function abrirModalPerfil() {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const foto = localStorage.getItem('fotoPerfil_' + user.cedula);

    // Rellenar modal con datos actuales
    document.getElementById('perfil-input-nombre').value = user.nombre || '';
    document.getElementById('perfil-cedula-label').textContent = 'Cédula: ' + (user.cedula || '—');

    const placeholder = document.getElementById('perfil-placeholder');
    const img = document.getElementById('perfil-img');

    if (foto) {
        placeholder.style.display = 'none';
        img.src = foto;
        img.style.display = 'block';
    } else {
        placeholder.style.display = 'flex';
        placeholder.textContent = (user.nombre || '?').charAt(0).toUpperCase();
        img.style.display = 'none';
    }

    fotoPerfilTemporal = null;
    // Mostrar el modal usando display flex directamente
    const overlay = document.getElementById('perfil-overlay');
    overlay.classList.add('open');
    overlay.style.display = 'flex';
}

function cerrarModalPerfil() {
    const overlay = document.getElementById('perfil-overlay');
    overlay.classList.remove('open');
    overlay.style.display = 'none';
    fotoPerfilTemporal = null;
}

function procesarFoto(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        // Comprimir la imagen a max 400x400
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement('canvas');
            const MAX = 400;
            let w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h = h * MAX / w; w = MAX; } }
            else { if (h > MAX) { w = w * MAX / h; h = MAX; } }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            fotoPerfilTemporal = canvas.toDataURL('image/jpeg', 0.82);

            // Mostrar preview en el modal
            document.getElementById('perfil-placeholder').style.display = 'none';
            const previewImg = document.getElementById('perfil-img');
            previewImg.src = fotoPerfilTemporal;
            previewImg.style.display = 'block';
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function guardarPerfil() {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const nuevoNombre = document.getElementById('perfil-input-nombre').value.trim();

    if (!nuevoNombre) {
        document.getElementById('perfil-input-nombre').style.borderColor = '#e53935';
        document.getElementById('perfil-input-nombre').focus();
        return;
    }

    // Guardar foto si cambió
    if (fotoPerfilTemporal) {
        localStorage.setItem('fotoPerfil_' + user.cedula, fotoPerfilTemporal);
        // Sincronizar con el servidor
        fetch('/api/upload-avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cedula: user.cedula, fotoBase64: fotoPerfilTemporal })
        }).catch(e => console.log("Error al subir foto al servidor: ", e));
    }

    // Actualizar nombre en currentUser
    user.nombre = nuevoNombre;
    localStorage.setItem('currentUser', JSON.stringify(user));

    // Actualizar nombre también en registeredUsers
    let regUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
    const idx = regUsers.findIndex(u => u.cedula === user.cedula);
    if (idx !== -1) {
        regUsers[idx].nombre = nuevoNombre;
        localStorage.setItem('registeredUsers', JSON.stringify(regUsers));
    }

    // Actualizar UI
    actualizarAvatarUI();
    document.getElementById('welcome-message').textContent = 'BIENVENIDO, ' + nuevoNombre.toUpperCase();
    cerrarModalPerfil();

    // Toast visual
    const toast = document.createElement('div');
    toast.textContent = '✅ Perfil actualizado';
    toast.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#673ab7;color:white;padding:12px 24px;border-radius:50px;font-weight:700;font-size:0.9rem;z-index:9999;box-shadow:0 4px 20px rgba(103,58,183,0.4);';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

// Cerrar modal al hacer click fuera
document.getElementById('perfil-overlay').addEventListener('click', function (e) {
    if (e.target === this) cerrarModalPerfil();
});

// Inicializar avatar Y pasillos cuando se muestra la pantalla de pasillos
const _origTransition = transitionToPasillos;
transitionToPasillos = function () {
    _origTransition();
    setTimeout(() => {
        actualizarAvatarUI();
        const baseUrl = window.location.protocol === 'file:' ? 'http://localhost:8000' : '';
        fetch(baseUrl + '/api/pasillos-config?t=' + Date.now())
            .then(res => res.json())
            .then(configGlobal => {
                if (configGlobal && Object.keys(configGlobal).length > 0) {
                    const configLocal = JSON.parse(localStorage.getItem('fenix_pasillos_config') || '{}');
                    const configFusionada = { ...configLocal, ...configGlobal };
                    localStorage.setItem('fenix_pasillos_config', JSON.stringify(configFusionada));
                }
            })
            .catch(e => console.log('Usando config de pasillos local'))
            .finally(() => {
                renderizarPasillosInicio();
            });
    }, 600);
};

// Si ya hay sesión activa, actualizar avatar de inmediato
(function () {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) actualizarAvatarUI();
})();

// Renderizar pasillos dinámicamente respetando configuración del admin
function renderizarPasillosInicio() {
    const grid = document.getElementById('pasillos-grid-container');
    if (!grid || !window.ALL_PRODUCTS) return;

    grid.innerHTML = '';

    const config = JSON.parse(localStorage.getItem('fenix_pasillos_config') || '{}');

    // Claves que se deben combinar en una sola tarjeta (grupos)
    // Formato: { tarjetaKey: [key1, key2, ...] }
    const GRUPOS_COMBINADOS = {
        'GRUPO-GALLETAS': {
            label: 'PASILLO GALLETAS',
            icon: 'fa-cookie',
            keys: ['04-PASILLO-GALLETAS 1', '05-PASILLO-GALLETAS 2']
        },
        'GRUPO-SALSA': {
            label: 'PASILLO SALSA',
            icon: 'fa-bottle-droplet',
            keys: ['PASILLO 5 SALSA 1', 'PASILLO 5 SALSA 2']
        },
        'GRUPO-JABON': {
            label: 'PASILLO JABÓN',
            icon: 'fa-pump-soap',
            keys: ['PASILLO 6 JABON 1', 'PASILLO 6 JABON 2']
        },
        'GRUPO-DEPOSITO-ABAJO': {
            label: 'DEPÓSITO ABAJO',
            icon: 'fa-warehouse',
            keys: ['18-DEPOSITO-PARTE-DE-VIVERES-1', '18-DEPOSITO-PARTE-DEL-JABON-2']
        }
    };

    // Construir set de claves que están en algún grupo
    const clavesEnGrupo = new Set();
    for (const g of Object.values(GRUPOS_COMBINADOS)) {
        g.keys.forEach(k => clavesEnGrupo.add(k));
    }

    // Rastrear qué grupos ya se renderizaron
    const gruposRenderizados = new Set();

    for (const key in window.ALL_PRODUCTS) {
        const cfg = config[key] || {};
        if (cfg.enabled === false) continue;

        // ¿Esta clave pertenece a un grupo combinado?
        let grupoId = null;
        for (const [gid, g] of Object.entries(GRUPOS_COMBINADOS)) {
            if (g.keys.includes(key)) { grupoId = gid; break; }
        }

        if (grupoId) {
            // Renderizar el grupo solo la primera vez
            if (gruposRenderizados.has(grupoId)) continue;
            gruposRenderizados.add(grupoId);

            const grupo = GRUPOS_COMBINADOS[grupoId];
            const a = document.createElement('a');
            a.className = 'pasillo-btn';
            a.href = '#';
            a.innerHTML = `
                <i class="fa-solid ${grupo.icon} pasillo-icon"></i>
                <span class="pasillo-name">${grupo.label}</span>
            `;
            a.onclick = function (e) {
                e.preventDefault();
                mostrarModalSubPasillos(grupo);
            };
            grid.appendChild(a);
            continue;
        }

        // Pasillo normal — siempre va directo, sin modal de partes
        const defaultName = key.replace(/^\d+-/, '').replace(/-/g, ' ').toUpperCase();
        const displayName = cfg.name || defaultName;
        const icon = (typeof window.obtenerIconoPasillo === 'function') ? window.obtenerIconoPasillo(key) : 'fa-layer-group';

        const a = document.createElement('a');
        a.className = 'pasillo-btn';
        a.href = `pasillo.html?id=${encodeURIComponent(key)}`;
        a.innerHTML = `
            <i class="fa-solid ${icon} pasillo-icon"></i>
            <span class="pasillo-name">${displayName}</span>
        `;

        grid.appendChild(a);
    }
}

// Modal para elegir sub-pasillo dentro de un grupo
function mostrarModalSubPasillos(grupo) {
    let modal = document.getElementById('sub-pasillos-modal-overlay');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'sub-pasillos-modal-overlay';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);backdrop-filter:blur(5px);z-index:2000;display:flex;align-items:center;justify-content:center;';
        modal.innerHTML = `
            <div style="padding:24px 20px;width:340px;max-width:90%;background:#1a1a1a;border-radius:20px;box-shadow:0 10px 40px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.1);">
                <h2 style="color:var(--yellow);text-transform:uppercase;font-size:1.2rem;margin-bottom:4px;" id="sub-modal-title"></h2>
                <p style="color:#aaa;font-size:0.9rem;margin-bottom:20px;">Elige el pasillo que deseas contar</p>
                <div id="sub-modal-list" style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;"></div>
                <button onclick="document.getElementById('sub-pasillos-modal-overlay').style.display='none'" style="width:100%;padding:14px;border-radius:12px;background:#444;color:#fff;border:none;font-weight:800;cursor:pointer;" onmouseover="this.style.background='#555'" onmouseout="this.style.background='#444'">CANCELAR</button>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('sub-modal-title').innerHTML = `<i class="fa-solid ${grupo.icon}"></i> ${grupo.label}`;
    const list = document.getElementById('sub-modal-list');
    list.innerHTML = '';

    grupo.keys.forEach((key, idx) => {
        if (!window.ALL_PRODUCTS[key]) return;
        const label = key.replace(/^\d+-/, '').replace(/-/g, ' ').toUpperCase();
        const btn = document.createElement('button');
        btn.style.cssText = 'background:rgba(255,165,0,0.1);border:1px solid rgba(255,165,0,0.3);color:#fff;padding:16px;border-radius:12px;font-weight:800;text-align:left;display:flex;justify-content:space-between;align-items:center;cursor:pointer;transition:all 0.2s;width:100%;';
        btn.innerHTML = `<span>${label}</span><span style="color:#aaa;font-size:0.8rem;font-weight:normal;">${window.ALL_PRODUCTS[key].length} productos</span>`;
        btn.onmouseover = () => { btn.style.background = 'rgba(255,165,0,0.2)'; btn.style.transform = 'scale(1.02)'; };
        btn.onmouseout = () => { btn.style.background = 'rgba(255,165,0,0.1)'; btn.style.transform = 'scale(1)'; };
        btn.onclick = () => {
            document.getElementById('sub-pasillos-modal-overlay').style.display = 'none';
            window.location.href = `pasillo.html?id=${encodeURIComponent(key)}`;
        };
        list.appendChild(btn);
    });

    modal.style.display = 'flex';
}

function mostrarModalPartes(key, name, icon, totalItems, chunkSize) {
    let modal = document.getElementById('parts-modal-overlay');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'parts-modal-overlay';
        modal.className = 'partner-overlay'; // Reusar clase de index.html
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);backdrop-filter:blur(5px);z-index:2000;display:flex;align-items:center;justify-content:center;';
        modal.innerHTML = `
            <div class="pasillos-card" style="padding: 24px 20px; width: 340px; max-width: 90%; background: #1a1a1a; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);">
                <h2 style="color: var(--yellow); text-transform: uppercase; font-size: 1.2rem; margin-bottom: 4px;" id="parts-modal-title"></h2>
                <p style="color: #aaa; font-size: 0.9rem; margin-bottom: 20px;">Elige la parte que deseas contar</p>
                <div id="parts-modal-list" style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px; max-height: 250px; overflow-y:auto; padding-right:4px;"></div>
                <button onclick="document.getElementById('parts-modal-overlay').style.display='none'" style="width:100%; padding:14px; border-radius:12px; background:#444; color:#fff; border:none; font-weight:800; cursor:pointer;" onmouseover="this.style.background='#555'" onmouseout="this.style.background='#444'">CANCELAR</button>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('parts-modal-title').innerHTML = `<i class="fa-solid ${icon}"></i> ${name}`;
    const list = document.getElementById('parts-modal-list');
    list.innerHTML = '';

    const numPartes = Math.ceil(totalItems / chunkSize);
    for (let p = 1; p <= numPartes; p++) {
        const start = (p - 1) * chunkSize + 1;
        const end = Math.min(p * chunkSize, totalItems);
        const btn = document.createElement('button');
        btn.style.cssText = "background: rgba(255,165,0,0.1); border: 1px solid rgba(255,165,0,0.3); color: #fff; padding: 16px; border-radius: 12px; font-weight: 800; text-align: left; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s;";
        btn.innerHTML = `<span style="color:#fff;">Parte ${p}</span> <span style="color:#aaa; font-size:0.8rem; font-weight:normal;">(${start} al ${end})</span>`;
        btn.onmouseover = () => { btn.style.background = "rgba(255,165,0,0.2)"; btn.style.transform = "scale(1.02)"; };
        btn.onmouseout = () => { btn.style.background = "rgba(255,165,0,0.1)"; btn.style.transform = "scale(1)"; };
        btn.onclick = () => {
            document.getElementById('parts-modal-overlay').style.display = 'none';
            window.location.href = `pasillo.html?id=${encodeURIComponent(key)}&part=${p}&chunk=${chunkSize}`;
        };
        list.appendChild(btn);
    }

    modal.style.display = 'flex';
}

// Llamar directamente (el DOM ya está listo cuando este script ejecuta)
// También registrar en DOMContentLoaded por si acaso
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderizarPasillosInicio);
} else {
    renderizarPasillosInicio();
}

// Exponer globalmente para re-renderizar tras el login
window.renderizarPasillosInicio = renderizarPasillosInicio;

// ─── VERIFICADOR RÁPIDO DE CONEXIÓN WIFI ──────────────────────────────
let fallosConexionInicio = 0;
async function verificarConexionRapida() {
    if (window.location.protocol === 'file:') return;
    try {
        // Timeout rápido de 4 segundos
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        // Hacemos ping a la página principal para ver si el servidor responde
        const response = await fetch('/?ping=' + Date.now(), {
            signal: controller.signal,
            cache: 'no-store'
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            fallosConexionInicio = 0; // Conectado, reseteamos
        }
    } catch (error) {
        // Posible desconexión
        fallosConexionInicio++;
        if (fallosConexionInicio >= 3) {
            document.body.innerHTML = `
                        <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:#e74c3c;color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:999999;padding:20px;text-align:center;font-family:system-ui,sans-serif;">
                            <i class="fa-solid fa-wifi" style="font-size:5rem;margin-bottom:20px;opacity:0.8;"></i>
                            <h1 style="font-size:2.2rem;margin-bottom:10px;">Sin Conexión</h1>
                            <p style="font-size:1.1rem;margin-bottom:30px;line-height:1.5;">Te has desconectado de la red WiFi del inventario o perdiste la señal.</p>
                            <button onclick="window.location.reload()" style="background:white;color:#e74c3c;border:none;padding:15px 30px;border-radius:30px;font-size:1.1rem;font-weight:bold;cursor:pointer;box-shadow:0 4px 15px rgba(0,0,0,0.2);">Reconectar</button>
                        </div>
                    `;
        }
    }
}
setInterval(verificarConexionRapida, 5000); // Chequeo cada 5 segundos

// ─── VERIFICADOR DE SESIÓN (PATEOS) ───────────────────────────────────
setInterval(() => {
    if (window.location.protocol === 'file:') return;
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) return;

    try {
        const user = JSON.parse(userStr);
        const loginTime = user.login_time || 0;

        fetch('/api/session-status', { cache: 'no-store' })
            .then(res => res.json())
            .then(status => {
                const globalTime = status.global_logout || 0;
                const kickTime = (status.kicked_users || {})[user.cedula] || 0;

                if (globalTime > loginTime || kickTime > loginTime) {
                    alert('Tu sesión ha sido cerrada remotamente por un administrador.');
                    cerrarSesion();
                }
            })
            .catch(() => { });
    } catch (e) { }
}, 35000);