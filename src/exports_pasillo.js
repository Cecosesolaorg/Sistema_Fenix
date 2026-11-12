// ─── EXPORTAR EXCEL / DESCARGAR / REPORTAR ─────────────────────────────
async function exportarExcel() {
    const codigo = prompt("Ingrese el código de seguridad para descargar el inventario:");
    if (codigo !== "j085030140") {
        if (codigo !== null) mostrarToast('❌ Código incorrecto');
        return;
    }

    if (!window.ExportApp) { mostrarToast('⚠️ Exportador no disponible'); return; }

    const productosConExistencia = PRODUCTOS.filter(p => (conteos[p.code] || 0) > 0);
    const todosVerdes = productosConExistencia.every(p => checkStates[p.code] === 1);
    if (!todosVerdes) {
        mostrarToast('❌ Los productos con existencia deben estar en verde (doble clic)');
        return;
    }

    const btn = document.getElementById('btn-descargar-pasillo1');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';

    // Obtener info de sesión y preguntar por compañero al descargar manualmente
    const sesion = JSON.parse(localStorage.getItem('fenix_pasillo1_sesion') || '{}');
    const resp = sesion.yo?.nombre || yo.nombre || 'Inventarista';
    let partnerNamePrompt = prompt("¿Con quién realizaste el inventario? (Deja en blanco si lo hiciste solo)");
    const comp = (partnerNamePrompt && partnerNamePrompt.trim() !== '') ? partnerNamePrompt.trim().toUpperCase() : 'SIN COMPAÑERO';

    // Helper: extraer UND CAJA BULT del nombre
    const getUnd = (name) => { const m = String(name).match(/\*(\d+)/); return m ? parseInt(m[1], 10) : 1; };

    // Construir products[] e inventoryData{} en el formato que ExportApp espera
    const getDisplayName = (p) => p.isExtra ? `${p.name} (NEW)` : p.name;
    const products = PRODUCTOS.map(p => getDisplayName(p));
    const inventoryData = {};
    PRODUCTOS.forEach(p => {
        const qty = conteos[p.code] || 0;
        const und = getUnd(p.name);
        inventoryData[getDisplayName(p)] = {
            qty: qty,
            und: und,
            totalUnd: qty, // Se omite multiplicacion, total unidades = cantidad puesta
            history: historiales[p.code] || String(qty),
            checkState: checkStates[p.code] === 1 ? 1 : 0
        };
    });

    try {
        await ExportApp.downloadAisle(
            cleanPasilloName.toUpperCase(),
            resp,
            comp,
            products,
            inventoryData,
            { skipDownload: false }
        );
        mostrarToast('✅ Excel generado correctamente');
    } catch (e) {
        mostrarToast('❌ Error al generar Excel: ' + e.message);
        console.error(e);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-download excel-icon" style="font-size: 1.2rem;"></i> Descargar';
    }
}

async function enviarReporte() {
    const productosConExistencia = PRODUCTOS.filter(p => (conteos[p.code] || 0) > 0);
    const todosVerdes = productosConExistencia.every(p => checkStates[p.code] === 1);
    if (!todosVerdes) {
        mostrarToast('❌ Los productos con existencia deben estar en verde (doble clic)');
        return;
    }

    if (!window.ExportApp) { mostrarToast('⚠️ Exportador no disponible'); return; }

    const input = document.getElementById('input-companero-envio');
    if (input) input.value = '';

    const modal = document.getElementById('modal-confirmar-envio');
    if (modal) {
        modal.style.display = 'flex';
        modal.offsetHeight;
        modal.classList.remove('hidden');
        setTimeout(() => input && input.focus(), 100);
    }
}

function cerrarModalConfirmarEnvio() {
    const modal = document.getElementById('modal-confirmar-envio');
    if (modal) {
        modal.classList.add('hidden');
        setTimeout(() => modal.style.display = 'none', 400);
    }
}

