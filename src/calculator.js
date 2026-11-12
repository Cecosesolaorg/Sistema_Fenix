// ============================================================
// CALCULADORA PREMIUM — 100% AUTÓNOMA (HTML + CSS + LÓGICA)
// Solo necesitas: <script src="../../src/calculator.js"></script>
// ============================================================

(function () {
    'use strict';

    // ── 1. INYECTAR CSS ──────────────────────────────────────
    const CALC_CSS = `
/* ===== PREMIUM CALCULATOR CSS ===== */
.premium-calculator {
    display: flex !important;
    background: #1a1a1a;
    width: 380px;
    max-width: 95%;
    border-radius: 1rem;
    overflow: hidden;
    box-shadow: 0 40px 80px rgba(0, 0, 0, 0.6);
    flex-direction: column;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.calc-header {
    background: #121212;
    padding: 1.25rem 1.5rem;
    border-bottom: 2px solid #222;
}

.calc-header-top {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 1rem;
}

.calc-menu-icon {
    font-size: 1.4rem;
    color: #fff;
    cursor: pointer;
    opacity: 0.8;
}

.calc-product-title {
    font-size: 1rem;
    color: #fff;
    margin: 0;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.calc-header-display {
    text-align: right;
    min-height: 80px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
}

.calc-saved-badge {
    color: #5dade2;
    font-size: 0.85rem;
    font-weight: 600;
    margin-bottom: 5px;
}

.calc-main-display {
    color: #fff;
    font-size: 3.5rem;
    font-weight: 400;
    font-family: 'Outfit', sans-serif;
    line-height: 1;
    word-break: break-all;
}

.calc-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1px;
    background: #444;
}

.calc-btn {
    background: #1c1c1c;
    border: none;
    color: #fff;
    padding: 18px 0;
    font-size: 1.2rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.1s;
    display: flex !important;
    align-items: center;
    justify-content: center;
}

.calc-btn:active { background: #333; }

.calc-btn.light { background: #232323; }

.calc-btn.math-op { font-size: 1.4rem; }

.calc-btn.spec-btn {
    background: #2a2a2a;
    color: #5dade2;
    font-weight: 800;
    font-size: 0.95rem;
}

.calc-btn.equal-btn {
    background: #5dade2;
    color: #000;
}

.calc-btn.equal-btn:active { background: #3498db; }

.calc-footer {
    display: flex;
    padding: 0;
}

.btn-calc-cancelar,
.btn-calc-guardar {
    flex: 1;
    border: none;
    padding: 20px;
    font-size: 1rem;
    font-weight: 800;
    color: #fff;
    cursor: pointer;
}

.btn-calc-cancelar { background: #8b1c1c; }
.btn-calc-guardar  { background: #58d68d; color: #000; }
.btn-calc-cancelar:active { background: #6a0000; }
.btn-calc-guardar:active  { background: #2ecc71; }

.modal-content.premium-calculator {
    display: flex !important;
    margin: auto;
}

/* Modal overlay (solo si no existe ya en tu CSS) */
#calcModal {
    display: none;
    position: fixed;
    z-index: 1000;
    left: 0; top: 0;
    width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(5px);
    align-items: center;
    justify-content: center;
}

/* CUSTOM ALERT POPUP */
.calc-alert-overlay {
    position: absolute;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 2000;
}

.calc-alert-card {
    background: #2a2a2a;
    padding: 2rem;
    border-radius: 1rem;
    border: 1px solid rgba(255,255,255,0.1);
    text-align: center;
    max-width: 80%;
    box-shadow: 0 20px 40px rgba(0,0,0,0.5);
}

.calc-alert-icon { font-size: 3rem; margin-bottom: 1rem; display: block; }
.calc-alert-text { 
    color: #fff; 
    font-size: 1.1rem; 
    line-height: 1.5; 
    margin-bottom: 1.5rem; 
    white-space: pre-wrap; 
}
.calc-alert-btn {
    background: #5dade2;
    color: #000;
    border: none;
    padding: 10px 25px;
    border-radius: 5px;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.1s;
}
.calc-alert-btn:active { transform: scale(0.95); }
`;

    const styleEl = document.createElement('style');
    styleEl.textContent = CALC_CSS;
    document.head.appendChild(styleEl);


    // ── 2. INYECTAR HTML ─────────────────────────────────────
    const CALC_HTML = `
<div id="calcModal" class="modal">
    <div class="modal-content premium-calculator">
        <header class="calc-header">
            <div class="calc-header-top">
                <span class="calc-menu-icon" id="calcMenuIcon">☰</span>
                <h3 id="calc-product-name" class="calc-product-title">PRODUCTO</h3>
                <span id="quickNotesGuardado" style="display: none; margin-left: auto; color: #5dade2; font-size: 0.85rem; font-weight: 600;">Guardado: <span id="quickNotesSavedVal">0</span></span>
            </div>
            <div class="calc-header-display" id="calcModeDisplay">
                <div class="calc-saved-badge" style="display:flex; justify-content:space-between;"><span>Guardado: </span><span id="current-saved-val">0</span></div>
                <div id="calcResult" class="calc-main-display">0</div>
            </div>
        </header>
        <div class="calc-grid" id="calcGridUI">
            <button class="calc-btn op-btn light" data-op="CE">CE</button>
            <button class="calc-btn op-btn light" data-op="C">C</button>
            <button class="calc-btn op-btn light" data-op="BS">⌫</button>
            <button class="calc-btn math-op" data-op="÷">÷</button>
            <button class="calc-btn num-btn">7</button>
            <button class="calc-btn num-btn">8</button>
            <button class="calc-btn num-btn">9</button>
            <button class="calc-btn math-op" data-op="×">×</button>
            <button class="calc-btn num-btn">4</button>
            <button class="calc-btn num-btn">5</button>
            <button class="calc-btn num-btn">6</button>
            <button class="calc-btn math-op" data-op="−">−</button>
            <button class="calc-btn num-btn">1</button>
            <button class="calc-btn num-btn">2</button>
            <button class="calc-btn num-btn">3</button>
            <button class="calc-btn math-op" data-op="+">+</button>
            <button class="calc-btn num-btn" style="grid-column:span 2">0</button>
            <button class="calc-btn num-btn">.</button>
            <button class="calc-btn equal-btn" data-op="=">=</button>
        </div>
        
        <!-- MODO NOTAS RAPIDAS -->
        <div id="quickNotesUI" style="display: none; padding: 20px; background: #161616; flex-direction: column; flex: 1;">
            <textarea id="quickNotesInput" placeholder="Ej:&#10;15&#10;20&#10;-5&#10;* 2" style="width: 100%; flex: 1; min-height: 180px; background: transparent; border: none; color: #fff; font-size: 1.2rem; resize: none; font-family: 'Outfit', sans-serif; outline: none; line-height: 1.5;"></textarea>
            
            <div style="border-top: 1px dashed #444; margin-top: 15px; padding-top: 15px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 800; font-size: 1.2rem; color: #fff;">TOTAL:</span>
                <span id="quickNotesTotal" style="font-size: 2.2rem; font-weight: 800; color: #00e676;">0</span>
            </div>
        </div>

        <footer class="calc-footer">
            <button class="btn-calc-cancelar" id="calcCancelBtn">CANCELAR</button>
            <button class="btn-calc-guardar" id="calcSaveBtn">GUARDAR</button>
        </footer>

        <!-- CUSTOM ALERT -->
        <div id="calcAlert" class="calc-alert-overlay">
            <div class="calc-alert-card">
                <span class="calc-alert-icon">⚠️</span>
                <p id="calcAlertMsg" class="calc-alert-text"></p>
                <button class="calc-alert-btn" id="calcAlertBtn">ENTENDIDO</button>
            </div>
        </div>
    </div>
</div>
`;

    // Inyectamos el modal al final del body
    document.addEventListener('DOMContentLoaded', () => {
        const container = document.createElement('div');
        container.innerHTML = CALC_HTML.trim();
        document.body.appendChild(container.firstChild);

        // Bindings de botones de footer
        document.getElementById('calcCancelBtn').addEventListener('click', () => CalcApp.close());
        document.getElementById('calcSaveBtn').addEventListener('click', () => {
            if (CalcApp.mode === 'quick_notes') {
                const parsed = CalcApp.parseQuickNotes();
                if (!parsed.isEmpty) {
                    CalcApp.tempTotal = parsed.finalTotal;
                    if (CalcApp.tempHistory !== "0" && CalcApp.tempHistory.trim() !== "") {
                        CalcApp.tempHistory = `${CalcApp.tempHistory} + (${parsed.str} = ${parsed.delta})`;
                    } else {
                        CalcApp.tempHistory = `${parsed.str} = ${parsed.delta}`;
                    }
                }
                if (window.saveCalculation) window.saveCalculation();
                CalcApp.close();
                return;
            }

            // MODO CALCULADORA
            try {
                if (CalcApp.currentExpression !== "0") {
                    CalcApp.performCalc();
                }
            } catch (err) {
                console.error("Error al calcular antes de guardar:", err);
            }
            if (window.saveCalculation) window.saveCalculation();
            CalcApp.close();
        });

        // Binding del input de notas rapidas
        const qInput = document.getElementById('quickNotesInput');
        if (qInput) {
            qInput.addEventListener('input', () => {
                if (CalcApp.mode === 'quick_notes') {
                    CalcApp.parseQuickNotes();
                }
            });
        }

        // Binding del botón de alerta
        document.getElementById('calcAlertBtn').addEventListener('click', () => CalcApp.hideAlert());

        // Binding del menú historial
        document.getElementById('calcMenuIcon').addEventListener('click', () => CalcApp.toggleHistory());
    });


    // ── 3. LÓGICA DE LA CALCULADORA ──────────────────────────
    const CalcApp = {
        tempTotal: 0,
        tempHistory: "0",
        currentExpression: "0",
        activeProduct: "",
        mode: "calculator",

        // --- UI ---
        updateUI: function () {
            const display = document.getElementById('calcResult');
            const saved = document.getElementById('current-saved-val');
            const qnSaved = document.getElementById('quickNotesSavedVal');

            if (display) display.textContent = this.currentExpression;
            if (saved) saved.textContent = this.tempTotal;
            if (qnSaved) qnSaved.textContent = this.tempTotal;
        },

        // --- ABRIR ---
        open: async function (product, currentQty, currentHistory) {
            document.body.style.overflow = 'hidden'; // Bloquear scroll del fondo
            this.activeProduct = product;
            this.tempTotal = Number(currentQty) || 0;
            this.tempHistory = currentHistory || "0";
            this.currentExpression = "0";

            try {
                const settings = await fetch('/api/settings').then(r => r.json());
                this.mode = settings.inventoryMode || 'calculator';
            } catch (e) { this.mode = 'calculator'; }

            const gridUI = document.getElementById('calcGridUI');
            const notesUI = document.getElementById('quickNotesUI');
            const calcRes = document.getElementById('calcResult');
            const headerDisp = document.getElementById('calcModeDisplay');
            const menuIcon = document.getElementById('calcMenuIcon');
            const qnGuardado = document.getElementById('quickNotesGuardado');

            if (this.mode === 'quick_notes') {
                if (gridUI) gridUI.style.display = 'none';
                if (calcRes) calcRes.style.display = 'none';
                if (headerDisp) headerDisp.style.display = 'none';
                if (menuIcon) menuIcon.style.display = 'none';
                if (qnGuardado) qnGuardado.style.display = 'inline-block';
                if (notesUI) {
                    notesUI.style.display = 'flex';
                    document.getElementById('quickNotesInput').value = '';
                    document.getElementById('quickNotesTotal').textContent = this.tempTotal;
                }
            } else {
                if (gridUI) gridUI.style.display = 'grid';
                if (calcRes) calcRes.style.display = 'block';
                if (headerDisp) headerDisp.style.display = 'flex';
                if (menuIcon) menuIcon.style.display = 'inline-block';
                if (qnGuardado) qnGuardado.style.display = 'none';
                if (notesUI) notesUI.style.display = 'none';
            }

            const title = document.getElementById('calc-product-name');
            if (title) title.textContent = product;

            this.updateUI();
            const modal = document.getElementById('calcModal');
            if (modal) {
                modal.style.setProperty('display', 'flex', 'important');
                modal.style.display = 'flex';
            }

            if (this.mode === 'quick_notes') {
                setTimeout(() => {
                    const input = document.getElementById('quickNotesInput');
                    if (input) input.focus();
                }, 100);
            }
        },

        // --- CERRAR ---
        close: function () {
            document.body.style.overflow = ''; // Habilitar scroll del fondo
            const modal = document.getElementById('calcModal');
            if (modal) {
                modal.style.setProperty('display', 'none', 'important');
                modal.style.display = 'none';
            }
        },

        // --- INPUT (botones) ---
        handleInput: function (val, op) {
            if (op === 'C' || op === 'CE') {
                this.currentExpression = "0";
            } else if (op === 'BS') {
                this.currentExpression = this.currentExpression.length > 1
                    ? this.currentExpression.slice(0, -1)
                    : "0";
            } else if (op === '=') {
                this.performCalc();
                return;
            } else {
                this.currentExpression = (this.currentExpression === "0" && !isNaN(val))
                    ? val
                    : this.currentExpression + val;
            }
            this.updateUI();
        },

        // --- CALCULAR ---
        performCalc: function () {
            try {
                if (this.currentExpression === "0") return;

                let expr = this.currentExpression
                    .replace(/×/g, '*')
                    .replace(/÷/g, '/')
                    .replace(/−/g, '-')
                    .replace(/,/g, '.');

                let res = eval(expr);
                if (!isNaN(res)) {
                    let oldTotal = Number(this.tempTotal) || 0;
                    this.tempTotal = oldTotal + res;

                    // --- 🚩 FORMATO ACUMULADO CON PARÉNTESIS SÓLO PARA MULTIPLICACIÓN 🚩 ---
                    const visualExpr = this.currentExpression.replace(/×/g, 'x');
                    const isMult = visualExpr.toLowerCase().includes('x');

                    if (this.tempHistory !== "0" && this.tempHistory.trim() !== "") {
                        if (isMult) {
                            // Con PARÉNTESIS para resaltar el bulto/multiplicación
                            this.tempHistory = `${this.tempHistory} + (${visualExpr} = ${this.tempTotal})`;
                        } else {
                            // SIN PARÉNTESIS para sumas simples
                            this.tempHistory = `${this.tempHistory} + ${visualExpr} = ${this.tempTotal}`;
                        }
                    } else {
                        // Caso inicial: Solo Operación = Resultado (sin paréntesis nunca al inicio)
                        this.tempHistory = `${visualExpr} = ${this.tempTotal}`;
                    }

                    this.currentExpression = "0";
                }

            } catch (e) {
                alert("Operación inválida");
            }
            this.updateUI();

        },

        // --- NOTAS RAPIDAS LOGIC ---
        parseQuickNotes: function () {
            const text = document.getElementById('quickNotesInput').value;
            const lines = text.split('\n');
            let sum = 0;
            let currentStr = "";
            let isEmpty = true;

            for (let line of lines) {
                let l = line.trim().replace(/x/gi, '*');
                if (!l) continue;
                isEmpty = false;

                if (/^[\*\/]\s*\d+/.test(l)) {
                    try {
                        let num = parseFloat(l.replace(/[^\d\.]/g, ''));
                        if (l.startsWith('*')) { sum = sum * num; currentStr += ` * ${num}`; }
                        else if (l.startsWith('/')) { sum = sum / num; currentStr += ` / ${num}`; }
                    } catch (e) { }
                } else if (/^[+\-]\s*\d+/.test(l)) {
                    try {
                        let num = parseFloat(l.replace(/\s+/g, ''));
                        sum += num;
                        currentStr += ` ${num > 0 ? '+' + num : num}`;
                    } catch (e) { }
                } else {
                    try {
                        let num = parseFloat(l);
                        if (!isNaN(num)) {
                            sum += num;
                            currentStr += (currentStr ? ` + ${num}` : `${num}`);
                        }
                    } catch (e) { }
                }
            }

            const finalTotal = this.tempTotal + sum;
            document.getElementById('quickNotesTotal').textContent = finalTotal;
            return { delta: sum, str: currentStr, finalTotal, isEmpty };
        },

        // --- GUARDAR ---
        save: function (onSaveCallback) {
            // Ya no bloqueamos si currentExpression !== "0" porque lo manejamos en el evento click
            if (onSaveCallback) onSaveCallback(this.activeProduct, this.tempTotal, this.tempHistory);
            this.close();
        },

        // --- ALERTA PERSONALIZADA ---
        showAlert: function (msg) {
            const alertEl = document.getElementById('calcAlert');
            const msgEl = document.getElementById('calcAlertMsg');
            if (alertEl && msgEl) {
                msgEl.textContent = msg;
                alertEl.style.display = 'flex';
            }
        },

        hideAlert: function () {
            const alertEl = document.getElementById('calcAlert');
            if (alertEl) alertEl.style.display = 'none';
        },

        // --- HISTORIAL ---
        toggleHistory: function () {
            this.showAlert("HISTORIAL:\n" + this.tempHistory);
        }
    };


    // ── 4. BIND BOTONES DE LA GRID ───────────────────────────
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('calc-btn')) {
            const btn = e.target;
            CalcApp.handleInput(btn.textContent, btn.dataset.op);
        }
    });


    // ── 5. EXPONER GLOBALES ──────────────────────────────────
    window.CalcApp = CalcApp;
    window.closeCalculator = () => CalcApp.close();
    window.toggleCalcHistory = () => CalcApp.toggleHistory();

})();
