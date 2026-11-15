// ─── SINCRONIZACIÓN DE PRODUCTOS AGREGADOS ──────────────────────────────────
// Los productos que agrega cualquier persona del pasillo se guardan en el
// servidor. Este script revisa cada pocos segundos y los incorpora en la lista,
// sin recargar la página ni perder los conteos ya cargados.

(function () {
    'use strict';

    if (typeof pasilloId === 'undefined' || typeof PRODUCTOS === 'undefined') return;

    const INTERVALO_MS = 5000;
    let sincronizando = false;

    function avisar(mensaje) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = mensaje;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
    }

    function leerConfig() {
        try {
            return JSON.parse(localStorage.getItem('fenix_pasillos_config') || '{}') || {};
        } catch (e) {
            return {};
        }
    }

    function guardarConfig(config) {
        localStorage.setItem('fenix_pasillos_config', JSON.stringify(config));
    }

    function indiceDeExtra(code) {
        const match = /-E(\d+)$/.exec(code);
        return match ? parseInt(match[1], 10) - 1 : -1;
    }

    function aplicarExtras(extras) {
        let cambios = false;

        // 1. Agregar o actualizar los que están en el servidor.
        extras.forEach((nombre, index) => {
            if (!nombre) return;
            const code = window.codigoExtraPasillo(pasilloId, index);
            const existente = PRODUCTOS.find(p => p.code === code);
            const nombreFinal = String(nombre).trim().toUpperCase();

            if (!existente) {
                PRODUCTOS.push({
                    code: code,
                    name: nombreFinal,
                    stockRef: 0,
                    unidad: 'unidades',
                    isExtra: true,
                    idx: index
                });
                if (conteos[code] === undefined) conteos[code] = 0;
                if (historiales[code] === undefined) historiales[code] = '0';
                if (checkStates[code] === undefined) checkStates[code] = 0;
                cambios = true;
            } else if (existente.name !== nombreFinal) {
                existente.name = nombreFinal;
                cambios = true;
            }
        });

        // 2. Quitar solo los que el servidor marcó como eliminados (null).
        //    Los índices que el servidor todavía no conoce se conservan: pueden
        //    ser productos agregados sin conexión.
        for (let i = PRODUCTOS.length - 1; i >= 0; i--) {
            const producto = PRODUCTOS[i];
            if (!producto.isExtra) continue;
            const index = indiceDeExtra(producto.code);
            if (index < 0) continue;
            if (extras[index] === null) {
                PRODUCTOS.splice(i, 1);
                delete conteos[producto.code];
                delete historiales[producto.code];
                delete checkStates[producto.code];
                cambios = true;
            }
        }

        return cambios;
    }

    async function sincronizar() {
        if (sincronizando || document.hidden) return;
        sincronizando = true;

        try {
            const respuesta = await fetch('/api/pasillos-config?t=' + Date.now(), { cache: 'no-store' });
            if (!respuesta.ok) return;

            const configGlobal = await respuesta.json();
            const cfg = configGlobal && configGlobal[pasilloId];
            if (!cfg || !Array.isArray(cfg.extraProducts)) return;

            // Se conservan los extras locales que el servidor aún no tiene
            // (por ejemplo, si se agregaron sin conexión).
            const config = leerConfig();
            if (!config[pasilloId]) config[pasilloId] = { enabled: true, extraProducts: [] };
            const locales = Array.isArray(config[pasilloId].extraProducts) ? config[pasilloId].extraProducts : [];
            const fusion = cfg.extraProducts.slice();
            for (let i = fusion.length; i < locales.length; i++) {
                if (locales[i] !== undefined) fusion[i] = locales[i];
            }

            const cambio = aplicarExtras(fusion);

            config[pasilloId].extraProducts = fusion;
            if (cfg.enabled !== undefined) config[pasilloId].enabled = cfg.enabled;
            if (cfg.name && !config[pasilloId].name) config[pasilloId].name = cfg.name;
            guardarConfig(config);

            if (cambio) {
                renderProductos();
                if (typeof aplicarFiltros === 'function') aplicarFiltros();
                avisar('🔄 Producto actualizado por otro dispositivo');
            }
        } catch (e) {
            // Sin red: se reintenta en el próximo ciclo.
        } finally {
            sincronizando = false;
        }
    }

    setInterval(sincronizar, INTERVALO_MS);

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) sincronizar();
    });

    setTimeout(sincronizar, 1200);
})();
