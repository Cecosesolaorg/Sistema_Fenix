let cachedReportes = [];

async function cargarReportes() {
    const tbody = document.querySelector('#reportes-table tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando reportes...</td></tr>';
    try {
        const response = await fetch('/api/listar-reportes');
        const reportes = await response.json();
        cachedReportes = reportes;

        // Actualizar KPIs del Dashboard
        actualizarKpisDashboard();

        // Actualizar filtro de pasillos
        const filterSelect = document.getElementById('filter-reportes-pasillo');
        const uniquePasillos = [...new Set(reportes.map(r => r.aisleName || r.pasillo).filter(Boolean))].sort();

        let currentVal = filterSelect.value;
        filterSelect.innerHTML = '<option value="">Todas las categorías</option>';
        uniquePasillos.forEach(p => {
            const option = document.createElement('option');
            option.value = p;
            option.textContent = p;
            filterSelect.appendChild(option);
        });
        if (uniquePasillos.includes(currentVal)) {
            filterSelect.value = currentVal;
        }

        renderizarReportes();
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #ff5252;">Error al conectar con el servidor</td></tr>';
    }
}

let seleccionadosParaComparar = [];

function renderizarReportes() {
    const container = document.getElementById('reportes-folders-container');
    container.innerHTML = '';
    seleccionadosParaComparar = [];
    actualizarBotonComparar();

    const filtroPasillo = document.getElementById('filter-reportes-pasillo').value;

    let reportesAMostrar = cachedReportes;
    if (filtroPasillo) {
        reportesAMostrar = cachedReportes.filter(r => {
            const folderSplit = r.filename ? r.filename.split('/') : [];
            const extractedAisle = folderSplit.length >= 2 ? folderSplit[1] : (r.aisleName || r.pasillo || '');
            return extractedAisle.toUpperCase() === filtroPasillo.toUpperCase();
        });
    }

    if (reportesAMostrar.length === 0) {
        container.innerHTML = `
            <div class="glass" style="padding: 50px; text-align: center; border-radius: 16px;">
                <i class="fa-solid fa-folder-open" style="font-size: 3rem; color: var(--text-muted); opacity: 0.4;"></i>
                <p style="margin-top: 16px; color: var(--text-muted); font-weight: 600; font-size: 1.1rem;">No hay inventarios guardados</p>
                <p style="color: var(--text-muted); font-size: 0.85rem; opacity: 0.7;">Los reportes aparecerán aquí cuando los trabajadores los envíen</p>
            </div>`;
        return;
    }

    // Agrupar por [Fecha Global] -> [Pasillo]
    const groups = {};

    reportesAMostrar.forEach((rep, idx) => {
        const originalIndex = cachedReportes.indexOf(rep);
        let dateFolder = "REPORTES GUARDADOS";
        let aisleFolder = (rep.aisleName || rep.pasillo || 'DESCONOCIDO').toUpperCase();

        if (rep.filename) {
            const parts = rep.filename.split('/');
            if (parts.length >= 3) {
                dateFolder = parts[0].toUpperCase();
                aisleFolder = parts[1].toUpperCase();
            } else if (parts.length === 2) {
                dateFolder = parts[0].toUpperCase();
                aisleFolder = "ARCHIVOS";
            }
        }

        if (!groups[dateFolder]) {
            groups[dateFolder] = {
                dateTitle: dateFolder,
                dateObj: new Date(rep.fecha_iso || rep.fecha),
                aisles: {}
            };
        }

        if (!groups[dateFolder].aisles[aisleFolder]) {
            groups[dateFolder].aisles[aisleFolder] = {
                title: aisleFolder,
                reports: []
            };
        }

        groups[dateFolder].aisles[aisleFolder].reports.push({ rep, originalIndex });
    });

    const sortedDates = Object.values(groups).sort((a, b) => {
        if (!a.dateObj || isNaN(a.dateObj.getTime())) return 1;
        if (!b.dateObj || isNaN(b.dateObj.getTime())) return -1;
        return b.dateObj.getTime() - a.dateObj.getTime();
    });

    sortedDates.forEach((dateGroup, dIdx) => {
        const dateId = 'date-folder-' + dIdx;
        let totalFiles = 0;
        Object.values(dateGroup.aisles).forEach(ag => totalFiles += ag.reports.length);

        const dateCard = document.createElement('div');
        dateCard.className = 'glass';
        dateCard.style.cssText = 'border-radius: 16px; overflow: hidden; margin-bottom: 20px; border: 1px solid rgba(103,58,183,0.2);';

        const dateHeader = document.createElement('div');
        dateHeader.style.cssText = 'padding: 18px 20px; cursor: pointer; display: flex; align-items: center; gap: 14px; background: rgba(103,58,183,0.06); user-select: none; border-bottom: 1px solid rgba(0,0,0,0.05);';
        dateHeader.onclick = function () {
            const content = document.getElementById(dateId);
            const icon = document.getElementById(dateId + '-icon');
            if (content.style.display === 'none') {
                content.style.display = 'block';
                icon.className = 'fa-solid fa-folder-open';
            } else {
                content.style.display = 'none';
                icon.className = 'fa-solid fa-folder';
            }
        };

        dateHeader.innerHTML = `
            <div style="width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #673ab7, #9575cd); display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 4px 10px rgba(103,58,183,0.3);">
                <i class="fa-solid fa-folder" id="${dateId}-icon" style="color: white; font-size: 1.4rem;"></i>
            </div>
            <div style="flex: 1;">
                <div style="font-weight: 900; font-size: 1.15rem; color: #673ab7;">${esc(dateGroup.dateTitle)}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600; margin-top: 3px;">
                    <i class="fa-solid fa-layer-group" style="margin-right: 4px;"></i>${Object.keys(dateGroup.aisles).length} Pasillos &nbsp;•&nbsp; <i class="fa-solid fa-file-excel" style="margin-right: 4px; color:#27ae60;"></i>${totalFiles} Archivos
                </div>
            </div>
        `;

        dateCard.appendChild(dateHeader);

        const dateContent = document.createElement('div');
        dateContent.id = dateId;
        dateContent.style.cssText = 'display: none; padding: 16px; background: rgba(255,255,255,0.3);';

        const sortedAisles = Object.values(dateGroup.aisles).sort((a, b) => a.title.localeCompare(b.title));

        sortedAisles.forEach((aisleGroup, aIdx) => {
            const aisleId = `${dateId}-aisle-${aIdx}`;

            const aisleCard = document.createElement('div');
            aisleCard.style.cssText = 'margin-bottom: 12px; border-radius: 12px; background: white; border: 1px solid rgba(0,0,0,0.06); box-shadow: 0 2px 5px rgba(0,0,0,0.02); overflow: hidden;';

            const aisleHeader = document.createElement('div');
            aisleHeader.style.cssText = 'padding: 14px 18px; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: all 0.2s; user-select: none;';
            aisleHeader.onmouseover = function () { this.style.background = 'rgba(243,156,18,0.05)'; };
            aisleHeader.onmouseout = function () { this.style.background = 'transparent'; };
            aisleHeader.onclick = function () {
                const content = document.getElementById(aisleId);
                const arrow = document.getElementById(aisleId + '-arrow');
                const icon = document.getElementById(aisleId + '-icon');
                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    arrow.style.transform = 'rotate(90deg)';
                    icon.className = 'fa-solid fa-folder-open';
                } else {
                    content.style.display = 'none';
                    arrow.style.transform = 'rotate(0deg)';
                    icon.className = 'fa-solid fa-folder';
                }
            };

            aisleHeader.innerHTML = `
                <i class="fa-solid fa-chevron-right" id="${aisleId}-arrow" style="font-size: 0.75rem; color: var(--text-muted); transition: transform 0.25s ease; flex-shrink: 0;"></i>
                <div style="width: 38px; height: 38px; border-radius: 8px; background: linear-gradient(135deg, #fff3e0, #ffe0b2); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <i class="fa-solid fa-folder" id="${aisleId}-icon" style="color: #f39c12; font-size: 1.1rem;"></i>
                </div>
                <div style="flex: 1; font-weight: 800; font-size: 0.95rem; color: var(--text-color);">${esc(aisleGroup.title)}</div>
                <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
                    <span style="background: rgba(46,204,113,0.12); color: #27ae60; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 700;">
                        <i class="fa-solid fa-file-excel" style="margin-right: 3px;"></i>${aisleGroup.reports.length} archivo${aisleGroup.reports.length > 1 ? 's' : ''}
                    </span>
                </div>
            `;

            aisleCard.appendChild(aisleHeader);

            const aisleContent = document.createElement('div');
            aisleContent.id = aisleId;
            aisleContent.style.cssText = 'display: none; border-top: 1px solid rgba(0,0,0,0.04); padding: 12px; background: #fafafa;';

            aisleGroup.reports.forEach(({ rep, originalIndex }) => {
                const fileDate = new Date(rep.fecha_iso || rep.fecha);
                const timeStr = !isNaN(fileDate.getTime())
                    ? fileDate.toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'Sin fecha';
                const responsable = rep.responsable || rep.usuario || 'Desconocido';
                const fileName = rep.filename ? rep.filename.split('/').pop().replace(/\.xlsx$/i, '').toUpperCase() : `${rep.aisleName}_${responsable}`.toUpperCase();

                let downloadHtml = '';
                if (rep.type === 'xlsx') {
                    downloadHtml = `<a href="/api/descargar-reporte/${encodeURIComponent(rep.filename)}" download
                                   style="background: linear-gradient(135deg, #27ae60, #2ecc71); color: white; border-radius: 8px; padding: 6px 14px; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; font-weight: 600; font-size: 0.78rem; box-shadow: 0 2px 8px rgba(46,204,113,0.2); transition: all 0.2s;"
                                   onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
                                    <i class="fa-solid fa-download"></i> .xlsx
                                </a>`;
                } else {
                    downloadHtml = `<button onclick="generarExcelReporte(${originalIndex})"
                                        style="background: linear-gradient(135deg, #27ae60, #2ecc71); color: white; border: none; border-radius: 8px; padding: 6px 14px; display: inline-flex; align-items: center; gap: 6px; font-weight: 600; font-size: 0.78rem; cursor: pointer; box-shadow: 0 2px 8px rgba(46,204,113,0.2); transition: all 0.2s;"
                                        onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
                                    <i class="fa-solid fa-download"></i> Excel
                                </button>`;
                }

                const fileRow = document.createElement('div');
                fileRow.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 8px; margin-bottom: 6px; transition: all 0.15s; background: white; border: 1px solid rgba(0,0,0,0.05);';
                fileRow.onmouseover = function () { this.style.background = 'rgba(103,58,183,0.04)'; this.style.borderColor = 'rgba(103,58,183,0.1)'; };
                fileRow.onmouseout = function () { this.style.background = 'white'; this.style.borderColor = 'rgba(0,0,0,0.05)'; };

                fileRow.innerHTML = `
                    <input type="checkbox" onchange="toggleSeleccionComparar(${originalIndex}, this)" style="transform: scale(1.15); cursor: pointer; accent-color: #673ab7; flex-shrink: 0;">
                    <div style="width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, #e8f5e9, #c8e6c9); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <i class="fa-solid fa-file-excel" style="color: #2e7d32; font-size: 0.9rem;"></i>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${esc(fileName)}
                        </div>
                        <div style="font-size: 0.72rem; color: var(--text-muted);">
                            <i class="fa-regular fa-clock" style="margin-right: 3px;"></i>${timeStr}
                        </div>
                    </div>
                    <div>${downloadHtml}</div>
                `;
                aisleContent.appendChild(fileRow);
            });

            aisleCard.appendChild(aisleContent);
            dateContent.appendChild(aisleCard);
        });

        dateCard.appendChild(dateContent);
        container.appendChild(dateCard);
    });
}

