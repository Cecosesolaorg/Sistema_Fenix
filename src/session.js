// ─── AYUDAS DE ESCAPE ───────────────────────────────────────────────────
// ─── VERIFICAR CIERRE EN SERVIDOR Y CONEXIÓN ────────────────────────────
// Sincronizar avatares en segundo plano
fetch('/api/avatars')
    .then(r => r.json())
    .then(avatars => {
        if (avatars && typeof avatars === 'object') {
            for (const cedula in avatars) {
                const foto = avatarSeguro(avatars[cedula]);
                if (foto) localStorage.setItem('fotoPerfil_' + cedula, foto);
                else localStorage.removeItem('fotoPerfil_' + cedula);
            }
        }
    })
    .catch(e => console.log('No se pudo sincronizar avatares'));

async function verificarCierreServidor() {
    try {
        // Un timeout rápido de 4 segundos para detectar si se cayeron de la red
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const response = await fetch(`/api/cierre-status?id=${encodeURIComponent(pasilloId)}&t=${Date.now()}`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) return;

        fallosConexion = 0; // Conexión exitosa, resetear contador

        const data = await response.json();
        if (data.lastClosed) {
            const lastClosedTime = new Date(data.lastClosed).getTime();
            const lastLocalClear = parseFloat(localStorage.getItem(`fenix_${pasilloId}_last_clear_check`) || '0');

            // Si la fecha de cierre en servidor es más reciente que nuestro último reinicio local
            if (lastClosedTime > lastLocalClear) {
                console.log("¡Reinicio del inventario programado por el Administrador!");

                // Poner conteos a 0
                PRODUCTOS.forEach(p => {
                    conteos[p.code] = 0;
                    checkStates[p.code] = 0;
                    historiales[p.code] = '0';
                });

                localStorage.setItem(LS_KEY, JSON.stringify(conteos));
                localStorage.setItem(`fenix_${pasilloId}_historiales`, JSON.stringify(historiales));
                localStorage.setItem(`fenix_${pasilloId}_check`, JSON.stringify(checkStates));
                localStorage.setItem(`fenix_${pasilloId}_last_clear_check`, String(lastClosedTime));

                renderProductos();

                if (!isFirstCheck) {
                    alert('🔒 El Administrador ha cerrado este inventario. Tu sesión ha sido cerrada por seguridad.');
                    localStorage.removeItem('currentUser');
                    window.location.href = 'index.html';
                } else {
                    mostrarToast('🔒 Administrador cerró inventario. Conteos iniciados en 0.');
                }
            }
        }
    } catch (e) {
        // Si el escáner está abierto, ignorar fallos (el navegador puede bloquear
        // requests mientras pide permiso de cámara al usuario)

        console.warn("Posible pérdida de conexión detectada:", e);
        fallosConexion++;
        // Si falla 6 veces seguidas (aprox 30 segundos), bloqueamos la pantalla
        if (fallosConexion >= 6) {
            document.body.innerHTML = `
                <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:#e74c3c;color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:999999;padding:20px;text-align:center;font-family:system-ui,sans-serif;">
                    <i class="fa-solid fa-wifi" style="font-size:5rem;margin-bottom:20px;opacity:0.8;"></i>
                    <h1 style="font-size:2.2rem;margin-bottom:10px;">Sin Conexión</h1>
                    <p style="font-size:1.1rem;margin-bottom:30px;line-height:1.5;">Te has desconectado de la red WiFi del inventario o perdiste la señal.<br>Por seguridad, la aplicación se ha bloqueado.</p>
                    <button onclick="window.location.reload()" style="background:white;color:#e74c3c;border:none;padding:15px 30px;border-radius:30px;font-size:1.1rem;font-weight:bold;cursor:pointer;box-shadow:0 4px 15px rgba(0,0,0,0.2);">Reconectar</button>
                </div>
            `;
        }
    }
    isFirstCheck = false;
}

verificarCierreServidor();
setInterval(verificarCierreServidor, 5000); // Revisar cada 5 segundos

// ─── PARTNER SELECTION LOGIC ─────────────────────────────────────────

// Mostrar usuario actual
const meNameEl = document.getElementById('me-name');
const meAvatarEl = document.getElementById('me-avatar');
if (meNameEl) meNameEl.textContent = yo.nombre || 'Usuario';
if (meAvatarEl) meAvatarEl.textContent = (yo.nombre || 'U').charAt(0).toUpperCase();

// ─── AVATAR DEL TOPBAR ───
(function () {
    const foto = localStorage.getItem('fotoPerfil_' + yo.cedula);
    const avatarDiv = document.getElementById('topbar-avatar');
    const inicialEl = document.getElementById('topbar-avatar-inicial');
    if (!avatarDiv) return;
    if (foto) {
        inicialEl.style.display = 'none';
        const img = document.createElement('img');
        img.src = foto;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        avatarDiv.appendChild(img);
    } else {
        inicialEl.textContent = (yo.nombre || '?').charAt(0).toUpperCase();
    }
})();

// Cargar lista de usuarios registrados
function cargarPartnersDisponibles() {
    const listEl = document.getElementById('partner-list');
    let usuarios = [];

    // Intentar desde servidor, fallback a localStorage
    fetch('/api/users')
        .then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then(data => { usuarios = data; mostrarPartners(usuarios, listEl); })
        .catch(() => {
            usuarios = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
            mostrarPartners(usuarios, listEl);
        });
}

