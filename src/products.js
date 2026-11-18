// ─── DATOS DE PRODUCTOS ──────────────────────────────────────────────
// Los datos viven en src/products.json y los inyecta el servidor al
// servir este archivo (JSON serializado: nunca se interpreta como código).
// No editar products.json a mano con comillas: usar el panel.
window.ALL_PRODUCTS = /*__PRODUCTS_JSON__*/{};

// ─── ICONOS CONSISTENTES PARA PASILLOS ─────────────────────────────────
// El icono se elige por palabra clave. Se mira el nombre visible y, si no
// hay coincidencia, la clave técnica del pasillo. Así los pasillos creados
// desde el panel (clave CUSTOM-...) también reciben un icono propio.
window.obtenerIconoPasillo = function (key, nombre) {
    const k = ((nombre || '') + ' ' + (key || ''))
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // ── Rubros del mercado ────────────────────────────────────────────
    if (k.includes('pasta')) return 'fa-bowl-rice';
    if (k.includes('cafe')) return 'fa-mug-hot';
    if (k.includes('panaderia') || /\bpan(es)?\b/.test(k)) return 'fa-bread-slice';
    if (k.includes('galleta')) return 'fa-cookie';
    if (k.includes('salsa') || k.includes('condiment')) return 'fa-bottle-droplet';
    if (k.includes('jabon') || k.includes('limpieza') || k.includes('detergente')) return 'fa-pump-soap';
    if (k.includes('papel') && !k.includes('arriba')) return 'fa-toilet-paper';
    if (k.includes('grano') || k.includes('cereal') || k.includes('arroz')) return 'fa-seedling';
    if (k.includes('cava') || k.includes('frio') || k.includes('congelad')) return 'fa-snowflake';
    if (k.includes('perfum') || k.includes('cosmetic') || k.includes('belleza') || k.includes('higiene')) return 'fa-spray-can-sparkles';
    if (k.includes('lacteo') || k.includes('leche') || k.includes('queso') || k.includes('yogur')) return 'fa-cheese';
    if (k.includes('huevo')) return 'fa-egg';
    if (k.includes('carnic') || k.includes('carne') || k.includes('pollo') || k.includes('charcuter')) return 'fa-drumstick-bite';
    if (k.includes('pescad') || k.includes('pescado') || k.includes('marisco') || k.includes('atun')) return 'fa-fish';
    if (k.includes('fruter') || k.includes('fruta') || k.includes('verdul') || k.includes('hortaliza') || k.includes('verdura') || k.includes('vegetal')) return 'fa-apple-whole';
    if (k.includes('zanahoria')) return 'fa-carrot';
    if (k.includes('licor') || k.includes('bebida') || /\bvinos?\b/.test(k) || k.includes('cerveza')) return 'fa-wine-bottle';
    if (/\bagua\b/.test(k) || k.includes('jugo') || k.includes('refresco')) return 'fa-bottle-water';
    if (k.includes('dulce') || k.includes('chocolate') || k.includes('caramelo') || k.includes('golosina')) return 'fa-cookie-bite';
    if (k.includes('torta') || k.includes('pastel') || k.includes('reposter')) return 'fa-cake-candles';
    if (k.includes('bebe') || k.includes('panal')) return 'fa-baby';
    if (k.includes('mascota') || k.includes('animal')) return 'fa-paw';
    if (k.includes('ferreteria') || k.includes('herramienta')) return 'fa-screwdriver-wrench';
    if (k.includes('medicina') || k.includes('farmacia') || k.includes('medicament')) return 'fa-capsules';
    if (k.includes('bombillo') || k.includes('electric') || k.includes('iluminacion')) return 'fa-lightbulb';
    if (k.includes('ropa') || k.includes('textil') || k.includes('calzado')) return 'fa-shirt';
    if (k.includes('cigarr') || k.includes('tabaco')) return 'fa-smoking';
    if (k.includes('juguete')) return 'fa-puzzle-piece';

    // ── Zonas del depósito ────────────────────────────────────────────
    if (k.includes('deposito') || k.includes('almacen')) {
        if (k.includes('arriba')) return 'fa-stairs';
        if (k.includes('abajo')) return 'fa-warehouse';
        return 'fa-boxes-stacked';
    }
    if (k.includes('pared')) return 'fa-table-cells-large';          // Estante de pared
    if (k.includes('arriba')) return 'fa-arrow-up-from-bracket';     // Zona alta
    if (k.includes('caja')) return 'fa-box-open';                    // Productos de caja
    if (k.includes('viveres')) return 'fa-box';

    // ── Genéricos ─────────────────────────────────────────────────────
    if (k.includes('tienda') || k.includes('feria')) return 'fa-store';
    if (k.includes('carrito') || k.includes('compra')) return 'fa-cart-shopping';

    // Fallback genérico para otros pasillos
    return 'fa-layer-group';
};