function toggleSeleccionComparar(index, checkbox) {
    if (checkbox.checked) {
        if (seleccionadosParaComparar.length >= 2) {
            checkbox.checked = false;
            mostrarToastSistema('⚠️ Solo puedes comparar 2 reportes a la vez');
            return;
        }
        seleccionadosParaComparar.push(index);
    } else {
        seleccionadosParaComparar = seleccionadosParaComparar.filter(i => i !== index);
    }
    actualizarBotonComparar();
}

function actualizarBotonComparar() {
    const btn = document.getElementById('btn-comparar-reportes');
    const count = seleccionadosParaComparar.length;
    btn.innerHTML = `<i class="fa-solid fa-code-compare"></i> Comparar (${count}/2)`;

    if (count === 2) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    } else {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
    }
}

async function abrirModalComparar() {
    if (seleccionadosParaComparar.length !== 2) return;

    const modal = document.getElementById('compare-modal');
    modal.style.display = 'flex';

    const tbody = document.querySelector('#compare-table tbody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px;"><i class="fa-solid fa-spinner fa-spin"></i> Procesando datos...</td></tr>';

    try {
        // Obtener los dos reportes
        let rep1 = cachedReportes[seleccionadosParaComparar[0]];
        let rep2 = cachedReportes[seleccionadosParaComparar[1]];

        // Ordenar por fecha: repA (antiguo), repB (reciente)
        const t1 = new Date(rep1.fecha_iso || rep1.fecha || 0).getTime();
        const t2 = new Date(rep2.fecha_iso || rep2.fecha || 0).getTime();

        let repA = t1 < t2 ? rep1 : rep2;
        let repB = t1 < t2 ? rep2 : rep1;

        // Setear info
        const dA = new Date(repA.fecha_iso || repA.fecha || 0);
        const dB = new Date(repB.fecha_iso || repB.fecha || 0);

        document.getElementById('compare-rep-a-info').innerHTML = `
                    <i class="fa-regular fa-calendar"></i> ${esc(dA.toLocaleString())}<br>
                    <i class="fa-solid fa-user"></i> ${esc(repA.responsable || repA.usuario || 'Desconocido')}
                `;
        document.getElementById('compare-rep-b-info').innerHTML = `
                    <i class="fa-regular fa-calendar"></i> ${esc(dB.toLocaleString())}<br>
                    <i class="fa-solid fa-user"></i> ${esc(repB.responsable || repB.usuario || 'Desconocido')}
                `;

        // Actualizar cabeceras de la tabla con los nombres
        const respA = repA.responsable || repA.usuario || 'Reporte A';
        const respB = repB.responsable || repB.usuario || 'Reporte B';
        document.getElementById('th-rep-a').textContent = respA.toUpperCase();
        document.getElementById('th-rep-b').textContent = respB.toUpperCase();

        // Procesar cada reporte para extraer { "Nombre Producto": Cantidad }
        const dataA = await parseReporteParaComparar(repA);
        const dataB = await parseReporteParaComparar(repB);

        // Combinar todas las claves de productos
        const allProducts = new Set([...Object.keys(dataA), ...Object.keys(dataB)]);

        // Renderizar tabla
        tbody.innerHTML = '';
        const sortedProducts = Array.from(allProducts).sort();

        sortedProducts.forEach(prodName => {
            const qtyA = dataA[prodName] || 0;
            const qtyB = dataB[prodName] || 0;
            const diff = qtyB - qtyA;

            let diffHtml = '';
            if (diff > 0) {
                diffHtml = `<span style="color: #27ae60; font-weight: 700; background: rgba(39,174,96,0.1); padding: 4px 8px; border-radius: 6px;">+${diff}</span>`;
            } else if (diff < 0) {
                diffHtml = `<span style="color: #e74c3c; font-weight: 700; background: rgba(231,76,60,0.1); padding: 4px 8px; border-radius: 6px;">${diff}</span>`;
            } else {
                diffHtml = `<span style="color: var(--text-muted); font-weight: 700;">0</span>`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                        <td style="font-weight: 600;">${esc(prodName)}</td>
                        <td style="text-align: center;">${qtyA}</td>
                        <td style="text-align: center;">${qtyB}</td>
                        <td style="text-align: center;">${diffHtml}</td>
                    `;
            tbody.appendChild(tr);
        });

        // Guardar en una variable global para exportar
        window.currentCompareData = {
            repA: { info: repA, date: dA },
            repB: { info: repB, date: dB },
            products: sortedProducts,
            dataA, dataB
        };

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px; color:red;">Error al procesar los datos.</td></tr>';
    }
}

async function parseReporteParaComparar(rep) {
    const dataMap = {}; // { nombreProducto: qty }

    if (rep.type === 'xlsx') {
        // Descargar el archivo XLSX
        const response = await fetch('/api/descargar-reporte/' + encodeURIComponent(rep.filename));
        const arrayBuffer = await response.arrayBuffer();
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(arrayBuffer);
        const ws = wb.getWorksheet(1);

        // Empezamos desde la fila 10 según el formato de excel_export
        ws.eachRow((row, rowNumber) => {
            if (rowNumber >= 10) {
                const prodName = row.getCell(1).value;
                const qty = parseFloat(row.getCell(3).value) || 0;
                if (prodName) {
                    dataMap[prodName.toString().trim().toUpperCase()] = qty;
                }
            }
        });
    } else {
        // JSON
        const config = JSON.parse(localStorage.getItem('fenix_pasillos_config') || '{}');
        const conteos = rep.conteos || {};

        let pasilloKey = null;
        const sampleCode = Object.keys(conteos)[0];
        if (sampleCode) {
            const parts = sampleCode.split('-');
            if (parts.length >= 2) {
                const prefix = parts[1];
                for (let k in window.ALL_PRODUCTS) {
                    if (k.startsWith(prefix + '-')) {
                        pasilloKey = k;
                        break;
                    }
                }
                if (sampleCode.startsWith('P1-')) {
                    pasilloKey = "01-PASILLO-PASTA";
                }
            }
        }

        if (pasilloKey && window.ALL_PRODUCTS[pasilloKey]) {
            const cfg = config[pasilloKey] || {};
            const baseProds = window.ALL_PRODUCTS[pasilloKey];

            Object.keys(conteos).forEach(code => {
                const qty = conteos[code];
                if (qty > 0) {
                    let name = "Desconocido";

                    const codeParts = code.split('-');
                    let indexStr = codeParts[codeParts.length - 1];
                    let isExtra = indexStr.startsWith('E');

                    if (isExtra) {
                        let idx = parseInt(indexStr.replace('E', '')) - 1;
                        if (cfg.extraProducts && cfg.extraProducts[idx]) {
                            name = cfg.extraProducts[idx];
                        }
                    } else {
                        let idx = parseInt(indexStr) - 1;
                        if (cfg.renamedProducts && cfg.renamedProducts[idx]) {
                            name = cfg.renamedProducts[idx];
                        } else if (baseProds[idx]) {
                            name = baseProds[idx];
                        }
                    }

                    dataMap[name.trim().toUpperCase()] = qty;
                }
            });
        } else {
            Object.keys(conteos).forEach(code => {
                if (conteos[code] > 0) dataMap[code] = conteos[code];
            });
        }
    }

    return dataMap;
}

async function descargarComparacionExcel() {
    if (!window.currentCompareData) return;
    const data = window.currentCompareData;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Comparación');

    ws.columns = [
        { header: 'Producto', key: 'prod', width: 45 },
        { header: `Reporte A (${data.repA.date.toLocaleString()})`, key: 'qtyA', width: 25 },
        { header: `Reporte B (${data.repB.date.toLocaleString()})`, key: 'qtyB', width: 25 },
        { header: 'Diferencia (B - A)', key: 'diff', width: 20 }
    ];

    const borderStyle = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    };

    // Estilo cabecera
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF34495E' } };
    headerRow.alignment = { horizontal: 'center' };
    for (let i = 1; i <= 4; i++) {
        headerRow.getCell(i).border = borderStyle;
    }

    let sumA = 0;
    let sumB = 0;
    let sumDiff = 0;

    data.products.forEach(p => {
        const qA = data.dataA[p] || 0;
        const qB = data.dataB[p] || 0;
        const diff = qB - qA;

        sumA += qA;
        sumB += qB;
        sumDiff += diff;

        const row = ws.addRow({
            prod: p,
            qtyA: qA,
            qtyB: qB,
            diff: diff
        });

        for (let i = 1; i <= 4; i++) {
            row.getCell(i).border = borderStyle;
        }

        row.getCell(2).alignment = { horizontal: 'center' };
        row.getCell(3).alignment = { horizontal: 'center' };
        row.getCell(4).alignment = { horizontal: 'center' };

        if (diff > 0) {
            row.getCell(4).font = { color: { argb: 'FF27AE60' }, bold: true };
        } else if (diff < 0) {
            row.getCell(4).font = { color: { argb: 'FFE74C3C' }, bold: true };
        }
    });

    // Añadir fila de totales
    const totalRow = ws.addRow({
        prod: `TOTAL (${data.products.length} productos)`,
        qtyA: sumA,
        qtyB: sumB,
        diff: sumDiff
    });

    totalRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };
    for (let i = 1; i <= 4; i++) {
        totalRow.getCell(i).border = borderStyle;
        if (i > 1) totalRow.getCell(i).alignment = { horizontal: 'center' };
    }

    if (sumDiff > 0) {
        totalRow.getCell(4).font = { color: { argb: 'FF2ECC71' }, bold: true };
    } else if (sumDiff < 0) {
        totalRow.getCell(4).font = { color: { argb: 'FFE74C3C' }, bold: true };
    } else {
        totalRow.getCell(4).font = { color: { argb: 'FFFFFFFF' }, bold: true };
    }

    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Comparacion_Inventarios.xlsx`);
}

async function generarExcelReporte(index) {
    const rep = cachedReportes[index];
    if (!rep) return;

    if (!window.ExportApp) {
        alert("La herramienta de Excel no se cargó correctamente.");
        return;
    }

    try {
        alert("Generando Excel, por favor espere...");
        // Usar la librería existente para regenerar el excel a partir de los datos recibidos
        await ExportApp.downloadAisle(
            rep.aisleName,
            rep.responsable,
            rep.companero || "SIN COMPAÑERO",
            rep.products || [],
            rep.inventoryData || {},
            { skipDownload: false }
        );
    } catch (error) {
        alert("Error generando Excel: " + error.message);
    }
}

// ─── HISTORIAL DE ACCESOS ────────────────────────────────────────────
window.cachedHistorial = [];

window.cargarHistorial = async function () {
    const tbody = document.getElementById('historial-tbody');
    const countEl = document.getElementById('historial-count');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-muted); padding: 30px;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem;"></i>
                <p style="margin-top: 10px;">Cargando actividad...</p>
            </td></tr>`;

    try {
        const response = await fetch('/api/historial');
        if (!response.ok) throw new Error('Sin servidor');
        const historial = await response.json();
        window.cachedHistorial = historial;

        // Resetear estado activo de los botones de filtro a 'todos'
        const filterBtns = document.querySelectorAll('.historial-filter-btn');
        filterBtns.forEach(btn => {
            btn.classList.remove('active');
            btn.style.background = 'transparent';
            btn.style.color = 'var(--text-muted)';
        });

        const btnTodos = document.querySelector('.historial-filter-btn[data-filter="todos"]');
        if (btnTodos) {
            btnTodos.classList.add('active');
            btnTodos.style.background = '#1a237e';
            btnTodos.style.color = 'white';
        }

        renderHistorialFiltrado('todos');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 40px;">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.5rem; color: #f39c12;"></i>
                    <p style="margin-top: 12px; font-weight: 600; color: var(--text-muted);">No se pudo conectar con el servidor</p>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 6px;">Abre el sistema desde <strong>http://localhost:8000</strong> con el servidor activo</p>
                </td></tr>`;
        if (countEl) countEl.textContent = '';
    }
};

window.filtrarHistorial = function (filtro, element) {
    const filterBtns = document.querySelectorAll('.historial-filter-btn');
    filterBtns.forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text-muted)';
    });
    element.classList.add('active');
    element.style.background = '#1a237e';
    element.style.color = 'white';

    renderHistorialFiltrado(filtro);
};

