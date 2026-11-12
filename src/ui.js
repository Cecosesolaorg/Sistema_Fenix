// ─── RENDER ────────────────────────────────────────────────────────────

// ─── HELPER: Extraer UND CAJA BULT del nombre del producto ─────────────
function getUndCajaBult(productName) {
    const match = String(productName).match(/\*(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
}

const list = document.getElementById('products-list');

let compareMode = false;



window.toggleComparacion = function () {
    compareMode = !compareMode;
    const btn = document.getElementById('btn-comparacion');
    if (btn) {
        if (compareMode) {
            btn.style.background = 'rgba(255, 152, 0, 0.2)'; // Yellowish background for active
            btn.style.borderColor = 'var(--yellow)';
            btn.querySelector('i').style.color = 'var(--yellow)';
            mostrarToast('Modo Comparación activado');

            // Reiniciar el filtro alfabético a "Todos"
            currentAlphaFilter = 'ALL';
            if (typeof renderAlphaFilterButtons === 'function') renderAlphaFilterButtons();
        } else {
            btn.style.background = 'var(--card)';
            btn.style.borderColor = 'var(--border)';
            btn.querySelector('i').style.color = 'inherit';
            mostrarToast('Modo Comparación desactivado');
        }
    }
    renderProductos();
    if (typeof aplicarFiltros === 'function') aplicarFiltros();
};

function renderProductos() {
    list.innerHTML = '';

    // Si estamos en modo comparación, filtramos los que tengan algo que comparar
    let productosARenderizar = PRODUCTOS;
    if (compareMode) {
        productosARenderizar = PRODUCTOS.filter(p => (conteos[p.code] || 0) > 0 || (p.stockRef || 0) > 0 || (p.existencia || 0) > 0 || (p.stock || 0) > 0);
    }

    productosARenderizar.forEach(p => {
        let stateClass = '';
        if (checkStates[p.code] === 1) stateClass = ' checked';
        else if (checkStates[p.code] === 2) stateClass = ' diff';

        const safeId = p.code.replace(/\W/g, '_');

        const card = document.createElement('div');
        card.className = 'product-card' + stateClass;
        card.id = 'card-' + safeId;
        card.style.userSelect = 'none';

        if (compareMode) {
            // Un solo clic cambia de color, ignorando si se toca el contador o el lápiz
            card.onclick = function (e) {
                if (e.target.closest('.counter') || e.target.closest('.fa-pencil')) return;
                cycleCheckState(p.code);
            };
            card.ondblclick = null;
        } else {
            // Desactivado si no está en modo comparación
            card.onclick = null;
            card.ondblclick = null;
        }
        // Buscar la existencia/stock de donde sea que venga (stockRef, stock, existencia)
        const existencia = p.stockRef || p.existencia || p.stock || 0;

        let existenciaHtml = '';
        if (compareMode && existencia > 0) {
            // Mostrar la existencia a la izquierda del contador solo si es mayor a 0
            existenciaHtml = `<div style="display: flex; flex-direction: column; align-items: flex-end; justify-content: center; margin-right: 12px;">
                                <span style="font-size: 0.65rem; color: var(--muted); text-transform: uppercase;">Existencia</span>
                                <span style="font-weight: 800; font-size: 1.05rem; color: var(--yellow);">${existencia}</span>
                              </div>
                              <div style="width: 1px; height: 28px; background: var(--border); margin-right: 12px;"></div>`;
        }

        const extraIcons = p.isExtra ? `<div style="display:flex; gap: 4px;">
            <i class="fa-solid fa-pencil" style="font-size: 0.9rem; color: var(--yellow); cursor: pointer; padding: 4px; flex-shrink: 0;" onclick="renombrarProducto('${p.code}')" title="Renombrar producto"></i>
            <i class="fa-solid fa-trash" style="font-size: 0.9rem; color: var(--red); cursor: pointer; padding: 4px; flex-shrink: 0;" onclick="eliminarProductoExtra('${p.code}')" title="Eliminar producto"></i>
        </div>` : '';

        card.innerHTML = `
        <div class="prod-status-dot" style="display: ${compareMode ? 'flex' : 'none'};" onclick="cycleCheckState('${p.code}'); event.stopPropagation();"></div>
        <div class="prod-info">
            <div class="prod-name" style="display: flex; align-items: center; gap: 6px; justify-content: flex-start;">
                <span id="name-${safeId}" 
                      title="Toca para expandir el nombre completo" 
                      style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; display: block; width: 100%;"
                      onclick="this.style.whiteSpace = this.style.whiteSpace === 'normal' ? 'nowrap' : 'normal';">
                      ${p.name}
                </span>
                ${extraIcons}
            </div>
        </div>
        <div class="counter" style="display: flex; align-items: center;">
            ${existenciaHtml}
            <span class="counter-val" id="val-${safeId}"
                  title="Toca para abrir calculadora"
                  onclick="abrirCalculadora('${p.code}')"
            >${conteos[p.code] || 0}</span>
        </div>
    `;
        list.appendChild(card);
    });
    actualizarStats();
}

function cycleCheckState(code) {
    const current = checkStates[code] || 0;
    const next = (current + 1) % 3;
    checkStates[code] = next;

    localStorage.setItem(`fenix_${pasilloId}_check`, JSON.stringify(checkStates));

    const safeId = code.replace(/\W/g, '_');
    const cardEl = document.getElementById('card-' + safeId);
    if (cardEl) {
        cardEl.classList.remove('checked', 'diff');
        if (next === 1) cardEl.classList.add('checked');
        else if (next === 2) cardEl.classList.add('diff');
    }
}

// ─── CAMBIAR CONTEO ─────────────────────────────────────────────────────
function cambiarConteo(code, delta) {
    conteos[code] = Math.max(0, (conteos[code] || 0) + delta);
    const safeId = code.replace(/\W/g, '_');
    const valEl = document.getElementById('val-' + safeId);
    if (valEl) valEl.textContent = conteos[code];
    actualizarStats();
    // Auto-guardado silencioso
    localStorage.setItem(LS_KEY, JSON.stringify(conteos));
}

// ─── RENOMBRAR PRODUCTO ─────────────────────────────────────────────────
function renombrarProducto(code) {
    const prod = PRODUCTOS.find(p => p.code === code);
    if (!prod) return;

    productoARenombrar = prod;
    document.getElementById('rename-product-name').textContent = "Actual: " + prod.name;
    document.getElementById('input-nuevo-nombre').value = prod.name;

    const modal = document.getElementById('modal-renombrar');
    if (modal) {
        modal.style.display = 'flex';
        modal.offsetHeight;
        modal.classList.remove('hidden');
    }
    // focus
    setTimeout(() => document.getElementById('input-nuevo-nombre').focus(), 100);
}

function cerrarModalRenombrar() {
    const modal = document.getElementById('modal-renombrar');
    if (modal) {
        modal.classList.add('hidden');
        setTimeout(() => modal.style.display = 'none', 400);
    }
    productoARenombrar = null;
}

function confirmarRenombrar() {
    if (!productoARenombrar) return;
    const nuevoNombre = document.getElementById('input-nuevo-nombre').value;
    if (nuevoNombre && nuevoNombre.trim() !== "") {
        productoARenombrar.name = nuevoNombre.trim().toUpperCase();

        // Guardar configuración en localStorage
        const config = JSON.parse(localStorage.getItem('fenix_pasillos_config') || '{}') || {};
        if (!config[pasilloId]) config[pasilloId] = { enabled: true, extraProducts: [], renamedProducts: {} };
        if (productoARenombrar.isExtra) {
            config[pasilloId].extraProducts[productoARenombrar.idx] = productoARenombrar.name;
        } else {
            if (!config[pasilloId].renamedProducts) config[pasilloId].renamedProducts = {};
            config[pasilloId].renamedProducts[productoARenombrar.idx] = productoARenombrar.name;
        }
        localStorage.setItem('fenix_pasillos_config', JSON.stringify(config));

        const safeId = productoARenombrar.code.replace(/\W/g, '_');
        const nameEl = document.getElementById('name-' + safeId);
        if (nameEl) nameEl.textContent = productoARenombrar.name;
        mostrarToast('✅ Producto renombrado');
    }
    cerrarModalRenombrar();
}

// ─── STATS ─────────────────────────────────────────────────────────────
function actualizarStats() {
    const total = PRODUCTOS.length;
    const contados = PRODUCTOS.filter(p => conteos[p.code] > 0).length;
    const pendientes = total - contados;
    // Total unidades = suma directa de conteos (lo introducido en la calculadora)
    const totalUnid = PRODUCTOS.reduce((s, p) => {
        const cant = conteos[p.code] || 0;
        return s + cant;
    }, 0);

    const elContados = document.getElementById('stat-contados');
    if (elContados) elContados.textContent = contados;

    const elPendientes = document.getElementById('stat-pendientes');
    if (elPendientes) elPendientes.textContent = pendientes;

    const elTotalUnid = document.getElementById('stat-total-unid');
    if (elTotalUnid) elTotalUnid.textContent = totalUnid;

    const elProgText = document.getElementById('progress-text');
    if (elProgText) elProgText.textContent = `${contados} / ${total}`;

    const elProgFill = document.getElementById('progress-fill');
    if (elProgFill) elProgFill.style.width = `${Math.round((contados / total) * 100)}%`;

    const elSubtitle = document.getElementById('top-subtitle');
    if (elSubtitle) elSubtitle.textContent = contados === total ? '✅ Inventario completo' : `Inventario`;
}

// ─── BUSCAR Y FILTRAR ───────────────────────────────────────────────────
let currentAlphaFilter = 'ALL';

function renderAlphaFilterButtons() {
    const wrap = document.getElementById('alpha-filter');
    if (!wrap) return;
    wrap.innerHTML = '';

    // Obtener las letras de los productos que realmente existen en este pasillo
    const letrasExistentes = new Set();
    PRODUCTOS.forEach(p => {
        const nombre = (p.name || '').trim();
        if (nombre.length > 0) {
            const primeraLetra = nombre.charAt(0).toUpperCase();
            // Solo agregar si es una letra de la A a la Z
            if (primeraLetra >= 'A' && primeraLetra <= 'Z') {
                letrasExistentes.add(primeraLetra);
            }
        }
    });

    // Crear la lista de botones: 'ALL' siempre va primero, seguido de las letras que sí tienen productos ordenadas alfabéticamente
    const letters = ['ALL', ...Array.from(letrasExistentes).sort()];

    letters.forEach(l => {
        const btn = document.createElement('button');
        btn.className = `alpha-btn ${l === currentAlphaFilter ? 'active' : ''}`;
        btn.textContent = l === 'ALL' ? 'Todos' : l;
        btn.onclick = () => {
            document.querySelectorAll('.alpha-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentAlphaFilter = l;
            aplicarFiltros();
        };
        wrap.appendChild(btn);
    });
}

function aplicarFiltros() {
    const searchEl = document.getElementById('search-input');
    const q = searchEl ? searchEl.value.toLowerCase().trim() : '';

    PRODUCTOS.forEach(p => {
        const safeId = p.code.replace(/\W/g, '_');
        const card = document.getElementById('card-' + safeId);
        if (!card) return;

        let matchAlpha = true;
        if (currentAlphaFilter !== 'ALL') {
            matchAlpha = p.name.trim().toUpperCase().startsWith(currentAlphaFilter);
        }
        const matchSearch = q === '' || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);

        card.classList.toggle('hidden', !(matchSearch && matchAlpha));
    });

    // Mostrar empty state si todos ocultos
    const visible = [...document.querySelectorAll('.product-card:not(.hidden)')];
    let empty = document.getElementById('empty-state');
    if (visible.length === 0 && (q || currentAlphaFilter !== 'ALL')) {
        if (!empty) {
            empty = document.createElement('div');
            empty.id = 'empty-state';
            empty.className = 'empty-state';
            empty.innerHTML = `<i class="fa-solid fa-box-open"></i><p>No se encontraron productos</p>`;
            list.appendChild(empty);
        }
    } else if (empty) {
        empty.remove();
    }
}

if (document.getElementById('search-input')) {
    document.getElementById('search-input').addEventListener('input', aplicarFiltros);
}

if (document.getElementById('alpha-filter')) {
    renderAlphaFilterButtons();
}

// ─── DRAWER ─────────────────────────────────────────────────────────────
function abrirDrawer() {
    // Sincronizar stats del drawer
    const contados = PRODUCTOS.filter(p => conteos[p.code] > 0).length;
    const pendientes = PRODUCTOS.length - contados;
    // Total unidades = suma directa de conteos (lo introducido en la calculadora)
    const totalUnid = PRODUCTOS.reduce((s, p) => {
        const cant = conteos[p.code] || 0;
        return s + cant;
    }, 0);
    document.getElementById('d-contados').textContent = contados;
    document.getElementById('d-pendientes').textContent = pendientes;
    document.getElementById('d-unidades').textContent = totalUnid;
    const dTotal = document.getElementById('d-total');
    if (dTotal) dTotal.textContent = PRODUCTOS.length;

    const sesion = JSON.parse(localStorage.getItem('fenix_pasillo1_sesion') || '{}') || {};
    document.getElementById('d-yo').textContent = (sesion.yo?.nombre || yo.nombre || '—');
    // document.getElementById('d-partner').textContent = (sesion.partner?.nombre || partnerSeleccionado?.nombre || 'Sin compañero');

    const dAyuda = document.getElementById('d-ayuda');
    const btnEliminarAyuda = document.getElementById('btn-eliminar-ayuda');
    if (dAyuda) {
        dAyuda.textContent = ayudaSeleccionada ? ayudaSeleccionada.nombre : 'Sin ayuda';
    }
    if (btnEliminarAyuda) {
        btnEliminarAyuda.style.display = ayudaSeleccionada ? 'inline-block' : 'none';
    }

    document.getElementById('right-drawer').classList.add('open');
    document.getElementById('drawer-overlay').classList.add('open');
}

function cerrarDrawer() {
    document.getElementById('right-drawer').classList.remove('open');
    document.getElementById('drawer-overlay').classList.remove('open');
}

// ─── TOAST ─────────────────────────────────────────────────────────────
function mostrarToast(msg) {
    if (typeof cerrarDrawer === 'function') cerrarDrawer();
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}

// ─── AGREGAR PRODUCTO MANUAL ────────────────────────────────────────
function mostrarModalAgregar() {
    const label = document.getElementById('label-agregar-producto');
    if (label) {
        label.textContent = "Nombre del nuevo producto a agregar en este pasillo:";
    }

    const input = document.getElementById('input-nuevo-producto');
    if (input) input.value = '';

    const modal = document.getElementById('modal-agregar-producto');
    if (modal) {
        modal.style.display = 'flex';
        modal.offsetHeight;
        modal.classList.remove('hidden');
        setTimeout(() => input && input.focus(), 100);
    }
}

function cerrarModalAgregar() {
    const modal = document.getElementById('modal-agregar-producto');
    if (modal) {
        modal.classList.add('hidden');
        setTimeout(() => modal.style.display = 'none', 400);
    }
}

function confirmarAgregarProducto() {
    const input = document.getElementById('input-nuevo-producto');
    const nombre = input ? input.value : '';
    if (!nombre || !nombre.trim()) {
        if (input) {
            input.style.borderColor = '#ff4444';
            input.focus();
        }
        return;
    }
    if (input) input.style.borderColor = 'rgba(255,255,255,0.15)'; // reset

    cerrarModalAgregar();

    const config = JSON.parse(localStorage.getItem('fenix_pasillos_config') || '{}') || {};
    if (!config[pasilloId]) config[pasilloId] = { enabled: true, extraProducts: [], renamedProducts: {} };
    if (!config[pasilloId].extraProducts) config[pasilloId].extraProducts = [];

    const idx = config[pasilloId].extraProducts.length;
    let code = `P-${pasilloId.substring(0, 2)}-E${String(idx + 1).padStart(3, '0')}`;
    config[pasilloId].extraProducts.push(nombre.trim().toUpperCase());

    localStorage.setItem('fenix_pasillos_config', JSON.stringify(config));

    PRODUCTOS.push({ code: code, name: nombre.trim().toUpperCase(), stockRef: 0, unidad: 'unidades', isExtra: true, idx: idx });
    conteos[code] = 0;
    historiales[code] = '0';
    checkStates[code] = 0;

    // Anteriormente se enviaba a la lista de pendientes, ya no es necesario.

    renderProductos();
    mostrarToast('✅ Producto agregado temporalmente');

    // Scroll hacia el final
    setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
}

// ─── ELIMINAR PRODUCTO AGREGADO ────────────────────────────────────────
window.eliminarProductoExtra = function (code) {
    if (!confirm("¿Estás seguro de que deseas eliminar este producto agregado manualmente?")) return;

    const idx = PRODUCTOS.findIndex(p => p.code === code);
    if (idx !== -1) {
        let prod = PRODUCTOS[idx];
        PRODUCTOS.splice(idx, 1);

        const config = JSON.parse(localStorage.getItem('fenix_pasillos_config') || '{}') || {};
        if (config[pasilloId]) {
            if (prod.code.includes('-E')) {
                if (!config[pasilloId].extraProducts) config[pasilloId].extraProducts = [];
                config[pasilloId].extraProducts[prod.idx] = null;
            }
            localStorage.setItem('fenix_pasillos_config', JSON.stringify(config));
        }

        const safeId = code.replace(/\W/g, '_');
        const cardEl = document.getElementById('card-' + safeId);
        if (cardEl) {
            cardEl.remove();
        }

        delete conteos[code];
        delete historiales[code];
        delete checkStates[code];

        localStorage.setItem(LS_KEY, JSON.stringify(conteos));
        localStorage.setItem(`fenix_${pasilloId}_historiales`, JSON.stringify(historiales));
        localStorage.setItem(`fenix_${pasilloId}_check`, JSON.stringify(checkStates));

        actualizarStats();
        mostrarToast('❌ Producto devuelto al vacío');
    }
};

// ─── PUENTE CALCULADORA PREMIUM ────────────────────────────────────────
window.abrirCalculadora = function (code) {
    const prod = PRODUCTOS.find(p => p.code === code);
    if (!prod) return;

    const currentQty = conteos[code] || 0;
    const currentHist = historiales[code] || "0";

    // Define la función para guardar que llama la calculadora internamente
    window.saveCalculation = function () {
        if (!window.CalcApp) return;
        const totalCalculadora = Number(window.CalcApp.tempTotal) || 0;
        const qtyPrevia = Number(conteos[code]) || 0;
        const delta = totalCalculadora - qtyPrevia;

        cambiarConteo(code, delta);
        historiales[code] = window.CalcApp.tempHistory;
        localStorage.setItem(`fenix_${pasilloId}_historiales`, JSON.stringify(historiales));
    };

    if (window.CalcApp) {
        window.CalcApp.open(prod.name, currentQty, currentHist);
    } else {
        console.error("Calculadora premium no cargó.");
    }
};

// ─── EVITAR SALIDA ACCIDENTAL ───────────────────────────────────────────
window.addEventListener('beforeunload', function (e) {
    if (!window.permitirSalida) {
        e.preventDefault();
        e.returnValue = '¿Estás seguro de salir de este pasillo?';
    }
});
