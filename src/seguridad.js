// ─── AYUDAS DE SEGURIDAD PARA EL CLIENTE ────────────────────────────────────
// El servidor valida y guarda los datos; estas funciones son la segunda capa
// para que nada de lo que llega se interprete como HTML.
(function () {
    const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

    /** Escapa texto para insertarlo dentro de innerHTML (contenido o atributo). */
    window.escHtml = function (valor) {
        return String(valor === null || valor === undefined ? '' : valor).replace(/[&<>"']/g, function (c) {
            return ENTIDADES[c];
        });
    };

    // Alias corto para las plantillas.
    window.esc = window.escHtml;

    /** Solo acepta data URLs de imagen: sirve para los avatares. */
    window.avatarSeguro = function (valor) {
        const texto = String(valor === null || valor === undefined ? '' : valor);
        return /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(texto) ? texto : '';
    };

    /** Número entero acotado, para cantidades que vienen de reportes. */
    window.numeroSeguro = function (valor) {
        const n = Number(valor);
        if (!Number.isFinite(n)) return '';
        return String(Math.trunc(n));
    };

    /**
     * Evalúa aritmética básica sin eval ni new Function.
     * Acepta números, + - * / y paréntesis. Devuelve null si no es válida.
     */
    window.evaluarAritmetica = function (expresion) {
        let texto = String(expresion === null || expresion === undefined ? '' : expresion)
            .replace(/×/g, '*')
            .replace(/÷/g, '/')
            .replace(/−/g, '-')
            .replace(/,/g, '.')
            .replace(/\s+/g, '');

        if (!texto || !/^[0-9+\-*/().]+$/.test(texto)) return null;

        let i = 0;

        function falla() { throw new Error('expresión inválida'); }

        function numero() {
            const resto = texto.slice(i);
            const m = /^(?:\d+(?:\.\d+)?|\.\d+)/.exec(resto);
            if (!m) falla();
            i += m[0].length;
            return parseFloat(m[0]);
        }

        function factor() {
            if (texto[i] === '+') { i++; return factor(); }
            if (texto[i] === '-') { i++; return -factor(); }
            if (texto[i] === '(') {
                i++;
                const valor = suma();
                if (texto[i] !== ')') falla();
                i++;
                return valor;
            }
            return numero();
        }

        function termino() {
            let valor = factor();
            while (texto[i] === '*' || texto[i] === '/') {
                const op = texto[i++];
                const divisor = factor();
                if (op === '*') {
                    valor *= divisor;
                } else {
                    if (divisor === 0) falla();
                    valor /= divisor;
                }
            }
            return valor;
        }

        function suma() {
            let valor = termino();
            while (texto[i] === '+' || texto[i] === '-') {
                const op = texto[i++];
                const siguiente = termino();
                valor = op === '+' ? valor + siguiente : valor - siguiente;
            }
            return valor;
        }

        try {
            const resultado = suma();
            if (i !== texto.length || !Number.isFinite(resultado)) return null;
            return resultado;
        } catch (e) {
            return null;
        }
    };
})();