window.limpiarHistorial = async function () {
    if (!confirm('¿Estás seguro de que deseas eliminar todo el registro? Esta acción no se puede deshacer.')) return;
    try {
        const response = await fetch('/api/limpiar-historial', { method: 'POST' });
        const res = await response.json();
        if (res.status === 'success') {
            mostrarToastSistema('🗑️ Registro eliminado correctamente.');
            cargarHistorial();
        } else {
            alert('Error: ' + res.message);
        }
    } catch (err) {
        console.error(err);
        alert('No se pudo conectar con el servidor para limpiar el registro.');
    }
};

window.renderHistorialFiltrado = function (filtro = 'todos') {
    const tbody = document.getElementById('historial-tbody');
    const countEl = document.getElementById('historial-count');
    if (!tbody || !window.cachedHistorial) return;

    let filtrado = window.cachedHistorial;
    if (filtro === 'sesion') {
        filtrado = window.cachedHistorial.filter(e => {
            const acc = (e.accion || '').toLowerCase();
            return acc.includes('sesió') || acc.includes('sesio') || acc.includes('registr') || acc.includes('registro');
        });
    } else if (filtro === 'reporte') {
        filtrado = window.cachedHistorial.filter(e => {
            const acc = (e.accion || '').toLowerCase();
            return acc.includes('reporte') || acc.includes('envío') || acc.includes('envio');
        });
    } else if (filtro === 'cierre') {
        filtrado = window.cachedHistorial.filter(e => {
            const acc = (e.accion || '').toLowerCase();
            return (acc.includes('cerró') || acc.includes('cerro') || acc.includes('inicializ') || acc.includes('cierre')) && !acc.includes('sesi');
        });
    }

    if (filtrado.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-muted); padding: 45px;">
                    <i class="fa-solid fa-clock-rotate-left" style="font-size: 2.5rem; opacity: 0.3; color: var(--text-muted);"></i>
                    <p style="margin-top: 12px; font-weight: 600;">No hay registros para este filtro aún</p>
                </td></tr>`;
        if (countEl) countEl.innerHTML = `Mostrando: 0 de ${window.cachedHistorial.length} evento(s)`;
        return;
    }

    const groupSelect = document.getElementById('historial-group-select');
    const modoVista = groupSelect ? groupSelect.value : 'cronologico';

    tbody.innerHTML = '';

    if (modoVista === 'cronologico') {
        filtrado.forEach((evento, i) => {
            const rowHtml = generarFilaHistorial(evento, i + 1);
            const tr = document.createElement('tr');
            tr.innerHTML = rowHtml;
            tbody.appendChild(tr);
        });
    } else {
        // Agrupar por Pasillo
        const grupos = {};
        filtrado.forEach(evento => {
            let pasillo = 'OTROS EVENTOS';
            if (evento.accion) {
                const accStr = evento.accion.toUpperCase();
                let found = false;
                if (window.ALL_PRODUCTS) {
                    for (let k of Object.keys(window.ALL_PRODUCTS)) {
                        if (accStr.includes(k.toUpperCase())) {
                            pasillo = k.replace(/^\d+-/, '').replace(/-/g, ' ').toUpperCase();
                            found = true;
                            break;
                        }
                    }
                }
                if (!found && accStr.includes('PASILLO')) {
                    const match = accStr.match(/PASILLO\s+([A-Z0-9_-]+)/);
                    if (match) pasillo = "PASILLO " + match[1];
                }
            }
            if (!grupos[pasillo]) grupos[pasillo] = [];
            grupos[pasillo].push(evento);
        });

        // Renderizar grupos
        Object.keys(grupos).sort().forEach(nombreGrupo => {
            const eventosGrupo = grupos[nombreGrupo];

            // Fila de encabezado del grupo
            const trHeader = document.createElement('tr');
            trHeader.style.backgroundColor = 'rgba(103,58,183,0.05)';
            trHeader.innerHTML = `
                        <td colspan="4" style="padding: 12px 16px; border-bottom: 2px solid rgba(103,58,183,0.2);">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <i class="fa-solid fa-layer-group" style="color: #673ab7; font-size: 1.1rem;"></i>
                                <strong style="font-size: 1rem; color: var(--text-color);">${esc(nombreGrupo)}</strong>
                                <span style="background: white; border: 1px solid rgba(103,58,183,0.2); padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 700; color: #673ab7;">${eventosGrupo.length}</span>
                            </div>
                        </td>
                    `;
            tbody.appendChild(trHeader);

            // Filas del grupo
            eventosGrupo.forEach((evento, idx) => {
                const rowHtml = generarFilaHistorial(evento, idx + 1);
                const tr = document.createElement('tr');
                tr.innerHTML = rowHtml;
                tbody.appendChild(tr);
            });
        });
    }

    if (countEl) countEl.innerHTML = `Mostrando: ${filtrado.length} de ${window.cachedHistorial.length} evento(s) | Vista: ${modoVista === 'pasillo' ? 'Agrupada por pasillo' : 'Cronológica'}`;
};

function generarFilaHistorial(evento, index) {
    const fecha = evento.fecha
        ? new Date(evento.fecha).toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' })
        : 'Sin fecha';
    const inicial = (evento.usuario || 'U').charAt(0).toUpperCase();

    let accionIcon = 'fa-right-to-bracket';
    let accionColor = '#27ae60';
    const accionLower = (evento.accion || '').toLowerCase();

    if (accionLower.includes('cerró sesi') || accionLower.includes('cerro sesi')) {
        accionIcon = 'fa-right-from-bracket';
        accionColor = '#e74c3c';
    } else if (accionLower.includes('cerró') || accionLower.includes('cerro') || accionLower.includes('inicializ') || accionLower.includes('cierre')) {
        accionIcon = 'fa-lock';
        accionColor = '#e74c3c';
    } else if (accionLower.includes('cerrar ses') || accionLower.includes('cerrar sesion')) {
        accionIcon = 'fa-right-from-bracket';
        accionColor = '#e74c3c';
    } else if (accionLower.includes('reporte') || accionLower.includes('envío') || accionLower.includes('envio')) {
        accionIcon = 'fa-file-excel';
        accionColor = '#2980b9';
    } else if (accionLower.includes('registr') || accionLower.includes('registro')) {
        accionIcon = 'fa-user-plus';
        accionColor = '#8e44ad';
    }

    return `
                <td><strong>${index}</strong></td>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:36px; height:36px; border-radius:50%; background: linear-gradient(135deg, #1a237e, #3949ab); display:flex; align-items:center; justify-content:center; color:white; font-weight:700; font-size:0.9rem; flex-shrink:0;">
                            ${esc(inicial)}
                        </div>
                        <span style="font-weight:600;">${esc(evento.usuario || 'Desconocido')}</span>
                    </div>
                </td>
                <td>
                    <span style="display:inline-flex; align-items:center; gap:6px; padding: 4px 12px; border-radius: 20px; background: rgba(0,0,0,0.05); font-weight: 600; font-size: 0.85rem;">
                        <i class="fa-solid ${accionIcon}" style="color: ${accionColor};"></i>
                        ${esc(evento.accion || '—')}
                    </span>
                </td>
                <td style="color: var(--text-muted); font-size: 0.85rem;">${fecha}</td>
            `;
}

document.addEventListener('DOMContentLoaded', () => {
    const reportesNavBtn = document.querySelector('[data-target="view-reportes"]');
    if (reportesNavBtn) {
        reportesNavBtn.addEventListener('click', () => {
            if (cachedReportes.length === 0) cargarReportes();
        });
    }

    const pasillosNavBtn = document.querySelector('[data-target="view-pasillos"]');
    if (pasillosNavBtn) {
        pasillosNavBtn.addEventListener('click', () => {
            const container = document.getElementById('pasillos-list-container');
            if (container && !container.innerHTML.trim()) renderPasillosView();
        });
    }

    const historialNavBtn = document.querySelector('[data-target="view-historial"]');
    if (historialNavBtn) {
        historialNavBtn.addEventListener('click', cargarHistorial);
    }

    // Link para Depósito
    const depositoNavBtn = document.querySelector('[data-target="view-deposito"]');
    if (depositoNavBtn) {
        depositoNavBtn.addEventListener('click', renderDepositoView);
    }

    // Si estamos directamente en deposito.html, renderizar automáticamente
    if (window.location.pathname.includes('deposito.html')) {
        renderDepositoView();
    }
});

// ─── GESTIÓN DE PASILLOS ───────────────────────────────────────────────
const PASILLOS_CONFIG_KEY = 'fenix_pasillos_config';

function getPasillosConfig() {
    return JSON.parse(localStorage.getItem(PASILLOS_CONFIG_KEY) || '{}');
}

function savePasillosConfig(config) {
    localStorage.setItem(PASILLOS_CONFIG_KEY, JSON.stringify(config));
    fetch('/api/pasillos-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
    }).catch(err => console.error('Error sincronizando config global con servidor:', err));
}

window.agregarPasilloNuevo = function () {
    const modal = document.getElementById('custom-prompt-modal');
    const msg = document.getElementById('custom-prompt-msg');
    const input = document.getElementById('custom-prompt-input');
    const okBtn = document.getElementById('custom-prompt-ok');
    const cancelBtn = document.getElementById('custom-prompt-cancel');

    msg.textContent = 'Nombre del nuevo pasillo:';
    input.value = '';
    input.placeholder = 'Ej: Perfumería, Lácteos...';
    modal.style.display = 'flex';
    setTimeout(() => input.focus(), 100);

    // Limpiar listeners previos clonando
    const newOk = okBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    function cerrar() { modal.style.display = 'none'; }

    newCancel.addEventListener('click', cerrar);

    newOk.addEventListener('click', async function () {
        const nombre = document.getElementById('custom-prompt-input').value.trim();
        cerrar();
        if (!nombre) return;

        const safeName = nombre.toUpperCase();
        const id = 'CUSTOM-' + safeName.replace(/\s+/g, '-') + '-' + Date.now().toString().slice(-4);

        // 1. Guardar en products.js via servidor
        try {
            const res = await fetch('/api/agregar-pasillo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, nombre: safeName, productos: [] })
            });
            const result = await res.json();
            if (result.status === 'error') throw new Error(result.message);
        } catch (e) {
            if (typeof mostrarToastSistema === 'function') {
                mostrarToastSistema('⚠️ No se pudo guardar en products.js: ' + e.message);
            }
        }

        // 2. Registrar también en ALL_PRODUCTS para la sesión actual
        if (!window.ALL_PRODUCTS) window.ALL_PRODUCTS = {};
        window.ALL_PRODUCTS[id] = [];

        // 3. Guardar config
        const config = getPasillosConfig();
        config[id] = { name: safeName, isCustom: true, extraProducts: [], enabled: true };
        savePasillosConfig(config);

        renderPasillosView();
        if (typeof mostrarToastSistema === 'function') {
            mostrarToastSistema('✅ Pasillo "' + safeName + '" guardado en products.js');
        }
    });

    // Enviar con Enter
    input.onkeydown = function (e) { if (e.key === 'Enter') newOk.click(); };
};

function renderPasillosView() {
    const container = document.getElementById('pasillos-list-container');
    if (!container) return;
    container.innerHTML = '';

    if (!window.ALL_PRODUCTS) {
        container.innerHTML = '<div class="glass" style="padding:24px;text-align:center;color:var(--text-muted);">No se pudo cargar products.js</div>';
        return;
    }

    const config = getPasillosConfig();

    for (const k in config) {
        if (config[k] && config[k].isCustom && !window.ALL_PRODUCTS[k]) {
            window.ALL_PRODUCTS[k] = [];
        }
    }

    for (const key in window.ALL_PRODUCTS) {
        const cfg = config[key] || {};
        const defaultName = key.replace(/^\d+-/, '').replace(/-/g, ' ').toUpperCase();
        const displayName = cfg.name || defaultName;
        const enabled = cfg.enabled !== false; // default = habilitado
        const baseProducts = window.ALL_PRODUCTS[key];
        const extraProducts = cfg.extraProducts || [];
        const allProducts = [...baseProducts, ...extraProducts];

        const card = document.createElement('div');
        card.className = 'glass';
        card.id = `card-pasillo-${key.replace(/\W/g, '_')}`;
        card.style.cssText = 'padding:20px;border-radius:12px;' + (!enabled ? 'opacity:0.5;' : '');

        // Header con nombre, badge conteo, y botones
        const headerId = `header-${key.replace(/\W/g, '_')}`;
        const headerDiv = document.createElement('div');
        headerDiv.id = headerId;
        headerDiv.style.cssText = 'display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border-color);padding-bottom:12px;margin-bottom:14px;flex-wrap:wrap;cursor:pointer;user-select:none;';

        headerDiv.onclick = function (e) {
            // No hacer toggle si le da clic a un botón o algo interroblable (aunque los botones los movimos abajo, pero por si acaso)
            if (e.target.closest('button')) return;
            const tDiv = document.getElementById(`table-pasillo-${key.replace(/\W/g, '_')}`);
            const chevron = document.getElementById(`${headerId}-chevron`);
            if (tDiv.style.display === 'none') {
                tDiv.style.display = 'block';
                chevron.style.transform = 'rotate(90deg)';
            } else {
                tDiv.style.display = 'none';
                chevron.style.transform = 'rotate(0deg)';
            }
        };

        headerDiv.innerHTML = `
                    <i class="fa-solid fa-chevron-right" id="${headerId}-chevron" style="transition: transform 0.2s; color: var(--text-muted); font-size: 0.8rem;"></i>
                    <i class="fa-solid fa-layer-group" style="color:var(--primary-green);font-size:1.1rem;"></i>
                    <span id="name-display-${key.replace(/\W/g, '_')}" style="font-size:1.05rem;font-weight:800;flex:1;">${esc(displayName)}</span>
                    <span style="font-size:0.78rem;background:rgba(103,58,183,0.1);color:#673ab7;padding:3px 10px;border-radius:20px;font-weight:600;">${allProducts.length} productos</span>
                    <span style="font-size:0.75rem;padding:3px 10px;border-radius:20px;font-weight:700;${enabled ? 'background:rgba(46,204,113,0.15);color:#27ae60;' : 'background:rgba(231,76,60,0.15);color:#e74c3c;'}" id="badge-status-${key.replace(/\W/g, '_')}">
                        ${enabled ? '✓ Habilitado' : '🚫 Deshabilitado'}
                    </span>
                `;

        // Botones de acción
        const actionsDiv = document.createElement('div');
        actionsDiv.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;';
        let btnsHtml = `
                    <button onclick="renombrarPasillo('${key}')" style="background:rgba(103,58,183,0.1);color:#673ab7;border:1px solid rgba(103,58,183,0.3);padding:7px 14px;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.82rem;display:flex;align-items:center;gap:6px;transition:all 0.2s;">
                        <i class="fa-solid fa-pen"></i> Renombrar Pasillo
                    </button>
                    <button onclick="agregarProductoPasillo('${key}')" style="background:rgba(46,204,113,0.1);color:#27ae60;border:1px solid rgba(46,204,113,0.3);padding:7px 14px;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.82rem;display:flex;align-items:center;gap:6px;transition:all 0.2s;">
                        <i class="fa-solid fa-plus"></i> Agregar Producto
                    </button>
                    <button onclick="toggleHabilitarPasillo('${key}')" id="btn-toggle-${key.replace(/\W/g, '_')}" style="background:${enabled ? 'rgba(231,76,60,0.1)' : 'rgba(46,204,113,0.1)'};color:${enabled ? '#e74c3c' : '#27ae60'};border:1px solid ${enabled ? 'rgba(231,76,60,0.3)' : 'rgba(46,204,113,0.3)'};padding:7px 14px;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.82rem;display:flex;align-items:center;gap:6px;transition:all 0.2s;">
                        <i class="fa-solid ${enabled ? 'fa-ban' : 'fa-check'}"></i> ${enabled ? 'Deshabilitar' : 'Habilitar'}
                    </button>
                    <button data-key="${esc(key)}" data-nombre="${esc(displayName)}" onclick="cerrarInventarioPasillo(this.dataset.key, this.dataset.nombre)" style="background:rgba(231,76,60,0.1);color:#e74c3c;border:1px solid rgba(231,76,60,0.3);padding:7px 14px;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.82rem;display:flex;align-items:center;gap:6px;transition:all 0.2s;">
                        <i class="fa-solid fa-lock"></i> Cerrar e Inicializar a 0
                    </button>
                `;
        if (cfg.isCustom || key.startsWith('CUSTOM-')) {
            btnsHtml += `
                    <button onclick="eliminarPasilloDefinitivo('${key}')" style="background:rgba(231,76,60,0.1);color:#e74c3c;border:1px solid rgba(231,76,60,0.6);padding:7px 14px;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.82rem;display:flex;align-items:center;gap:6px;transition:all 0.2s;margin-left:auto;">
                        <i class="fa-solid fa-trash-can"></i> Eliminar Pasillo
                    </button>
            `;
        }
        actionsDiv.innerHTML = btnsHtml;

        // Tabla de productos
        const tableDiv = document.createElement('div');
        tableDiv.id = `table-pasillo-${key.replace(/\W/g, '_')}`;
        tableDiv.className = 'table-responsive';
        tableDiv.style.maxHeight = '300px';
        tableDiv.style.overflowY = 'auto';
        tableDiv.style.display = 'none'; // starts hidden

        let tbodyHtml = '';
        if (allProducts.length === 0) {
            tbodyHtml = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">Pasillo vacío — Agrega productos con el botón de arriba</td></tr>`;
        } else {
            allProducts.forEach((prod, idx) => {
                const isExtra = idx >= baseProducts.length;
                const realIdx = isExtra ? idx - baseProducts.length : idx;
                let displayProd = prod;
                if (!isExtra && cfg.renamedProducts && cfg.renamedProducts[idx]) {
                    displayProd = cfg.renamedProducts[idx];
                }

                tbodyHtml += `
                            <tr id="prod-row-${key.replace(/\W/g, '_')}-${idx}">
                                <td style="width:50px;color:var(--text-muted);font-size:0.8rem;">#${idx + 1}</td>
                                <td>
                                    <strong>${esc(displayProd)}</strong>
                                    ${isExtra ? ' <span style="font-size:0.7rem;background:rgba(103,58,183,0.15);color:#673ab7;padding:1px 6px;border-radius:10px;margin-left:6px;">nuevo</span>' : ''}
                                </td>
                                <td style="width:80px;text-align:right;">
                                    <button onclick="renombrarProductoPasillo('${key}', ${realIdx}, ${isExtra})" style="background:none;border:none;color:#f39c12;cursor:pointer;font-size:0.9rem;margin-right:8px;" title="Renombrar"><i class="fa-solid fa-pen"></i></button>
                                    ${isExtra ? `<button onclick="eliminarProductoPasillo('${key}', ${realIdx})" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:0.9rem;" title="Eliminar"><i class="fa-solid fa-trash"></i></button>` : ''}
                                </td>
                            </tr>
                        `;
            });
        }

        tableDiv.innerHTML = `<table class="data-table"><tbody id="tbody-${key.replace(/\W/g, '_')}">${tbodyHtml}</tbody></table>`;

        card.appendChild(headerDiv);
        card.appendChild(actionsDiv);
        card.appendChild(tableDiv);
        container.appendChild(card);
    }
}

function renombrarPasillo(key) {
    const config = getPasillosConfig();
    const defaultName = key.replace(/^\d+-/, '').replace(/-/g, ' ').toUpperCase();
    const current = (config[key] && config[key].name) || defaultName;
    const nuevo = prompt('Nuevo nombre para el pasillo:', current);
    if (!nuevo || !nuevo.trim()) return;
    if (!config[key]) config[key] = { enabled: true, extraProducts: [] };
    config[key].name = nuevo.trim().toUpperCase();
    savePasillosConfig(config);
    const el = document.getElementById('name-display-' + key.replace(/\W/g, '_'));
    if (el) el.textContent = config[key].name;
    mostrarToastSistema('✅ Pasillo renombrado. Los cambios se reflejarán en el Inicio.');
}

function toggleHabilitarPasillo(key) {
    const config = getPasillosConfig();
    if (!config[key]) config[key] = { enabled: true, extraProducts: [] };
    config[key].enabled = !config[key].enabled;
    savePasillosConfig(config);
    renderPasillosView();
    mostrarToastSistema(config[key].enabled ? '✅ Pasillo habilitado en el Inicio.' : '⛔ Pasillo deshabilitado en el Inicio.');
}

function eliminarPasilloDefinitivo(key) {
    if (!confirm('¿Estás SEGURO de que deseas eliminar completamente este pasillo? Se borrará de forma definitiva del archivo products.js')) return;

    fetch('/api/eliminar-pasillo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pasilloId: key })
    }).then(r => r.json()).then(res => {
        if (res.status === 'success') {
            if (window.ALL_PRODUCTS) delete window.ALL_PRODUCTS[key];
            const config = getPasillosConfig();
            if (config[key]) delete config[key];
            savePasillosConfig(config);
            renderPasillosView();
            mostrarToastSistema('🗑️ Pasillo eliminado exitosamente.');
        } else {
            throw new Error(res.message);
        }
    }).catch(e => mostrarToastSistema('⚠️ Error eliminando pasillo: ' + e.message));
}

function agregarProductoPasillo(key) {
    // ── Modal de entrada ────────────────────────────────────────────────────
    let overlay = document.getElementById('modal-agregar-prod');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modal-agregar-prod';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);z-index:3000;display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `
                    <div style="background:#1a1a2e;border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:28px 24px;width:360px;max-width:92%;box-shadow:0 16px 48px rgba(0,0,0,0.6);">
                        <h3 style="color:#f0c040;margin:0 0 6px;font-size:1.1rem;text-transform:uppercase;">➕ Agregar Producto</h3>
                        <p style="color:#aaa;font-size:0.85rem;margin:0 0 16px;" id="map-pasillo-label"></p>
                        <input id="map-input-nombre" type="text" placeholder="Nombre del producto..." autocomplete="off"
                            style="width:100%;box-sizing:border-box;padding:12px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);background:#0d0d1a;color:#fff;font-size:0.95rem;margin-bottom:16px;outline:none;">
                        <div style="display:flex;gap:10px;">
                            <button id="map-btn-cancel" style="flex:1;padding:12px;border-radius:10px;background:#333;color:#fff;border:none;font-weight:700;cursor:pointer;">Cancelar</button>
                            <button id="map-btn-ok" style="flex:2;padding:12px;border-radius:10px;background:#f0c040;color:#000;border:none;font-weight:800;cursor:pointer;">Agregar</button>
                        </div>
                    </div>`;
        document.body.appendChild(overlay);

        document.getElementById('map-btn-cancel').onclick = () => { overlay.style.display = 'none'; };
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.style.display = 'none'; });

        document.getElementById('map-input-nombre').addEventListener('keydown', e => {
            if (e.key === 'Enter') document.getElementById('map-btn-ok').click();
        });
    }

    // Rellenar etiqueta del pasillo
    const config = getPasillosConfig();
    const pasilloLabel = (config[key] && config[key].name) || key.replace(/^\d+-/, '').replace(/-/g, ' ').toUpperCase();
    document.getElementById('map-pasillo-label').textContent = 'Pasillo: ' + pasilloLabel;
    document.getElementById('map-input-nombre').value = '';
    overlay.style.display = 'flex';
    setTimeout(() => document.getElementById('map-input-nombre').focus(), 80);

    // ── Acción al confirmar ─────────────────────────────────────────────────
    document.getElementById('map-btn-ok').onclick = () => {
        const nombre = document.getElementById('map-input-nombre').value.trim().toUpperCase();
        if (!nombre) return;
        overlay.style.display = 'none';

        fetch('/api/agregar-producto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pasilloId: key, productoNombre: nombre })
        }).then(r => r.json()).then(res => {
            if (res.status === 'success') {
                if (window.ALL_PRODUCTS && window.ALL_PRODUCTS[key]) {
                    if (!window.ALL_PRODUCTS[key].includes(nombre)) window.ALL_PRODUCTS[key].push(nombre);
                }
                mostrarToastSistema('✅ Producto inyectado en products.js permanentemente.');
                renderPasillosView();
            } else { throw new Error(res.message); }
        }).catch(e => {
            mostrarToastSistema('⚠️ Error agregando producto: ' + e.message);
        });
    };
}

// ── Notificación: producto no está en el catálogo ──────────────────────────
function mostrarNotifProductoNuevo(nombre, pasilloKey) {
    // Eliminar notif previa si existe
    const vieja = document.getElementById('notif-producto-nuevo');
    if (vieja) vieja.remove();

    const notif = document.createElement('div');
    notif.id = 'notif-producto-nuevo';
    notif.style.cssText = `
                position:fixed;bottom:28px;left:50%;transform:translateX(-50%);
                background:#1a1a2e;border:1.5px solid #f0c040;border-radius:16px;
                padding:18px 20px;width:360px;max-width:92%;z-index:4000;
                box-shadow:0 8px 32px rgba(240,192,64,0.25);animation:slideUpNotif 0.35s ease;
            `;

    // Inyectar animación una sola vez
    if (!document.getElementById('notif-keyframes')) {
        const style = document.createElement('style');
        style.id = 'notif-keyframes';
        style.textContent = `
                    @keyframes slideUpNotif {
                        from { opacity:0; transform:translateX(-50%) translateY(20px); }
                        to   { opacity:1; transform:translateX(-50%) translateY(0); }
                    }`;
        document.head.appendChild(style);
    }

    notif.innerHTML = `
                <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px;">
                    <span style="font-size:1.6rem;line-height:1;">🔔</span>
                    <div>
                        <p style="margin:0 0 4px;color:#f0c040;font-weight:800;font-size:0.95rem;">Producto no encontrado en el catálogo</p>
                        <p style="margin:0;color:#ccc;font-size:0.85rem;">
                            <strong style="color:#fff;">${esc(nombre)}</strong> no aparece en el inventario.<br>¿Deseas agregarlo al catálogo del pasillo?
                        </p>
                    </div>
                </div>
                <div style="display:flex;gap:10px;">
                    <button id="notif-btn-ignorar" style="flex:1;padding:10px;border-radius:10px;background:#333;color:#aaa;border:none;font-weight:700;cursor:pointer;font-size:0.85rem;">Ignorar</button>
                    <button id="notif-btn-aceptar" style="flex:2;padding:10px;border-radius:10px;background:#f0c040;color:#000;border:none;font-weight:800;cursor:pointer;font-size:0.85rem;">✅ Agregar al catálogo</button>
                </div>`;

    document.body.appendChild(notif);

    let timer = setTimeout(() => notif.remove(), 12000); // auto-cierra en 12s

    document.getElementById('notif-btn-ignorar').onclick = () => {
        clearTimeout(timer);
        notif.remove();
    };

    document.getElementById('notif-btn-aceptar').onclick = () => {
        clearTimeout(timer);
        notif.remove();

        fetch('/api/agregar-producto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pasilloId: pasilloKey, productoNombre: nombre })
        }).then(r => r.json()).then(res => {
            if (res.status === 'success') {
                if (window.ALL_PRODUCTS && window.ALL_PRODUCTS[pasilloKey]) {
                    if (!window.ALL_PRODUCTS[pasilloKey].includes(nombre)) window.ALL_PRODUCTS[pasilloKey].push(nombre);
                }
                mostrarToastSistema('📦 ' + nombre + ' inyectado permanentemente en products.js.');
                if (typeof renderPasillosView === 'function') renderPasillosView();
            } else { throw new Error(res.message); }
        }).catch(e => {
            mostrarToastSistema('⚠️ Error local: ' + e.message);
        });
    };
}

function renombrarProductoPasillo(key, idx, isExtra) {
    const config = getPasillosConfig();
    if (!config[key]) config[key] = { enabled: true, extraProducts: [], renamedProducts: {} };

    let currentName = '';
    if (isExtra) {
        currentName = config[key].extraProducts[idx];
    } else {
        currentName = (config[key].renamedProducts && config[key].renamedProducts[idx]) ? config[key].renamedProducts[idx] : window.ALL_PRODUCTS[key][idx];
    }

    const nuevo = prompt('Nuevo nombre para el producto:', currentName);
    if (!nuevo || !nuevo.trim()) return;

    if (isExtra) {
        config[key].extraProducts[idx] = nuevo.trim().toUpperCase();
    } else {
        if (!config[key].renamedProducts) config[key].renamedProducts = {};
        config[key].renamedProducts[idx] = nuevo.trim().toUpperCase();
    }

    savePasillosConfig(config);
    renderPasillosView();
    mostrarToastSistema('✅ Producto renombrado.');
}

function eliminarProductoPasillo(key, extraIdx) {
    if (!confirm('¿Eliminar este producto?')) return;
    const config = getPasillosConfig();
    if (config[key] && config[key].extraProducts) {
        config[key].extraProducts.splice(extraIdx, 1);
        savePasillosConfig(config);
        renderPasillosView();
        mostrarToastSistema('🗑️ Producto eliminado.');
    }
}

async function cerrarInventarioPasillo(pasilloId, pasilloName) {
    if (!confirm(`¿Estás seguro de que deseas CERRAR el inventario de "${pasilloName}"?\nEsto obligará a que los teléfonos de los trabajadores limpien sus conteos locales a 0 para empezar un nuevo reporte.`)) return;
    try {
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const usuarioNombre = user.nombre || 'Admin';

        const response = await fetch('/api/cerrar-pasillo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pasilloId, pasilloName, usuario: usuarioNombre })
        });
        const res = await response.json();
        if (res.status === 'success') {
            mostrarToastSistema(`🔒 Inventario de ${pasilloName} cerrado e inicializado en 0.`);
            // Recargar historial si está abierto
            if (document.getElementById('view-historial').style.display !== 'none') {
                cargarHistorial();
            }
        } else {
            alert('Error: ' + res.message);
        }
    } catch (err) {
        console.error(err);
        alert('No se pudo conectar con el servidor para cerrar el inventario.');
    }
}

function mostrarToastSistema(msg) {
    let toast = document.getElementById('toast-sistema');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-sistema';
        toast.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%) translateY(20px);background:#673ab7;color:white;padding:12px 24px;border-radius:50px;font-weight:700;font-size:0.9rem;z-index:9999;box-shadow:0 4px 20px rgba(103,58,183,0.4);opacity:0;transition:all 0.3s;pointer-events:none;white-space:nowrap;';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
    }, 3000);
}

// ==========================================
// FUNCIONES DE KPIs DEL DASHBOARD
// ==========================================
async function actualizarKpisDashboard() {
    const dashboardTable = document.getElementById('dashboard-pasillos-table');
    if (dashboardTable) {
        dashboardTable.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Cargando datos...</td></tr>';
    }

    try {
        // Agrupar por pasillo
        const groups = {};
        cachedReportes.forEach(rep => {
            const aisle = (rep.aisleName || rep.pasillo || 'UNKNOWN').toUpperCase();
            if (!groups[aisle]) groups[aisle] = [];
            groups[aisle].push(rep);
        });

        let totalProdsQty = 0;

        for (const aisle in groups) {
            const reps = groups[aisle];
            // Ordenar por fecha descendente (más reciente primero)
            reps.sort((a, b) => {
                const tA = new Date(a.fecha_iso || a.fecha || 0).getTime();
                const tB = new Date(b.fecha_iso || b.fecha || 0).getTime();
                return tB - tA;
            });

            // Parsear el reporte más reciente
            if (reps.length >= 1) {
                try {
                    const repReciente = reps[0];
                    const dataReciente = await parseReporteParaComparar(repReciente);

                    // Sumar cantidad de productos registrados
                    for (const prod in dataReciente) {
                        totalProdsQty += 1;
                    }
                } catch (e) {
                    console.error('Error calculando KPIs para', aisle, e);
                }
            }
        }

        const headerBadge = document.querySelector('.icon-btn[aria-label="Notificaciones"] .badge');
        if (headerBadge) {
            headerBadge.textContent = totalProdsQty.toLocaleString();
            headerBadge.style.display = totalProdsQty > 0 ? 'flex' : 'none';
        }

        // Renderizar la tabla del Dashboard (Pasillos y cantidad de informes)
        if (dashboardTable) {
            dashboardTable.innerHTML = '';
            const pasillosInfo = Object.keys(groups).map(aisle => {
                const informes = groups[aisle];
                const ultimo = informes.length > 0 ? new Date(informes[0].fecha_iso || informes[0].fecha).toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' }) : 'Nunca';

                const usuariosUnicos = new Set();
                informes.forEach(inf => {
                    const u = inf.responsable || inf.usuario || 'Desconocido';
                    usuariosUnicos.add(u.toLowerCase().trim());
                });

                return { pasillo: aisle, cantidad: informes.length, ultimo: ultimo, usuariosCount: usuariosUnicos.size };
            });

            // Update Progress Bar
            const totalPasillosEnSistema = window.ALL_PRODUCTS ? Object.keys(window.ALL_PRODUCTS).length : 19;
            const pasillosCompletados = pasillosInfo.length;

            const progressText = document.getElementById('dashboard-progress-text');
            const progressBar = document.getElementById('dashboard-progress-bar');

            if (progressText && progressBar) {
                progressText.textContent = `${pasillosCompletados} / ${totalPasillosEnSistema} Pasillos reportados`;
                const pct = Math.min(100, Math.round((pasillosCompletados / totalPasillosEnSistema) * 100));
                progressBar.style.width = `${pct}%`;

                if (pct >= 100) {
                    progressText.style.color = '#27ae60';
                    progressBar.style.background = 'linear-gradient(90deg, #2ecc71, #27ae60)';
                } else {
                    progressText.style.color = '#673ab7';
                    progressBar.style.background = 'linear-gradient(90deg, #673ab7, #9575cd)';
                }
            }

            if (pasillosInfo.length === 0) {
                dashboardTable.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--text-muted);">No hay reportes todavía.</td></tr>';
            } else {
                // Sort alphabetically
                pasillosInfo.sort((a, b) => a.pasillo.localeCompare(b.pasillo));
                pasillosInfo.forEach(info => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                                <td style="font-weight: 600; font-size: 0.95rem;">${esc(info.pasillo)}</td>
                                <td><span class="badge-type" style="background: rgba(103, 58, 183, 0.1); color: #673ab7; font-size: 0.85rem; padding: 6px 12px; border-radius: 8px;">${info.cantidad} informes</span></td>
                                <td><span style="font-weight: 600; color: var(--text-muted);"><i class="fa-solid fa-users" style="margin-right: 5px;"></i>${info.usuariosCount}</span></td>
                                <td style="color: var(--text-muted); font-size: 0.85rem;">${esc(info.ultimo)}</td>
                            `;
                    dashboardTable.appendChild(tr);
                });
            }
        }

    } catch (error) {
        console.error("Error calculando KPIs:", error);
        if (dashboardTable) {
            dashboardTable.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px; color: #e74c3c;">Error al cargar los datos.</td></tr>';
        }
    }
}

