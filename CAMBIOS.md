# Cambios y mejoras del Sistema Fénix

**Rama:** `FeriaRP`
**Último commit:** `0b86c14`
**Alcance:** endurecimiento de seguridad, funcionamiento sin Internet y HTTPS opcional.

Este documento resume qué se cambió, en qué archivos y cómo cada cambio mejora el
sistema. No incluye datos personales ni credenciales.

---

## Resumen ejecutivo

El sistema pasó de ser una aplicación local sin autenticación, con contraseñas en
texto plano y ejecución de código dinámico, a una aplicación con:

- sesión y roles validados en el servidor;
- contraseñas hasheadas y datos con permisos privados;
- catálogo de productos como datos, sin ejecución de código;
- escape de todo texto que llega al HTML;
- cero dependencias de Internet (tipografías, íconos y librerías locales);
- HTTPS opcional con certificado propio.

Los 13 hallazgos de la revisión de seguridad inicial quedaron corregidos.

---

## Fases y commits

| Commit | Fase | Alcance |
|---|---|---|
| `dead3d1` | Rutas y cuerpos | Path traversal, carpetas privadas, límite de 5 MB |
| `a9e0369` | Autenticación | Login, sesiones, roles, rate limit, CSRF |
| `efe413a` | Datos | Permisos 700/600, migración de claves, cambio de contraseña |
| `99445a5` | SEC-04 / SEC-09 | Productos en JSON y escape XSS |
| `a37d8aa` | Operación | Preferencias de inventario y comentarios |
| `0b86c14` | Cierre | SEC-11, recursos locales y HTTPS opcional |

Además, `e1b62e5` agregó el buscador de usuarios, filtro por rol y contador de
resultados en el panel.

---

## Detalle por fase

### 1. Rutas, escrituras y tamaño de peticiones (`dead3d1`)

**Qué se cambió**

- Validación de que toda ruta resuelta quede dentro del proyecto (`isInside`).
- Lista blanca de extensiones servidas: `.html`, `.js`, `.css`, imágenes y fuentes.
- Carpetas de datos personales excluidas del servidor estático:
  `registros/`, `inventarios base de datos/`, `reportes_enviados/`, `avatars/`, `tools/`.
- Límite global de cuerpo de 5 MB (`MAX_BODY_BYTES`).
- Saneado de nombres de archivo (`safeFileStem`) y de líneas de texto
  (`cleanSingleLine`) antes de escribir o registrar.

**Cómo mejora**

Evita leer archivos fuera del proyecto (`../../etc/passwd`), escribir reportes o
avatares fuera de las carpetas permitidas y agotar la memoria con un POST
gigante. Los datos personales dejan de ser accesibles por URL directa.

---

### 2. Autenticación y autorización en el servidor (`a9e0369`)

**Qué se cambió**

- `src/auth.js`: hash `scrypt` con sal, verificación en tiempo constante, sesiones
  en memoria con expiración de 12 h, cookies `HttpOnly` y `SameSite=Lax`.
- Endpoints `POST /api/login`, `POST /api/logout`, `GET /api/me`.
- `PUBLIC_API`: solo login y registro quedan sin sesión.
- `ADMIN_POST`: las acciones de administración exigen `role: admin`.
- Límite de 5 intentos fallidos por cédula e IP cada 5 minutos.
- Chequeo de `Origin` en POST (protección CSRF básica).
- `/api/users` devuelve solo cédula, nombre y rol: nunca contraseñas.
- Cliente: el ingreso usa la API y guarda únicamente datos públicos del usuario.

**Cómo mejora**

Antes cualquier persona en la red podía leer usuarios, cambiar roles o borrar
datos. Ahora el servidor decide quién entra y qué puede hacer; el cliente ya no
es la única barrera.

---

### 3. Permisos de datos, migración de claves y cambio de contraseña (`efe413a`)

**Qué se cambió**

- `umask 077`: todo archivo o carpeta nuevo nace privado.
- Carpetas `700` y archivos `600`; corrección de permisos al arrancar.
- Migración automática de contraseñas en texto plano a `scrypt`, al iniciar el
  servidor y en el primer login de cada usuario.
