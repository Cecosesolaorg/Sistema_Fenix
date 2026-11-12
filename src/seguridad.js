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
})();
