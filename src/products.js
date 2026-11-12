// ─── DATOS DE PRODUCTOS ──────────────────────────────────────────────
// Los datos viven en src/products.json y los inyecta el servidor al
// servir este archivo (JSON serializado: nunca se interpreta como código).
// No editar products.json a mano con comillas: usar el panel.
window.ALL_PRODUCTS = /*__PRODUCTS_JSON__*/{};

// ─── ICONOS CONSISTENTES PARA PASILLOS ─────────────────────────────────
window.obtenerIconoPasillo = function (key) {
    const k = (key || "").toLowerCase();
    if (k.includes("pasta")) return "fa-bowl-rice";
    if (k.includes("cafe") || k.includes("café")) return "fa-mug-hot";
    if (k.includes("panes")) return "fa-bread-slice";
    if (k.includes("galleta") || k.includes("galletas")) return "fa-cookie";
    if (k.includes("salsa")) return "fa-bottle-droplet";
    if (k.includes("jabon") || k.includes("jabón") || k.includes("limpieza")) return "fa-pump-soap";
    if (k.includes("papel") && !k.includes("arriba")) return "fa-toilet-paper";
    if (k.includes("grano") || k.includes("granos")) return "fa-seedling";
    if (k.includes("cava") || k.includes("frio")) return "fa-snowflake";
    if (k.includes("deposito") || k.includes("depósito") || k.includes("almacen")) {
        if (k.includes("arriba")) return "fa-stairs";
        if (k.includes("abajo")) return "fa-warehouse";
        return "fa-boxes-stacked";
    }
    // ── Nuevas zonas ──────────────────────────────────────────────────
    if (k.includes("pared")) return "fa-table-cells-large";          // Estante de pared
    if (k.includes("parte de arriba") || k.startsWith("arriba")) return "fa-arrow-up-from-bracket"; // Zona alta
    if (k.includes("caja")) return "fa-box-open";                    // Productos de caja
    // ─────────────────────────────────────────────────────────────────
    if (k.includes("viveres") || k.includes("víveres")) return "fa-box";
    if (k.includes("carne") || k.includes("pollo")) return "fa-drumstick-bite";
    if (k.includes("hortaliza") || k.includes("fruta")) return "fa-apple-whole";
    if (k.includes("licor") || k.includes("bebida")) return "fa-wine-bottle";

    // Fallback genérico para otros pasillos
    return "fa-layer-group";
};
