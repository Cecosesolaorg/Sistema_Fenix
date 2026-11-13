// --- EXPORT TO EXCEL PREMIUM LOGIC WITH LAZY-LOADING ---
window.ExportApp = {
    _loadLibraries: function () {
        return new Promise((resolve, reject) => {
            // Si ya están cargadas, resolver inmediatamente
            if (window.ExcelJS && window.saveAs) {
                console.log("✅ Librerías ya disponibles.");
                return resolve();
            }

            console.log("📦 Cargando librerías locales...");

            const LIB_EXCEL = "/src/vendor/exceljs.min.js";
            const LIB_SAVER = "/src/vendor/FileSaver.min.js";

            // Todo se sirve desde el propio servidor: la red local puede estar
            // sin Internet y no hay dependencias de terceros.
            const loadScript = (url) => new Promise((res, rej) => {
                const s = document.createElement('script');
                s.src = url;
                s.onload = () => { console.log("✅ Cargado:", url); res(); };
                s.onerror = () => rej(new Error("No se pudo cargar " + url));
                document.head.appendChild(s);
            });

            Promise.all([
                loadScript(LIB_EXCEL),
                loadScript(LIB_SAVER)
            ]).then(resolve).catch(reject);
        });
    },

    downloadAisle: async function (aisleTitle, responsable, companero, products, inventoryData, options = {}) {
        // Skip validation if called from Coordination (where inventoryData might be empty)
        const isCoord = (companero === "SISTEMA" || aisleTitle === "COORDINACIÓN");

        if (!isCoord) {
            // Validation: All items with qty > 0 must be marked Green (state 1)
            const redsWithQty = products.filter(p => {
                const d = inventoryData[p];
                if (!d) return false;
                const qty = parseFloat(d.qty || 0);
                // Si el producto tiene cantidad, permitimos descargar solo si está en Verde (1).
                // Si está en 0 (Rojo) o 2 (Naranja), bloqueamos.
                return (qty > 0 && d.checkState !== 1);
            });


            if (redsWithQty.length > 0) {
                const list = redsWithQty.slice(0, 3).join(", ") + (redsWithQty.length > 3 ? "..." : "");
                window.InventoryCore.showErrorModal("❌ PRODUCTOS EN ROJO",
                    `No puedes descargar porque tienes ${redsWithQty.length} productos con cantidad que siguen en ROJO.\n\n` +
                    `Ejemplos: ${list}\n\n` +
                    `Por favor, márcalos en VERDE antes de continuar.`);
                return;
            }
        }

        const downloadBtn = document.getElementById('downloadBtn');
        const originalText = downloadBtn ? downloadBtn.innerHTML : "📥 Descargar";

        try {
            // --- 🔄 SINCRONIZACIÓN EXPRESS ANTES DE DESCARGAR ---
            if (window.InventoryCore && window.InventoryCore.triggerSync) {
                const localId = aisleTitle.match(/\d+/)?.[0] || "1";
                const localData = JSON.parse(localStorage.getItem('inventoryData_P' + localId) || "{}");
                window.InventoryCore.triggerSync(aisleTitle, localData, "DESCARGANDO");
                // Pequeña espera para que el fetch termine y guarde en lastServerInventory
                await new Promise(r => setTimeout(r, 800));
            }

            // Lazy load before continuing
            if (options.skipDownload && downloadBtn) {
                downloadBtn.innerHTML = "⏳ ENVIANDO...";
            } else if (downloadBtn) {
                downloadBtn.innerHTML = "⏳ CARGANDO...";
            }

            try {
                await this._loadLibraries();
            } catch (e) {
                alert("⚠️ Error de conexión: No se pudieron cargar las librerías de Excel. Revisa tu internet.");
                if (downloadBtn) downloadBtn.innerHTML = originalText;
                return;
            }

            if (options.skipDownload && downloadBtn) {
                downloadBtn.innerHTML = "⚙️ PROCESANDO...";
            } else if (downloadBtn) {
                downloadBtn.innerHTML = "⚙️ GENERANDO...";
            }

            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet('Inventario');

            // Style Helpers (Match photo)
            const darkGreen = 'FF1B5E20';
            const midGreen = 'FF2E7D32';
            const white = 'FFFFFFFF';
            const tableHeaderGreen = 'FF388E3C';

            const myName = responsable.trim().toUpperCase();
            // --- 📊 REPORTE INDIVIDUAL PARA EL TELÉFONO ---
            ws.columns = [
                { header: '', key: 'colA', width: 45 }, // PRODUCTO
                { header: '', key: 'colB', width: 50 }, // HISTORIAL
                { header: '', key: 'colE', width: 14 }  // TOTAL UND
            ];

            const borderStyle = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };

            // 1. Cabecera Principal
            const r1 = ws.getRow(1); r1.height = 30; ws.mergeCells('A1:C1');
            r1.getCell(1).value = "📋 REPORTE DE INVENTARIO CECOSESOLA J-085030140 📋";
            r1.getCell(1).style = { font: { bold: true, color: { argb: white } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: darkGreen } }, alignment: { horizontal: 'center', vertical: 'middle' } };
            for (let i = 1; i <= 3; i++) { r1.getCell(i).border = borderStyle; }

            // 2. Cabecera Pasillo
            const r2 = ws.getRow(2); r2.height = 25; ws.mergeCells('A2:C2');
            r2.getCell(1).value = ` 🛒 ${aisleTitle} 🛒`;
            r2.getCell(1).style = { font: { bold: true, color: { argb: white } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: midGreen } }, alignment: { horizontal: 'center', vertical: 'middle' } };
            for (let i = 1; i <= 3; i++) { r2.getCell(i).border = borderStyle; }

            // 3. Metadatos (Buscamos compañero en cache local)
            const ayudante = localStorage.getItem('ayudante') || "SIN AYUDA";
            const selectedPartner = localStorage.getItem('companero') || "";
            let lastData = {};
            try {
                const raw = localStorage.getItem('lastServerInventory');
                if (raw && raw !== "undefined" && raw !== "null") {
                    lastData = JSON.parse(raw) || {};
                }
            } catch (e) { console.warn("Cache corrupto"); }
            const userInv = lastData.userInventory || {};
            const myAisleRaw = (localStorage.getItem('assignedAisle') || aisleTitle || "").trim().toUpperCase();
            const pNum = myAisleRaw.match(/\d+/)?.[0];

            let partnerData = null;
            let pName = (companero && companero !== "SIN COMPAÑERO") ? companero : (selectedPartner || "---"); // Priorizar el argumento pasado

            // Aún buscamos los DATOS en el servidor por si el nombre seleccionado tiene stock
            Object.keys(userInv).forEach(ak => {
                if (pNum && ak.includes(pNum)) {
                    const users = userInv[ak];
                    const foundKey = Object.keys(users).find(u => u.trim().toUpperCase() === pName.trim().toUpperCase());
                    if (foundKey) {
                        partnerData = users[foundKey];
                    } else {
                        // Si el nombre exacto no tiene datos, buscar a CUALQUIER otro para comparar DIF
                        const otherCandidate = Object.keys(users).find(u => u.trim().toUpperCase() !== responsable.trim().toUpperCase());
                        if (otherCandidate && !partnerData) {
                            partnerData = users[otherCandidate];
                            if (!pName || pName === "---") pName = otherCandidate;
                        }
                    }
                }
            });

            // Calculate total counted before meta
            const totalCounted = Object.values(inventoryData).filter(d => parseFloat(d.qty || 0) > 0).length;

            const meta = [
                ["FECHA", new Date().toLocaleDateString()],
                ["RESPONSABLE", responsable.toUpperCase()],
                ["COMPAÑERO", pName.toUpperCase()]
            ];

            if (ayudante && ayudante !== "SIN AYUDA" && ayudante.trim() !== "") {
                meta.push(["AYUDANTE", ayudante.toUpperCase()]);
            }

            meta.push(["PRODUCTOS CONTADOS", totalCounted.toString()]);

            meta.forEach((m, i) => {
                const r = ws.getRow(3 + i);
                r.getCell(1).value = m[0];
                r.getCell(2).value = m[1];
                r.getCell(1).font = { bold: true };
                r.getCell(1).border = borderStyle;
                ws.mergeCells(`B${3 + i}:C${3 + i}`);
                for (let j = 2; j <= 3; j++) { r.getCell(j).border = borderStyle; }
            });

            // 4. Encabezados Tabla (3 COLUMNAS)
            const rH = ws.getRow(9); rH.height = 25;
            ["✊ PRODUCTO", "HISTORIAL", "TOTAL UND"].forEach((h, i) => {
                const c = rH.getCell(i + 1); c.value = h;
                c.style = {
                    font: { bold: true, color: { argb: white } },
                    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A237E' } },
                    alignment: { horizontal: 'center' },
                    border: borderStyle
                };
            });

            // --- 📊 FILTRADO Y ORDEN ALFABÉTICO 📊 ---
            // 1. Obtener lista base: Solo lo que tiene existencia (mía o del socio)
            let productsToWrite = products.filter(p => {
                const myQty = parseFloat((inventoryData[p] || {}).qty || 0);
                const partnerQty = partnerData ? parseFloat((partnerData[p] || {}).qty || 0) : 0;
                return (myQty > 0 || partnerQty > 0);
            });

            // 2. ORDEN ALFABÉTICO (A-Z) 🔤
            productsToWrite.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

            // 3. ESCRIBIR FILAS
            productsToWrite.forEach((p, idx) => {

                const d = inventoryData[p] || { qty: 0, und: 1, totalUnd: 0, history: "0" };
                const r = ws.getRow(10 + idx);
                const qRaw = parseFloat(d.qty || 0);
                const undVal = d.und || 1;
                const totalUndVal = d.totalUnd || (qRaw * undVal);

                r.getCell(1).value = p;
                r.getCell(2).value = (d.history || "0").toString();
                r.getCell(3).value = totalUndVal;

                if (partnerData) {
                    const partnerEntry = partnerData[p] || Object.values(partnerData).find(v => v.productName === p);
                    const pqRaw = partnerEntry ? parseFloat(partnerEntry.qty || 0) : 0;
                    const diff = qRaw - pqRaw;

                    if (Math.abs(diff) < 0.0001) {
                        r.getCell(1).font = { color: { argb: 'FF4CAF50' }, bold: true };
                    } else {
                        r.getCell(1).font = { color: { argb: 'FFFF0000' }, bold: true };
                    }
                } else {
                    r.getCell(1).font = { bold: true };
                }

                for (let i = 1; i <= 3; i++) {
                    r.getCell(i).border = borderStyle;
                    if (i > 1) r.getCell(i).alignment = { horizontal: 'center' };
                }
            });



            const buffer = await wb.xlsx.writeBuffer();
            const fileName = `${aisleTitle} - ${responsable.toUpperCase()}.xlsx`;
            if (!options.skipDownload) {
                saveAs(new Blob([buffer]), fileName);
            }

            if (downloadBtn) downloadBtn.innerHTML = originalText;

            // --- 🌟 DISPARAR FEEDBACK AL MOMENTO 🌟 ---
            // Consultamos al servidor en tiempo real para saber si el jefe activó el switch
            fetch('/api/settings').then(r => r.json()).then(settings => {
                if (settings && settings.enableFeedback) {
                    try {
                        const loggedUserStr = localStorage.getItem('loggedUser');
                        const loggedUser = loggedUserStr ? JSON.parse(loggedUserStr) : {};
                        const aisleName = document.querySelector('.aisle-title')?.innerText || aisleTitle || "PASILLO";
                        const username = loggedUser.username || localStorage.getItem('responsableDirecto') || "TRABAJADOR";

                        if (window.InventoryCore && window.InventoryCore.showFeedbackModal) {
                            window.InventoryCore.showFeedbackModal(aisleName, username);
                        }
                    } catch (err) { console.error("Error modal:", err); }
                }
            }).catch(err => console.error("Error cargando settings feedback:", err));

            // --- DESCARGA COMPLETADA ---
            console.log("✅ Descarga de Excel finalizada correctamente.");

            // Devolver el buffer si se solicitó
            if (options.returnBuffer) {
                return { buffer, fileName };
            }

        } catch (error) {
            console.error("❌ ERROR CRÍTICO EN EXCEL:", error);
            alert("⚠️ Error al generar el Excel: " + error.message);
            if (downloadBtn) downloadBtn.innerHTML = originalText;
        }
    }
};