- `POST /api/cambiar-password`: pide la clave actual, guarda la nueva hasheada y
  cierra las demás sesiones del usuario.
- Avatares validados como imagen y guardados con permisos privados.

**Cómo mejora**

Un usuario del sistema operativo distinto al que corre Node ya no puede leer
`registros/`. Las claves viejas dejan de existir en claro sin obligar a todos a
cambiar la contraseña el mismo día.

---

### 4. Productos como datos y escape XSS (`99445a5`)

**Qué se cambió**

- El catálogo vive en `src/products.json` (23 pasillos, 886 productos).
- `src/products.js` es una plantilla: el servidor inyecta el JSON serializado.
- `src/seguridad.js`: `escHtml`, `esc`, `avatarSeguro`, `numeroSeguro`.
- Todo nombre de producto, usuario, pasillo o reporte se escapa antes de entrar
  al HTML.
- El servidor rechaza nombres con etiquetas HTML, avatares que no sean imágenes y
  pasillos con caracteres reservados.
- CSP inicial con lista blanca de CDNs.

**Cómo mejora**

Un producto o un nombre con `<script>` ya no se ejecuta en el navegador de los
demás. El catálogo se puede editar sin tocar código y sin riesgo de inyección.

---

### 5. Preferencias y comentarios (`a37d8aa`)

**Qué se cambió**

- `GET/POST /api/settings` real (antes daba 404): modo de calculadora y aviso de
  opinión al exportar.
- Configuración en `registros/settings.json`, aplicada a todos los dispositivos.
- `POST/GET /api/feedback`: comentarios de los trabajadores.
- Vista **Comentarios** solo para administradores.
- Modal de opinión una sola vez por sesión de pasillo.

**Cómo mejora**

El administrador cambia el comportamiento del sistema sin editar archivos ni
reiniciar, y las opiniones de campo quedan registradas en un lugar consultable.

---

### 6. SEC-11, recursos locales y HTTPS (`0b86c14`)

**Qué se cambió**

- `window.evaluarAritmetica` en `src/seguridad.js`: parser recursivo propio con
  precedencia, paréntesis, signos y división por cero controlada.
- Reemplaza `eval()` en la calculadora y las cuatro copias de `parseMath` en
  `sistema.js`. No queda `eval` ni `new Function`.
- Font Awesome 6.4.0, Inter, Chart.js 4.4.1, ExcelJS 4.4.0 y FileSaver 2.0.5 se
  sirven desde `src/vendor/`.
- CSP reducida a `'self'`: sin CDNs.
- HTTPS opcional: `FENIX_HTTPS=1`, puerto 8443, cookie `Secure` y HSTS.
- `tools/generar-certificado.sh`: CA local y certificado con SAN (`localhost`,
  hostname, `127.0.0.1` e IP de LAN).
- Se elimina la llamada muerta a `/api/save-excel`.
- El historial de envíos usa el usuario de la sesión y se escribe con permisos
  `600`.
- Los mensajes de error usan `location.origin` en vez de `localhost:8000`.

**Cómo mejora**

Una expresión manipulada ya no puede ejecutar JavaScript. La aplicación funciona
sin Internet y sin depender de terceros, y el tráfico puede cifrarse sin comprar
certificados.

### 7. Arranque en Windows (`7ba7d86` y siguientes)

**Qué se cambió**

- Los `.bat` trabajan siempre en su propia carpeta (`cd /d "%~dp0"`).
- Búsqueda de Node en cascada: `tools\node_portable`, `node_portable`, la raíz,
  cualquier `node.exe` dentro de `tools` y, por último, el `PATH`.
- Antes de arrancar se valida el binario con `node.exe -v`; si no responde, se
  ofrece instalar uno nuevo.
- Instalación automática: `tools\instalar-node.ps1` usa un ZIP local si existe o
  descarga la LTS oficial, verifica SHA-256 y extrae sin permisos de
  administrador.
- Se eliminó `start ... cmd /k ""node.exe" server.js"`: las comillas anidadas
  hacían que `cmd` buscara un archivo llamado literalmente `"...\node.exe"`.