function mostrarPartners(usuarios, listEl) {
    const dynamicList = document.getElementById('partner-list-dynamic');
    if (!dynamicList) return;

    // Filtrar al usuario actual
    const otros = usuarios.filter(u => u.cedula !== yo.cedula);

    if (otros.length === 0) {
        dynamicList.innerHTML = `<div style="color:var(--muted);font-size:0.85rem;padding:14px;text-align:center;">
        <i class="fa-solid fa-user-slash" style="display:block;font-size:1.5rem;margin-bottom:8px;"></i>
        No hay otros usuarios registrados
    </div>`;
        return;
    }

    dynamicList.innerHTML = '<div style="margin-top: 15px; margin-bottom: 10px; padding-left: 4px;"><span style="color: var(--yellow); font-size: 0.8rem; font-weight: 800; letter-spacing: 1px;">OTROS COMPAÑEROS</span></div>';

    otros.forEach(u => {
        const foto = avatarSeguro(localStorage.getItem('fotoPerfil_' + u.cedula));
        const inicial = (u.nombre || 'U').charAt(0).toUpperCase();
        const avatarHTML = foto
            ? `<img src="${esc(foto)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid var(--green);flex-shrink:0;">`
            : `<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--green),#9575cd);display:flex;align-items:center;justify-content:center;font-weight:800;color:white;font-size:0.95rem;flex-shrink:0;">${esc(inicial)}</div>`;

        const item = document.createElement('div');
        item.className = 'partner-item';
        item.style.justifyContent = 'space-between';
        item.style.borderRadius = '8px';
        item.style.marginBottom = '8px';
        item.style.gap = '12px';
        item.innerHTML = `
        ${avatarHTML}
        <div class="p-name" style="font-weight: 800; text-transform: uppercase; font-size: 0.85rem; flex:1;">${esc(u.nombre || 'Sin nombre')}</div>
        <div style="background: #00bcd4; width: 24px; height: 24px; border-radius: 4px; display: flex; justify-content: center; align-items: center; color: white;"><i class="fa-solid fa-arrow-right" style="font-size: 0.8rem;"></i></div>
    `;
        item.addEventListener('click', () => {
            ayudaSeleccionada = u;
            localStorage.setItem('ayudante', u.nombre);
            cerrarAyuda();
            mostrarToast('✅ Ayuda de ' + u.nombre + ' asignada');

            const subEl = document.getElementById('top-subtitle');
            const partnerName = partnerSeleccionado ? partnerSeleccionado.nombre : 'Solo';
            subEl.innerHTML = `<i class="fa-solid fa-users" style="margin-right:4px;color:var(--yellow);"></i> ${esc(yo.nombre || 'Tú')} &amp; ${esc(partnerName)} (+ Ayuda: ${esc(u.nombre)})`;
        });
        dynamicList.appendChild(item);
    });
}

function iniciarInventario() {
    const overlay = document.getElementById('partner-overlay');
    overlay.classList.add('hidden');
    setTimeout(() => overlay.style.display = 'none', 400);

    // Actualizar subtitulo del topbar
    const subEl = document.getElementById('top-subtitle');
    if (partnerSeleccionado) {
        subEl.innerHTML = `
        <i class="fa-solid fa-users" style="margin-right:4px;color:var(--yellow);"></i>
        ${esc(yo.nombre || 'Tú')} &amp; ${esc(partnerSeleccionado.nombre)}
    `;
    } else {
        subEl.textContent = `Inventario`;
    }
    actualizarStats();
}

function iniciarSolo() {
    partnerSeleccionado = null;
    iniciarInventario();
}

// Ya no se requiere cargar usuarios disponibles
// cargarPartnersDisponibles();

// ─── BOTONES ACCIONES EXTRA Y MODALES ─────────────────────────────────────
function mostrarAyuda() {
    const overlay = document.getElementById('partner-overlay');
    overlay.style.display = 'flex';
    // force reflow
    overlay.offsetHeight;
    overlay.classList.remove('hidden');
}

function cerrarAyuda() {
    const overlay = document.getElementById('partner-overlay');
    overlay.classList.add('hidden');
    setTimeout(() => overlay.style.display = 'none', 400);
}

function mostrarConfirmarSalir() {
    const modal = document.getElementById('modal-salir');
    modal.style.display = 'flex';
    // force reflow
    modal.offsetHeight;
    modal.classList.remove('hidden');
}

function cerrarModalSalir() {
    const modal = document.getElementById('modal-salir');
    modal.classList.add('hidden');
    setTimeout(() => modal.style.display = 'none', 400);
}

function seleccionarSistema(nombre) {
    ayudaSeleccionada = { nombre: nombre, cedula: 'SISTEMA' };
    localStorage.setItem('ayudante', nombre);
    cerrarAyuda();
    mostrarToast('✅ Ayuda de ' + nombre + ' asignada');
}

function confirmarCompaneroManual() {
    const input = document.getElementById('input-companero-nombre');
    const nombre = (input.value || '').trim();
    if (nombre !== '') {
        seleccionarSistema(nombre);
        input.value = '';
    } else {
        input.style.borderColor = '#ff4444';
        input.focus();
    }
}

function eliminarAyuda() {
    ayudaSeleccionada = null;
    localStorage.removeItem('ayudante');
    mostrarToast('❌ Ayuda eliminada');
}