// ==========================================
// PREFERENCIAS DE INVENTARIO (solo admin)
// ==========================================
function etiquetaFeedback() {
    const chk = document.getElementById('set-enable-feedback');
    const lbl = document.getElementById('set-enable-feedback-label');
    if (chk && lbl) lbl.textContent = chk.checked ? 'Activado' : 'Desactivado';
}

async function cargarSettings() {
    const sel = document.getElementById('set-inventory-mode');
    const chk = document.getElementById('set-enable-feedback');
    if (!sel || !chk) return;

    try {
        const res = await fetch('/api/settings', { cache: 'no-store' });
        if (!res.ok) return;
        const ajustes = await res.json();
        sel.value = ajustes.inventoryMode === 'quick_notes' ? 'quick_notes' : 'calculator';
        chk.checked = ajustes.enableFeedback === true;
        etiquetaFeedback();
    } catch (e) {
        console.error('No se pudieron cargar las preferencias:', e);
    }
}

async function guardarSettings() {
    const sel = document.getElementById('set-inventory-mode');
    const chk = document.getElementById('set-enable-feedback');
    const estado = document.getElementById('set-status');
    if (!sel || !chk) return;

    if (estado) estado.textContent = 'Guardando...';
    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                inventoryMode: sel.value,
                enableFeedback: chk.checked
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'No se pudo guardar');

        if (estado) estado.textContent = '';
        mostrarToastSistema('Preferencias guardadas');
    } catch (e) {
        if (estado) estado.textContent = 'Error: ' + e.message;
        mostrarToastSistema('No se pudieron guardar las preferencias');
    }
}

