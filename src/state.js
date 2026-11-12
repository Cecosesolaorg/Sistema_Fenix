// ─── PRODUCTOS DINÁMICOS ───────────────────────────────────────────
let PRODUCTOS = [];

const urlParams = new URLSearchParams(window.location.search);
const pasilloId = urlParams.get('id') || "PASILLO PASTA"; // Default a Pasillo 1 si no hay ID
const cleanPasilloName = pasilloId.replace(/^\d+-/, '').replace(/-/g, ' ');

if (window.ALL_PRODUCTS && window.ALL_PRODUCTS[pasilloId]) {
    const config = JSON.parse(localStorage.getItem('fenix_pasillos_config') || '{}') || {};
    const cfg = config[pasilloId] || {};

    let displayAisleName = cfg.name || cleanPasilloName;
    document.getElementById('top-pasillo-name').textContent = displayAisleName.toUpperCase();
    document.title = `Fénix — ${displayAisleName}`;

    if (typeof window.obtenerIconoPasillo === 'function') {
        const iconClass = window.obtenerIconoPasillo(pasilloId);
        const iconEl = document.querySelector('.topbar-title h1 i.fa-solid');
        if (iconEl) {
            iconEl.className = 'fa-solid ' + iconClass;
            iconEl.style.color = 'var(--yellow)';
            iconEl.style.marginRight = '6px';
        }
    }

    let baseProducts = window.ALL_PRODUCTS[pasilloId] || [];

    // LOGICA DE PARTES / PAGINACION
    const part = parseInt(urlParams.get('part')) || 1;
    let chunkSize = parseInt(urlParams.get('chunk'));
    if (!chunkSize || isNaN(chunkSize)) chunkSize = baseProducts.length;

    // Cambiar nombre si hay partes
    if (urlParams.has('part')) {
        displayAisleName += ` (PARTE ${part})`;
        document.getElementById('top-pasillo-name').textContent = displayAisleName.toUpperCase();
        document.title = `Fénix — ${displayAisleName}`;
    }

    // Convertir a objetos con índice original antes de hacer slice
    let pList = baseProducts.map((nombre, idx) => ({ nombre, index: idx }));

    if (urlParams.has('part')) {
        let startIdx = (part - 1) * chunkSize;
        pList = pList.slice(startIdx, startIdx + chunkSize);
    }

    PRODUCTOS = pList.map((item) => {
        let finalName = item.nombre || '';
        let originalIndex = item.index;
        if (cfg.renamedProducts && cfg.renamedProducts[originalIndex]) {
            finalName = cfg.renamedProducts[originalIndex];
        }
        return {
            code: `P-${pasilloId.substring(0, 2)}-${String(originalIndex + 1).padStart(3, '0')}`,
            name: String(finalName || '').trim().toUpperCase(),
            stockRef: 0,
            unidad: 'unidades',
            isExtra: false,
            idx: originalIndex
        };
    });

    if (cfg.extraProducts && Array.isArray(cfg.extraProducts)) {
        cfg.extraProducts.forEach((extraName, idx) => {
            if (extraName) {
                PRODUCTOS.push({
                    code: `P-${pasilloId.substring(0, 2)}-E${String(idx + 1).padStart(3, '0')}`,
                    name: String(extraName || '').trim().toUpperCase(),
                    stockRef: 0,
                    unidad: 'unidades',
                    isExtra: true,
                    idx: idx
                });
            }
        });
    }

    if (cfg.scannedProducts) {
        Object.keys(cfg.scannedProducts).forEach((scannedCode) => {
            const extraName = cfg.scannedProducts[scannedCode];
            if (extraName) {
                PRODUCTOS.push({
                    code: scannedCode,
                    name: String(extraName || '').trim().toUpperCase(),
                    stockRef: 0,
                    unidad: 'unidades',
                    isExtra: true
                });
            }
        });
    }
} else {
    // Fallback
    PRODUCTOS = [];
    alert("No se encontraron productos para este pasillo.");
}

// ─── ESTADO ────────────────────────────────────────────────────────────
let conteos = {};  // { code: cantidad }
const LS_KEY = `fenix_${pasilloId}_conteo`;

// Cargar conteos previos del localStorage
const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {};
PRODUCTOS.forEach(p => {
    conteos[p.code] = saved[p.code] !== undefined ? saved[p.code] : 0;
});

// Estado del checklist (0=normal, 1=verde, 2=rojo)
let checkStates = JSON.parse(localStorage.getItem(`fenix_${pasilloId}_check`) || '{}') || {};

// ─── OTRAS VARIABLES GLOBALES ─────────────────────────────────────────
let historiales = JSON.parse(localStorage.getItem(`fenix_${pasilloId}_historiales`) || '{}') || {};
let productoARenombrar = null;

let fallosConexion = 0;
let isFirstCheck = true;
let partnerSeleccionado = null;
let ayudaSeleccionada = localStorage.getItem('ayudante') ? { nombre: localStorage.getItem('ayudante'), cedula: 'SISTEMA' } : null;
const yo = JSON.parse(localStorage.getItem('currentUser') || '{}') || {};