async function confirmarYEnviarReporte() {
    const input = document.getElementById('input-companero-envio');
    const confirmName = (input && input.value) ? input.value : '';
    const comp = (confirmName.trim() !== '') ? confirmName.trim().toUpperCase() : 'SIN COMPAÑERO';

    cerrarModalConfirmarEnvio();

    const sesion = JSON.parse(localStorage.getItem('fenix_pasillo1_sesion') || '{}');
    const resp = sesion.yo?.nombre || yo.nombre || 'Inventarista';

    const btn = document.getElementById('btn-enviar-sistema');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando Excel...';

    try {
        const getUnd2 = (name) => { const m = String(name).match(/\*(\d+)/); return m ? parseInt(m[1], 10) : 1; };
        const getDisplayName = (p) => p.isExtra ? `${p.name} (NEW)` : p.name;
        const products = PRODUCTOS.map(p => getDisplayName(p));
        const inventoryData = {};
        PRODUCTOS.forEach(p => {
            const qty = conteos[p.code] || 0;
            const und = getUnd2(p.name);
            inventoryData[getDisplayName(p)] = {
                qty: qty,
                und: und,
                totalUnd: qty, // Se omite multiplicacion, total unidades = cantidad puesta
                history: historiales[p.code] || String(qty),
                checkState: checkStates[p.code] === 1 ? 1 : 0
            };
        });

        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';

        // Generar el .xlsx reutilizando ExportApp (evita duplicar la lógica de merge)
        const result = await ExportApp.downloadAisle(
            cleanPasilloName.toUpperCase(),
            resp,
            comp,
            products,
            inventoryData,
            { skipDownload: true, returnBuffer: true }
        );

        if (!result || !result.buffer) throw new Error('No se pudo generar el archivo Excel');

        // Formatear el nombre del archivo: [Area] [Usuario principal] - [Ayudante].xlsx
        const finalFileName = `${cleanPasilloName.toUpperCase()} ${resp.toUpperCase()} - ${comp}.xlsx`;

        // Enviar el archivo como FormData
        const formData = new FormData();
        formData.append('file', new Blob([result.buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }), finalFileName);
        formData.append('aisleName', cleanPasilloName.toUpperCase());
        formData.append('responsable', resp);
        formData.append('companero', comp);
        formData.append('ayudante', comp);

        const response = await fetch('/api/enviar-reporte-xlsx', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Error en el servidor: ' + response.status);

        mostrarToast('✅ Reporte .xlsx enviado al Sistema');
        document.getElementById('drawer-overlay').classList.remove('open');
        document.getElementById('right-drawer').classList.remove('open');
    } catch (error) {
        console.error(error);
        mostrarToast('❌ Error: ' + (error?.message || String(error)));
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane excel-icon" style="font-size: 1.2rem;"></i> Enviar al Sistema';
    }
}


function guardarConteo() {
    const usuario = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const registro = {
        aisleName: cleanPasilloName,
        usuario: usuario.nombre || 'Desconocido',
        cedula: usuario.cedula || '—',
        fecha: new Date().toISOString(),
        conteos: conteos,
    };

    localStorage.setItem(LS_KEY, JSON.stringify(conteos));

    // Intentar enviar al servidor
    fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...registro, tipo: 'conteo_pasillo' })
    }).catch(() => {/* offline — ya está en localStorage */ });

    mostrarToast('✅ Conteo guardado correctamente');
}

function mostrarModalLimpiarConteo() {
    // Cerrar the drawer first to focus on the modal
    if (typeof cerrarDrawer === 'function') cerrarDrawer();

    const modal = document.getElementById('modal-limpiar-conteo');
    if (modal) {
        modal.style.display = 'flex';
        modal.offsetHeight;
        modal.classList.remove('hidden');
    }
}

function cerrarModalLimpiarConteo() {
    const modal = document.getElementById('modal-limpiar-conteo');
    if (modal) {
        modal.classList.add('hidden');
        setTimeout(() => modal.style.display = 'none', 400);
    }
}

function confirmarLimpiarConteo() {
    cerrarModalLimpiarConteo();
    PRODUCTOS.forEach(p => {
        conteos[p.code] = 0;
        historiales[p.code] = '0';
        checkStates[p.code] = 0; // Reset checkState

        const safeId = p.code.replace(/\W/g, '_');
        const cardEl = document.getElementById('card-' + safeId);
        const valEl = document.getElementById('val-' + safeId);
        if (valEl) valEl.textContent = '0';
        if (cardEl) {
            cardEl.classList.remove('contado', 'checked', 'diff');
        }
    });
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(`fenix_${pasilloId}_check`);
    localStorage.removeItem(`fenix_${pasilloId}_historiales`);
    actualizarStats();
    mostrarToast('✅ Conteos y checklist limpiados');
}