// ── MODAL DE OPINIÓN DEL TRABAJADOR ─────────────────────────────────────────
// Se muestra al exportar un Excel si el admin activó «Pedir opinión».
window.InventoryCore = window.InventoryCore || {};

window.InventoryCore.showFeedbackModal = function (pasillo, usuario) {
    if (document.getElementById('fenix-feedback-overlay')) return;
    // Una sola vez por sesión de pasillo: descargar y enviar no preguntan dos veces.
    if (window.__feedbackMostrado) return;
    window.__feedbackMostrado = true;

    const overlay = document.createElement('div');
    overlay.id = 'fenix-feedback-overlay';
    overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px); z-index: 9500; display: flex; align-items: center; justify-content: center; padding: 20px;';

    const card = document.createElement('div');
    card.style.cssText = 'width: 100%; max-width: 420px; background: #1a1a2e; color: #fff; border-radius: 18px; padding: 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.5);';

    const titulo = document.createElement('h3');
    titulo.textContent = '¿Cómo te fue en el pasillo?';
    titulo.style.cssText = 'margin: 0 0 6px 0; font-size: 1.15rem; color: #f1c40f;';

    const sub = document.createElement('p');
    sub.textContent = pasillo ? `Pasillo: ${pasillo}` : usuario ? `Gracias, ${usuario}.` : 'Contanos si algo faltó o falló.';
    sub.style.cssText = 'margin: 0 0 14px 0; font-size: 0.85rem; color: #bbb;';

    const area = document.createElement('textarea');
    area.placeholder = 'Ej: faltaban productos, el escáner no leyó bien, etc.';
    area.style.cssText = 'width: 100%; min-height: 110px; padding: 12px; border-radius: 10px; border: 1px solid #333; background: #111; color: #fff; font-family: inherit; font-size: 0.95rem; resize: vertical; outline: none; box-sizing: border-box;';

    const fila = document.createElement('div');
    fila.style.cssText = 'display: flex; gap: 10px; margin-top: 16px;';

    const omitir = document.createElement('button');
    omitir.type = 'button';
    omitir.textContent = 'Ahora no';
    omitir.style.cssText = 'flex: 1; padding: 12px; border-radius: 10px; border: 1px solid #444; background: transparent; color: #ccc; font-weight: 600; cursor: pointer;';

    const enviar = document.createElement('button');
    enviar.type = 'button';
    enviar.textContent = 'Enviar';
    enviar.style.cssText = 'flex: 1; padding: 12px; border-radius: 10px; border: none; background: #27ae60; color: #fff; font-weight: 700; cursor: pointer;';

    const estado = document.createElement('p');
    estado.style.cssText = 'margin: 10px 0 0 0; font-size: 0.8rem; color: #f39c12; min-height: 1em;';

    const cerrar = () => overlay.remove();
    omitir.addEventListener('click', cerrar);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });

    enviar.addEventListener('click', async () => {
        const mensaje = area.value.trim();
        if (!mensaje) {
            estado.textContent = 'Escribí algo o tocá «Ahora no».';
            area.focus();
            return;
        }

        enviar.disabled = true;
        omitir.disabled = true;
        enviar.textContent = 'Enviando...';

        try {
            const res = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pasillo: pasillo || '', mensaje })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'No se pudo enviar');

            estado.style.color = '#27ae60';
            estado.textContent = '¡Gracias! Comentario enviado.';
            setTimeout(cerrar, 900);
        } catch (e) {
            estado.style.color = '#e74c3c';
            estado.textContent = e.message;
            enviar.disabled = false;
            omitir.disabled = false;
            enviar.textContent = 'Enviar';
        }
    });

    fila.appendChild(omitir);
    fila.appendChild(enviar);
    card.appendChild(titulo);
    card.appendChild(sub);
    card.appendChild(area);
    card.appendChild(fila);
    card.appendChild(estado);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    area.focus();
};

// Autocompletar el evento del botón si existe
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('downloadBtn');
    if (btn) {
        btn.onclick = () => {
            const aisleId = document.querySelector('.aisle-title')?.innerText || "PASILLO";
            const resp = localStorage.getItem('responsableDirecto') || "INV";
            const comp = localStorage.getItem('companero') || "";
            document.dispatchEvent(new CustomEvent('requestDownload'));
        };
    }
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.onclick = () => {
            const aisleId = document.querySelector('.aisle-title')?.innerText || "PASILLO";
            const resp = localStorage.getItem('responsableDirecto') || "INV";
            const comp = localStorage.getItem('companero') || "";
            document.dispatchEvent(new CustomEvent('requestSend'));
        };
    }
});