window.cargarSettings = cargarSettings;
window.guardarSettings = guardarSettings;

// ==========================================
// COMENTARIOS DE LOS TRABAJADORES (solo admin)
// ==========================================
async function cargarComentarios() {
    const cont = document.getElementById('comentarios-lista');
    if (!cont) return;

    cont.innerHTML = '<p style="color: var(--text-muted); padding: 20px 0; text-align: center;">Cargando comentarios...</p>';

    try {
        const res = await fetch('/api/feedback', { cache: 'no-store' });
        if (res.status === 403) {
            cont.innerHTML = '<p style="color: var(--text-muted); padding: 20px 0; text-align: center;">Solo un administrador puede ver los comentarios.</p>';
            return;
        }
        if (!res.ok) throw new Error('No se pudieron cargar los comentarios');

        const lista = await res.json();
        if (!Array.isArray(lista) || lista.length === 0) {
            cont.innerHTML = '<p style="color: var(--text-muted); padding: 20px 0; text-align: center;">Todavía no hay comentarios.</p>';
            return;
        }

        cont.innerHTML = '';
        lista.forEach(c => {
            const fecha = new Date(c.fecha);
            const fechaTxt = isNaN(fecha.getTime()) ? '' : fecha.toLocaleString();
            const fila = document.createElement('div');
            fila.style.cssText = 'padding: 14px 0; border-bottom: 1px solid var(--border-color);';
            fila.innerHTML = `
                <div style="display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                    <strong style="font-size: 0.92rem;">${esc(c.usuario || 'Desconocido')}</strong>
                    <span style="font-size: 0.78rem; color: var(--text-muted);">${esc(fechaTxt)}</span>
                </div>
                <p style="margin: 6px 0 0 0; white-space: pre-wrap; line-height: 1.45;">${esc(c.mensaje || '')}</p>
                ${c.pasillo ? `<span style="display: inline-block; margin-top: 8px; font-size: 0.75rem; background: rgba(103,58,183,0.1); color: #673ab7; padding: 3px 10px; border-radius: 20px; font-weight: 600;">${esc(c.pasillo)}</span>` : ''}
            `;
            cont.appendChild(fila);
        });
    } catch (e) {
        console.error('Error cargando comentarios:', e);
        cont.innerHTML = '<p style="color: var(--text-muted); padding: 20px 0; text-align: center;">No se pudieron cargar los comentarios.</p>';
    }
}

