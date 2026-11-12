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

            const LOCAL_EXCEL = "/src/exceljs.min.js";
            const LOCAL_SAVER = "/src/FileSaver.min.js";
            const CDN_EXCEL = "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js";
            const CDN_SAVER = "https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js";

            const loadScript = (localUrl, cdnUrl) => new Promise((res, rej) => {
                const s = document.createElement('script');
                s.src = localUrl;
                s.onload = () => { console.log("✅ Cargado local:", localUrl); res(); };
                s.onerror = () => {
                    console.warn("⚠️ Local falló, intentando CDN:", cdnUrl);
                    const s2 = document.createElement('script');
                    s2.src = cdnUrl;
                    s2.onload = () => { console.log("✅ Cargado CDN:", cdnUrl); res(); };
                    s2.onerror = () => rej("Error cargando: " + cdnUrl);
                    document.head.appendChild(s2);
                };
                document.head.appendChild(s);
            });

            Promise.all([
                loadScript(LOCAL_EXCEL, CDN_EXCEL),
                loadScript(LOCAL_SAVER, CDN_SAVER)
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

            // --- ENVIAR AL SERVIDOR PARA GUARDAR EL UNIFICADO ---
            try {
                fetch('/api/save-excel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ aisleName: aisleTitle, responsable, companero, ayudante, products: productsToWrite, inventoryData })
                }).catch(() => { });
            } catch (e) { }

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