- `iniciar_servidor.bat` corre Node en la misma ventana y abre el navegador con
  retardo; `iniciar_con_internet.bat` lo corre minimizado y deja el túnel SSH en
  la ventana principal.
- `donde-esta-node.bat`: diagnóstico de Node, PowerShell, `pwsh`, SSH y la IP
  local del servidor.
- Los `.bat` son ASCII puro con finales de línea CRLF, sin `choice`.
- `tools/crear-admin.js` y `crear-admin.bat`: crean o actualizan un
  administrador en `registros/` y permiten listar los usuarios existentes. Las
  cuentas no están en el repositorio, así que una copia nueva llega sin
  usuarios.

**Cómo mejora**

El primer arranque funciona en una PC sin Node y sin permisos de administrador,
y los errores de comillas y de comandos inexistentes dejan de aparecer.

---

## Hallazgos corregidos

| ID | Hallazgo | Estado |
|---|---|---|
| SEC-01 | API sin autenticación y contraseñas en claro | ✅ sesión + scrypt |
| SEC-02 | Registro permitía escalar a admin | ✅ rol fijado en servidor |
| SEC-03 | Path traversal de lectura | ✅ rutas confinadas |
| SEC-04 | Inyección de código en `products.js` | ✅ productos en JSON |
| SEC-05 | Escritura fuera de directorio | ✅ nombres saneados |
| SEC-06 | Contraseñas en claro y reutilizadas | ✅ hash y migración |
| SEC-07 | Autorización solo en cliente | ✅ roles en servidor |
| SEC-08 | Endpoints destructivos anónimos | ✅ sesión + admin |
| SEC-09 | XSS almacenado | ✅ escape en cliente y servidor |
| SEC-10 | Sin límite de tamaño en POST | ✅ 5 MB |
| SEC-11 | `eval` y `new Function` | ✅ evaluador propio |
| SEC-12 | Sin cabeceras ni SRI | ✅ CSP, assets locales |
| SEC-13 | Datos por URL directa | ✅ carpetas privadas |

---

## Antes y después

| Aspecto | Antes | Ahora |
|---|---|---|
| Contraseñas | Texto plano en JSON | `scrypt` con sal |
| Acceso a la API | Anónimo | Sesión + roles |
| Catálogo | Código JavaScript generado | JSON inyectado |
| Texto de usuarios | Se insertaba sin escapar | Escape en cliente y servidor |
| Cálculos | `eval` / `new Function` | Parser aritmético propio |
| Recursos | CDNs externos | `src/vendor/` local |
| Tráfico | HTTP plano | HTTPS opcional con CA local |
| Permisos | Legibles por cualquier usuario | `700` carpetas / `600` archivos |

---

## Verificación

```bash
# Sintaxis de todo el servidor y el cliente
node --check server.js
for f in sistema.js index.js src/*.js; do node --check "$f"; done

# No debe haber ejecución dinámica
grep -rn "\beval(\|new Function" --include=*.js . | grep -v src/vendor

# Arranque normal
node server.js

# Arranque con HTTPS
bash tools/generar-certificado.sh
FENIX_HTTPS=1 node server.js
curl --cacert certificados/fenix-ca.crt https://localhost:8443/api/me
```

---

## Despliegue

- Instancia real: `~/Documentos/servidor fenix` (HTTP, puerto 8000).
- Certificados generados en `certificados/`, listos para activar con
  `FENIX_HTTPS=1`.
- Respaldos previos: `~/Documentos/backup-fenix-*.tar.gz`.
- `registros/`, `certificados/` y las carpetas de reportes están fuera de git.

---

## Pendientes conocidos (no implementados)

1. **Integridad de datos:** escrituras atómicas con cola por archivo y lockfile de
   instancia única.
2. **Operación:** servicio systemd, health check, apagado ordenado y respaldos
   automáticos.
3. **HTTP:** timeouts, errores genéricos, caché, compresión y rate limit general.
4. **Seguridad fina:** CSP sin `unsafe-inline` y sesiones firmadas.
5. **Reportes:** evitar sobrescritura de `.xlsx` con el mismo nombre y aplicar el
   usuario de sesión también en `/api/enviar-reporte-xlsx`.

Ver `README.md` para el uso diario y la sección de seguridad.