window.cargarComentarios = cargarComentarios;

// Llamar la carga al iniciar
document.addEventListener('DOMContentLoaded', () => {
    // El dashboard carga reportes e historial al inicio
    cargarReportes();
    cargarHistorial();
    renderPasillosView();

    // Preferencias: se cargan al entrar y se guardan al cambiarlas
    cargarSettings();
    const selModo = document.getElementById('set-inventory-mode');
    const chkFeedback = document.getElementById('set-enable-feedback');
    if (selModo) selModo.addEventListener('change', guardarSettings);
    if (chkFeedback) {
        chkFeedback.addEventListener('change', function () {
            etiquetaFeedback();
            guardarSettings();
        });
    }

    const comentariosNavBtn = document.querySelector('[data-target="view-comentarios"]');
    if (comentariosNavBtn) {
        comentariosNavBtn.addEventListener('click', cargarComentarios);
    }

    // Iniciar polling de productos pendientes
    setInterval(cargarNotificacionesPendientes, 10000);
});

// ==========================================
// NOTIFICACIONES PRODUCTOS PENDIENTES
// ==========================================
let productosPendientesProcesados = [];

async function cargarNotificacionesPendientes() {
    try {
        const response = await fetch('/api/pendientes');
        if (!response.ok) return;
        const pendientes = await response.json();

        pendientes.forEach(prod => {
            if (!productosPendientesProcesados.includes(prod.id)) {
                productosPendientesProcesados.push(prod.id);
                mostrarNotificacionPendiente(prod);
            }
        });
    } catch (e) {
        console.error('Error cargando pendientes:', e);
    }
}

function mostrarNotificacionPendiente(prod) {
    const notif = document.createElement('div');
    notif.id = 'notif-pendiente-' + prod.id;
    notif.style.cssText = `
        position:fixed;bottom:80px;right:20px;
        background:#1a1a2e;border:1.5px solid #2980b9;border-radius:16px;
        padding:18px 20px;width:320px;z-index:9000;
        box-shadow:0 8px 32px rgba(41,128,185,0.3);
        transition:all 0.3s ease;
        animation: slideUpRight 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;

    if (!document.getElementById('anim-slideUpRight')) {
        const style = document.createElement('style');
        style.id = 'anim-slideUpRight';
        style.innerHTML = `@keyframes slideUpRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`;
        document.head.appendChild(style);
    }

    // Convert keys like "01-PASILLO-PASTA" to readable text
    const pasilloNombre = prod.pasillo.replace(/^\\d+-/, '').replace(/-/g, ' ').toUpperCase();

    notif.innerHTML = `
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px;">
            <span style="font-size:1.6rem;line-height:1;margin-top:2px;">🔔</span>
            <div style="flex:1;">
                <p style="margin:0 0 4px;color:#3498db;font-weight:800;font-size:0.95rem;">Nuevo producto sugerido</p>
                <p style="margin:0;color:#ccc;font-size:0.85rem;line-height:1.4;">
                    Desde <strong>${esc(pasilloNombre)}</strong> quieren añadir:<br>
                    <strong style="color:#fff;">${esc(prod.name)}</strong>
                </p>
                <p style="margin:6px 0 0;color:#aaa;font-size:0.75rem;font-weight:700;">¿Deseas agregarlo permanentemente?</p>
            </div>
        </div>
        <div style="display:flex;gap:10px;">
            <button id="btn-rechazar-${prod.id}" style="flex:1;padding:10px;border-radius:10px;background:rgba(231,76,60,0.1);color:#e74c3c;border:1px solid rgba(231,76,60,0.3);font-weight:700;cursor:pointer;font-size:0.85rem;transition:all 0.2s;"><i class="fa-solid fa-xmark"></i> Rechazar</button>
            <button id="btn-aceptar-${prod.id}" style="flex:1;padding:10px;border-radius:10px;background:#27ae60;color:#fff;border:none;font-weight:700;cursor:pointer;font-size:0.85rem;box-shadow: 0 4px 10px rgba(39,174,96,0.25);transition:all 0.2s;"><i class="fa-solid fa-check"></i> Aceptar</button>
        </div>
    `;

    document.body.appendChild(notif);

    document.getElementById(`btn-rechazar-${prod.id}`).onclick = () => resolverProductoPendiente(prod, 'rechazar', notif);
    document.getElementById(`btn-aceptar-${prod.id}`).onclick = () => resolverProductoPendiente(prod, 'aceptar', notif);
}

async function resolverProductoPendiente(prod, accion, notifEl) {
    try {
        const response = await fetch('/api/resolver-pendiente', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: prod.id, accion, name: prod.name, pasillo: prod.pasillo })
        });
        const res = await response.json();

        if (res.status === 'success') {
            notifEl.style.opacity = '0';
            notifEl.style.transform = 'translateY(20px)';
            setTimeout(() => notifEl.remove(), 300);

            if (accion === 'aceptar') {
                fetch('/api/agregar-producto', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pasilloId: prod.pasillo, productoNombre: prod.name.toUpperCase() })
                }).then(r => r.json()).then(result => {
                    if (result.status === 'success') {
                        if (window.ALL_PRODUCTS && window.ALL_PRODUCTS[prod.pasillo]) {
                            if (!window.ALL_PRODUCTS[prod.pasillo].includes(prod.name.toUpperCase())) {
                                window.ALL_PRODUCTS[prod.pasillo].push(prod.name.toUpperCase());
                            }
                        }
                        mostrarToastSistema('✅ Producto ' + prod.name + ' inyectado permanentemente en ' + prod.pasillo);
                        if (typeof renderPasillosView === 'function') renderPasillosView();
                    }
                }).catch(e => console.error('Error insertando pendiente en products.js', e));
            } else {
                mostrarToastSistema('🗑️ Producto ' + prod.name + ' rechazado.');
            }

            if (document.getElementById('view-historial') && document.getElementById('view-historial').style.display !== 'none') {
                cargarHistorial();
            }
        } else {
            alert('Error: ' + res.message);
        }
    } catch (err) {
        console.error(err);
        alert('Error al conectar con el servidor.');
    }
}

// ==========================================
// FUNCIONES DE CONTROL DE DEPÓSITO
// ==========================================

window.abrirCustomPrompt = function (msg) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-prompt-modal');
        if (!modal) {
            // Si por alguna razón no existe el modal en el HTML, usar el fallback
            resolve(prompt(msg));
            return;
        }

        const msgEl = document.getElementById('custom-prompt-msg');
        const inputEl = document.getElementById('custom-prompt-input');
        const btnOk = document.getElementById('custom-prompt-ok');
        const btnCancel = document.getElementById('custom-prompt-cancel');

        msgEl.textContent = msg;
        inputEl.value = '';
        modal.style.display = 'flex';
        // Timeout pequeno para que haga focus después de aparecer
        setTimeout(() => inputEl.focus(), 50);

        const cleanup = () => {
            modal.style.display = 'none';
            btnOk.onclick = null;
            btnCancel.onclick = null;
            inputEl.onkeydown = null;
        };

        btnOk.onclick = () => {
            cleanup();
            resolve(inputEl.value);
        };

        btnCancel.onclick = () => {
            cleanup();
            resolve(null);
        };

        inputEl.onkeydown = (e) => {
            if (e.key === 'Enter') {
                cleanup();
                resolve(inputEl.value);
            } else if (e.key === 'Escape') {
                cleanup();
                resolve(null);
            }
        };
    });
};

const DEPOSITO_SAVE_KEY = 'fenix_deposito_data';

// Lee los datos guardados de localStorage
function obtenerDatosDeposito() {
    return JSON.parse(localStorage.getItem(DEPOSITO_SAVE_KEY) || '{}');
}

window.renderDepositoView = function () {
    if (!window.ALL_PRODUCTS) return;

    const prodsArriba = window.ALL_PRODUCTS["19-PASILLO-DEPOSITO-ARRIBA"] || [];
    const prodsAbajo = window.ALL_PRODUCTS["18-PASILLO-DEPOSITO-ABAJO"] || [];

    const savedData = obtenerDatosDeposito();

    construirTablaDeposito('tabla-deposito-arriba', prodsArriba, 'arriba', savedData);
    construirTablaDeposito('tabla-deposito-abajo', prodsAbajo, 'abajo', savedData);
}

function construirTablaDeposito(tableId, productos, depositKey, savedData) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;

    tbody.innerHTML = '';

    if (productos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 20px;">No hay productos definidos para este depósito.</td></tr>';
        return;
    }

    // Input style global
    const inputStyle = 'width: 100%; box-sizing: border-box; text-align: center; padding: 6px; border: 1px solid var(--border-color); border-radius: 6px; background: rgba(0,0,0,0.05); color: var(--text-color); outline: none; font-family: inherit; font-weight: 600; font-size: 0.9rem;';

    productos.forEach((prod, index) => {
        // Encontrar datos guardados para este producto (por nombre)
        const pData = savedData[prod] || { inicial: '', recargo: '', directo: '', sacado: '' };

        const getSafeHist = (val) => (val && val.toString().startsWith('[')) ? val : '[]';
        const safeIni = getSafeHist(pData.inicial_resp);
        const safeRec = getSafeHist(pData.recargo_resp);
        const safeDir = getSafeHist(pData.directo_resp);
        const safeSac = getSafeHist(pData.sacado_resp);

        const tr = document.createElement('tr');
        tr.className = 'dep-data-row';
        tr.innerHTML = `
            <td style="color: var(--text-muted); font-size: 0.85rem;">${index + 1}</td>
            <td style="font-weight: 700; color: var(--text-color); font-size: 0.9rem;">${esc(prod)}</td>
            <td style="padding: 4px; text-align:center;">
                <input type="text" class="dep-input-txt" data-field="unidad" data-prod="${esc(prod)}" value="${esc(pData.unidad || '')}" placeholder="Ej: CAJA" style="${inputStyle}">
            </td>
            <td style="padding: 4px; text-align:center;">
                <input type="text" class="dep-input" data-field="inicial" data-prod="${esc(prod)}" value="${esc(pData.inicial)}" data-lastval="${esc(pData.inicial)}" placeholder="Ej: 5+2" style="${inputStyle}">
                <input type="hidden" class="dep-hist-data" data-histfield="inicial" value='${esc(safeIni)}'>
                <button type="button" class="btn-historial" onclick="verHistorialFicha(this)" style="display:${safeIni !== '[]' ? 'inline-block' : 'none'}; background:#27ae60; color:white; border:none; border-radius:4px; font-size:0.6rem; padding: 2px 6px; margin-top:4px; cursor:pointer;" title="Ver historial"><i class="fa-solid fa-clock-rotate-left"></i> Historial</button>
            </td>
            <td style="padding: 4px; text-align:center;">
                <input type="text" class="dep-input" data-field="recargo" data-prod="${esc(prod)}" value="${esc(pData.recargo)}" data-lastval="${esc(pData.recargo)}" style="${inputStyle}">
                <input type="hidden" class="dep-hist-data" data-histfield="recargo" value='${esc(safeRec)}'>
                <button type="button" class="btn-historial" onclick="verHistorialFicha(this)" style="display:${safeRec !== '[]' ? 'inline-block' : 'none'}; background:#27ae60; color:white; border:none; border-radius:4px; font-size:0.6rem; padding: 2px 6px; margin-top:4px; cursor:pointer;" title="Ver historial"><i class="fa-solid fa-clock-rotate-left"></i> Historial</button>
            </td>
            <td style="padding: 4px; text-align:center;">
                <input type="text" class="dep-input" data-field="directo" data-prod="${esc(prod)}" value="${esc(pData.directo)}" data-lastval="${esc(pData.directo)}" style="${inputStyle}">
                <input type="hidden" class="dep-hist-data" data-histfield="directo" value='${esc(safeDir)}'>
                <button type="button" class="btn-historial" onclick="verHistorialFicha(this)" style="display:${safeDir !== '[]' ? 'inline-block' : 'none'}; background:#27ae60; color:white; border:none; border-radius:4px; font-size:0.6rem; padding: 2px 6px; margin-top:4px; cursor:pointer;" title="Ver historial"><i class="fa-solid fa-clock-rotate-left"></i> Historial</button>
            </td>
            <td style="padding: 4px; text-align:center;">
                <input type="text" class="dep-input" data-field="sacado" data-prod="${esc(prod)}" value="${esc(pData.sacado)}" data-lastval="${esc(pData.sacado)}" style="${inputStyle}">
                <input type="hidden" class="dep-hist-data" data-histfield="sacado" value='${esc(safeSac)}'>
                <button type="button" class="btn-historial" onclick="verHistorialFicha(this)" style="display:${safeSac !== '[]' ? 'inline-block' : 'none'}; background:#27ae60; color:white; border:none; border-radius:4px; font-size:0.6rem; padding: 2px 6px; margin-top:4px; cursor:pointer;" title="Ver historial"><i class="fa-solid fa-clock-rotate-left"></i> Historial</button>
            </td>
            <td style="text-align: center; vertical-align: middle; padding: 8px 4px;">
                <span class="dep-total" data-prod="${esc(prod)}" style="display: inline-block; min-width: 44px; background: rgba(39,174,96,0.12); color: #27ae60; font-weight: 800; font-size: 1.05rem; padding: 6px 14px; border-radius: 12px; letter-spacing: 0.5px;">0</span>
            </td>
            <td style="text-align: center; vertical-align: middle; padding: 8px 4px;">
                <span class="dep-total-unid" data-prod="${esc(prod)}" style="display: inline-block; min-width: 44px; background: linear-gradient(135deg, rgba(231,76,60,0.12), rgba(192,57,43,0.08)); color: #e74c3c; font-weight: 800; font-size: 1.05rem; padding: 6px 14px; border-radius: 12px; border: 1.5px solid rgba(231,76,60,0.2); letter-spacing: 0.5px;">0</span>
            </td>
        `;
        tbody.appendChild(tr);

        // Actualizar total al pintar (sin recalcular totales aún, se hará al final)
        recalcularFilaSinTotales(tr);
    });

    // Calcular los totales generales al terminar de pintar todas las filas
    actualizarTotalesTabla(tbody);

    // Agregar event listener delegando en el tbody para todos los inputs
    tbody.addEventListener('input', function (e) {
        if (e.target.classList.contains('dep-input') || e.target.classList.contains('dep-input-txt')) {
            recalcularFila(e.target.closest('tr'));
        }
    });

    // Helper for math evaluation
    const parseMath = (str) => {
        try {
            const clean = (str || '').toString().replace(/[^0-9+\-*/.]/g, '');
            if (!clean) return 0;
            return parseFloat(new Function('return ' + clean)()) || 0;
        } catch { return 0; }
    };

    // Validar para que resuelva la suma/resta
    tbody.addEventListener('change', async function (e) {
        if (e.target.classList.contains('dep-input')) {
            let val = e.target.value;
            let lastVal = parseFloat(e.target.getAttribute('data-lastval')) || 0;

            // Tratar el vacío como 0
            let evaluated = 0;
            if (val !== '') {
                evaluated = parseMath(val);
                if (evaluated < 0) evaluated = 0; // Evitar negativos
            }

            let diff = evaluated - lastVal;

            if (diff !== 0) {
                const sign = diff > 0 ? '+' : '';
                const resp = await window.abrirCustomPrompt(`Nombre del responsable del ajuste (${sign}${diff}):`);

                if (resp && resp.trim() !== '') {
                    e.target.value = evaluated > 0 ? evaluated : '';
                    e.target.setAttribute('data-lastval', evaluated);

                    const histInput = e.target.nextElementSibling;
                    const btn = histInput.nextElementSibling;

                    if (histInput && histInput.classList.contains('dep-hist-data')) {
                        let hist = [];
                        try { hist = JSON.parse(histInput.value || "[]"); } catch { }

                        // Agregar fecha y hora exacta
                        const d = new Date();
                        const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

                        hist.push({ resp: resp.trim().toUpperCase(), diff: diff, sign: sign, date: dateStr });
                        histInput.value = JSON.stringify(hist);
                    }

                    if (btn && btn.classList.contains('btn-historial')) {
                        btn.style.display = 'inline-block';
                    }

                    recalcularFila(e.target.closest('tr'));
                } else {
                    // Usuario canceló, revertir al valor anterior
                    e.target.value = lastVal > 0 ? lastVal : '';
                    recalcularFila(e.target.closest('tr'));
                }
            } else {
                e.target.value = evaluated > 0 ? evaluated : '';
                recalcularFila(e.target.closest('tr'));
            }
        }
    });

    try {
        if (!window.verHistorialFicha) {
            window.verHistorialFicha = function (btn) {
                const histInput = btn.previousElementSibling;
                try {
                    let hist = JSON.parse(histInput.value || "[]");
                    if (hist.length > 0) {
                        let msg = "Historial de modificaciones:\n\n";
                        hist.forEach(h => {
                            const dStr = h.date ? ` [${h.date}]` : '';
                            msg += `•${dStr} ${h.resp}: ${h.sign}${h.diff}\n`;
                        });
                        alert(msg);
                    } else {
                        alert("No hay historial registrado.");
                    }
                } catch (err) {
                    alert("Error al leer el historial.");
                }
            };
        }
    } catch (e) { }
}

function _calcFila(tr) {
    const parseMath = (str) => {
        try {
            const clean = (str || '').toString().replace(/[^0-9+\-*/.]/g, '');
            if (!clean) return 0;
            return parseFloat(new Function('return ' + clean)()) || 0;
        } catch { return 0; }
    };
    const inicial = parseMath(tr.querySelector('[data-field="inicial"]').value);
    const recargo = parseMath(tr.querySelector('[data-field="recargo"]').value);
    const directo = parseMath(tr.querySelector('[data-field="directo"]').value);
    const sacado = parseMath(tr.querySelector('[data-field="sacado"]').value);
    let unidadParse = parseFloat((tr.querySelector('[data-field="unidad"]').value || '').replace(/[^0-9.]/g, ''));
    let unidad = isNaN(unidadParse) ? 1 : unidadParse;
    const baseTotal = inicial + recargo + directo - sacado;
    const totalUnid = baseTotal * unidad;

    // TOTAL = suma cruda (sin multiplicar)
    const totalEl = tr.querySelector('.dep-total');
    totalEl.textContent = baseTotal;
    if (baseTotal < 0) {
        totalEl.style.background = 'rgba(231,76,60,0.12)'; totalEl.style.color = '#e74c3c';
    } else if (baseTotal > 0) {
        totalEl.style.background = 'rgba(39,174,96,0.12)'; totalEl.style.color = '#27ae60';
    } else {
        totalEl.style.background = 'rgba(103,58,183,0.1)'; totalEl.style.color = '#673ab7';
    }

    // TOTAL UNID = total × UND CAJA BULT
    const totalUnidEl = tr.querySelector('.dep-total-unid');
    if (totalUnidEl) {
        totalUnidEl.textContent = totalUnid;
        if (totalUnid < 0) {
            totalUnidEl.style.background = 'linear-gradient(135deg, rgba(231,76,60,0.12), rgba(192,57,43,0.08))';
            totalUnidEl.style.color = '#e74c3c';
            totalUnidEl.style.borderColor = 'rgba(231,76,60,0.2)';
        } else if (totalUnid > 0) {
            totalUnidEl.style.background = 'linear-gradient(135deg, rgba(231,76,60,0.12), rgba(192,57,43,0.08))';
            totalUnidEl.style.color = '#e74c3c';
            totalUnidEl.style.borderColor = 'rgba(231,76,60,0.3)';
        } else {
            totalUnidEl.style.background = 'rgba(103,58,183,0.1)';
            totalUnidEl.style.color = '#673ab7';
            totalUnidEl.style.borderColor = 'rgba(103,58,183,0.15)';
        }
    }

    // Alerta de Bajo Stock (Visual en toda la fila)
    if (totalUnid <= 0) {
        tr.style.backgroundColor = 'rgba(231,76,60,0.04)';
        tr.style.opacity = '0.75';
    } else {
        tr.style.backgroundColor = '';
        tr.style.opacity = '1';
    }
}

// Recalcular fila SIN actualizar pie de tabla (usado al pintar inicialmente)
function recalcularFilaSinTotales(tr) { _calcFila(tr); }

// Recalcular fila Y actualizar pie de tabla (usado al editar en tiempo real)
function recalcularFila(tr) {
    _calcFila(tr);
    const tbody = tr.closest('tbody');
    if (tbody) actualizarTotalesTabla(tbody);
}

function actualizarTotalesTabla(tbody) {
    const parseMath = (str) => {
        try {
            const clean = (str || '').toString().replace(/[^0-9+\-*/.]/g, '');
            if (!clean) return 0;
            return parseFloat(new Function('return ' + clean)()) || 0;
        } catch { return 0; }
    };
    let sumIni = 0, sumRec = 0, sumDir = 0, sumSac = 0, sumTotal = 0, sumTotalUnid = 0;
    tbody.querySelectorAll('tr.dep-data-row').forEach(tr => {
        sumIni += parseMath(tr.querySelector('[data-field="inicial"]')?.value);
        sumRec += parseMath(tr.querySelector('[data-field="recargo"]')?.value);
        sumDir += parseMath(tr.querySelector('[data-field="directo"]')?.value);
        sumSac += parseMath(tr.querySelector('[data-field="sacado"]')?.value);
        sumTotal += parseFloat(tr.querySelector('.dep-total')?.textContent || 0);
        sumTotalUnid += parseFloat(tr.querySelector('.dep-total-unid')?.textContent || 0);
    });

    const bs = 'border-top:2px solid #3949ab; background:rgba(26,35,126,0.06); padding:8px 6px; font-weight:800; font-size:0.9rem; text-align:center; color:#1a237e;';

    // --- Fila 1: Suma de columnas ---
    let trSumCol = tbody.querySelector('.dep-sum-row');
    if (!trSumCol) { trSumCol = document.createElement('tr'); trSumCol.className = 'dep-sum-row'; tbody.appendChild(trSumCol); }
    trSumCol.innerHTML = `
        <td colspan="2" style="${bs} text-align:left; padding-left:12px;">📊 SUMA COLUMNAS</td>
        <td style="${bs}">—</td>
        <td style="${bs}">${sumIni}</td>
        <td style="${bs}">${sumRec}</td>
        <td style="${bs}">${sumDir}</td>
        <td style="${bs}">${sumSac}</td>
        <td style="${bs}">—</td>
        <td style="${bs}">—</td>
    `;

    // --- Fila 2: Total general (cant × UND) ---
    let trTotalGen = tbody.querySelector('.dep-total-gen-row');
    if (!trTotalGen) { trTotalGen = document.createElement('tr'); trTotalGen.className = 'dep-total-gen-row'; tbody.appendChild(trTotalGen); }
    const tc = sumTotal > 0 ? '#27ae60' : sumTotal < 0 ? '#e74c3c' : '#673ab7';
    const tcU = sumTotalUnid > 0 ? '#e74c3c' : sumTotalUnid < 0 ? '#e74c3c' : '#673ab7';
    trTotalGen.innerHTML = `
        <td colspan="6" style="border-top:2px solid ${tc}; background:rgba(39,174,96,0.06); font-weight:800; font-size:0.95rem; color:${tc}; text-align:right; padding:10px 12px;">
            📦 TOTALES:
        </td>
        <td style="border-top:2px solid ${tc}; background:rgba(39,174,96,0.06); font-weight:900; font-size:1.15rem; color:${tc}; text-align:center; padding:10px 16px;">
        </td>
        <td style="border-top:2px solid ${tc}; background:rgba(39,174,96,0.06); font-weight:900; font-size:1.15rem; color:${tc}; text-align:center; padding:10px 16px;">
            ${sumTotal}
        </td>
        <td style="border-top:2px solid ${tcU}; background:rgba(231,76,60,0.06); font-weight:900; font-size:1.15rem; color:${tcU}; text-align:center; padding:10px 16px;">
            ${sumTotalUnid}
        </td>
    `;
}

window.cambiarPestanaDeposito = function (tab, btn) {
    // Activar botón seleccionado
    const btns = document.querySelectorAll('.deposito-filter-btn');
    btns.forEach(b => {
        b.classList.remove('active');
        b.style.background = 'transparent';
        b.style.color = 'var(--text-muted)';
    });
    btn.classList.add('active');
    btn.style.background = '#1a237e';
    btn.style.color = 'white';

    // Mostrar contenedor correcto
    document.getElementById('deposito-arriba-container').style.display = tab === 'arriba' ? 'block' : 'none';
    document.getElementById('deposito-abajo-container').style.display = tab === 'abajo' ? 'block' : 'none';

    // Re-aplicar filtro de búsqueda en la nueva pestaña
    if (window.buscarEnDeposito) window.buscarEnDeposito();
};

window.buscarEnDeposito = function () {
    const searchInput = document.getElementById('deposito-search');
    if (!searchInput) return;
    const term = searchInput.value.toLowerCase().trim();

    const activeTabObj = document.querySelector('.deposito-filter-btn.active');
    if (!activeTabObj) return;
    const activeTab = activeTabObj.getAttribute('data-tab');

    const tableId = activeTab === 'arriba' ? 'tabla-deposito-arriba' : 'tabla-deposito-abajo';
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;

    tbody.querySelectorAll('tr.dep-data-row').forEach(tr => {
        const prodNameEl = tr.querySelector('td:nth-child(2)');
        if (!prodNameEl) return;
        const prodName = prodNameEl.textContent.toLowerCase();

        if (prodName.includes(term)) {
            tr.style.display = '';
        } else {
            tr.style.display = 'none';
        }
    });
};

window.guardarDatosDeposito = function () {
    const inputs = document.querySelectorAll('.dep-input, .dep-input-txt');
    const dataToSave = {};

    inputs.forEach(input => {
        const prodName = input.getAttribute('data-prod');
        const fieldName = input.getAttribute('data-field');
        const val = input.value;

        if (!dataToSave[prodName]) {
            dataToSave[prodName] = { unidad: '', inicial: '', recargo: '', directo: '', sacado: '' };
        }
        dataToSave[prodName][fieldName] = val;

        if (input.classList.contains('dep-input')) {
            let respVal = '[]';
            const histInput = input.nextElementSibling;
            if (histInput && histInput.classList.contains('dep-hist-data')) {
                respVal = histInput.value;
            }
            dataToSave[prodName][fieldName + '_resp'] = respVal;
        }
    });

    localStorage.setItem(DEPOSITO_SAVE_KEY, JSON.stringify(dataToSave));
    mostrarToastSistema('💾 Datos del depósito guardados correctamente.');
};

window.descargarDepositoExcel = async function () {
    try {
        if (!window.ExcelJS) {
            alert("La librería de Excel no se pudo cargar. Revisa tu conexión a internet.");
            return;
        }

        const wb = new ExcelJS.Workbook();

        // Función auxiliar para agregar hojas
        const agregarHoja = (nombreHoja, idTabla) => {
            const ws = wb.addWorksheet(nombreHoja);
            ws.columns = [
                { header: '#', key: 'idx', width: 5 },
                { header: 'Producto', key: 'prod', width: 45 },
                { header: 'UND CAJA BULT', key: 'und', width: 18 },
                { header: 'Inicial', key: 'ini', width: 12 },
                { header: 'Recargo', key: 'rec', width: 12 },
                { header: 'Directo', key: 'dir', width: 12 },
                { header: 'Sacado', key: 'sac', width: 12 },
                { header: 'Total', key: 'tot', width: 15 },
                { header: 'Total Unid', key: 'totunid', width: 15 }
            ];

            ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF34495E' } };
            ws.getRow(1).alignment = { horizontal: 'center' };

            const tbody = document.querySelector(`#${idTabla} tbody`);
            if (!tbody) return;
            const filas = Array.from(tbody.querySelectorAll('tr'));

            filas.forEach((tr, i) => {
                if (tr.querySelector('.dep-input')) {
                    const prodName = tr.children[1].textContent;

                    const getValAndResp = (field) => {
                        const input = tr.querySelector(`[data-field="${field}"]`);
                        let val = 0;
                        if (input) {
                            try {
                                const clean = (input.value || '').toString().replace(/[^0-9+\-*/.]/g, '');
                                if (clean) val = parseFloat(new Function('return ' + clean)()) || 0;
                            } catch { }
                        }
                        const histInput = tr.querySelector(`[data-histfield="${field}"]`);
                        let historyTxt = '';
                        if (histInput) {
                            try {
                                let hist = JSON.parse(histInput.value || "[]");
                                if (hist.length > 0) {
                                    historyTxt = "Historial:\n" + hist.map(h => {
                                        const dStr = h.date ? `[${h.date}] ` : '';
                                        return `${dStr}${h.resp}: ${h.sign}${h.diff}`
                                    }).join('\n');
                                }
                            } catch { }
                        }
                        return { val, history: historyTxt };
                    };

                    const iniInfo = getValAndResp('inicial');
                    const recInfo = getValAndResp('recargo');
                    const dirInfo = getValAndResp('directo');
                    const sacInfo = getValAndResp('sacado');

                    const undInput = tr.querySelector(`[data-field="unidad"]`);
                    const undVal = undInput ? undInput.value : '';

                    const tot = parseFloat(tr.querySelector('.dep-total').textContent) || 0;
                    const totUnid = parseFloat(tr.querySelector('.dep-total-unid')?.textContent || 0);

                    const newRow = ws.addRow({
                        idx: i + 1, prod: prodName,
                        und: undVal,
                        ini: iniInfo.val,
                        rec: recInfo.val,
                        dir: dirInfo.val,
                        sac: sacInfo.val,
                        tot: tot,
                        totunid: totUnid
                    });

                    // Alinear números al centro y notas
                    for (let col = 3; col <= 9; col++) {
                        let curCell = newRow.getCell(col);
                        curCell.alignment = { horizontal: 'center' };

                        if (col === 4 && iniInfo.history) curCell.note = iniInfo.history;
                        if (col === 5 && recInfo.history) curCell.note = recInfo.history;
                        if (col === 6 && dirInfo.history) curCell.note = dirInfo.history;
                        if (col === 7 && sacInfo.history) curCell.note = sacInfo.history;

                        // Aplicar color al total
                        if (col === 8) {
                            if (tot > 0) curCell.font = { color: { argb: 'FF27AE60' }, bold: true };
                            else if (tot < 0) curCell.font = { color: { argb: 'FFE74C3C' }, bold: true };
                        }
                        // Aplicar color rojo al total unid
                        if (col === 9) {
                            curCell.font = { color: { argb: 'FFE74C3C' }, bold: true };
                        }
                    }
                }
            });
        };

        // Agregar ambas hojas
        agregarHoja('Depósito Arriba', 'tabla-deposito-arriba');
        agregarHoja('Depósito Abajo', 'tabla-deposito-abajo');

        // Descargar el archivo
        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        const fecha = new Date();
        const dateStr = `${fecha.getDate()}-${fecha.getMonth() + 1}-${fecha.getFullYear()}`;
        saveAs(blob, `Control_Deposito_${dateStr}.xlsx`);

        mostrarToastSistema('✅ Reporte de Depósito exportado con éxito');
    } catch (err) {
        console.error(err);
        alert('Error al generar el Excel del depósito: ' + err.message);
    }
};
