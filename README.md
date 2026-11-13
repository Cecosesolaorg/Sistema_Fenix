# Sistema Fénix

Sistema de inventario para pasillos y depósitos, con conteo por código de barras,
registro de responsables, cierre de pasillos y exportación de reportes a Excel.

## Requisitos

- Node.js 18 o superior (funciona con Node portable de Windows).
- No usa dependencias npm: solo módulos nativos (`http`, `fs`, `path`, `os`).

## Cómo ejecutarlo

```bash
node server.js
```

Queda escuchando en el puerto **8000**:

```text
http://localhost:8000
http://<IP-de-la-máquina>:8000
```

En Windows hay dos accesos directos:

| Archivo | Qué hace |
|---|---|
| `iniciar_servidor.bat` | levanta el servidor en la red local |
| `iniciar_con_internet.bat` | levanta el servidor y abre un túnel SSH con Serveo |

> El túnel publica la aplicación en Internet **sin autenticación**. No usarlo en
> producción.

## Estructura

```text
server.js          Servidor HTTP y API (sin dependencias)
index.html/js      Ingreso y registro de usuarios
pasillo.html       Conteo por pasillo
sistema.html/js    Panel de administración
app.js             Lógica del panel
styles.css         Estilos
src/               Estado, productos, sesión, exportación a Excel
registros/         Usuarios y avatares (datos locales, fuera de git)
inventarios base de datos/   Reportes generados (datos locales, fuera de git)
```

## Datos

`registros/`, `inventarios base de datos/` y `reportes_enviados/` contienen datos
personales y credenciales. Están en `.gitignore` y **no deben subirse al
repositorio**.

## Seguridad

Estado actual del proyecto:

| Área | Estado |
|---|---|
| Rutas de archivos estáticos y descargas | ✅ restringidas al proyecto (`SEC-03`) |
| Nombres de archivo al escribir (avatares, reportes) | ✅ saneados (`SEC-05`) |
| Tamaño de las peticiones POST | ✅ límite de 5 MB (`SEC-10`) |
| Cabeceras de seguridad | ✅ `nosniff`, `DENY`, `no-referrer` y CSP (`SEC-12`) |
| Autenticación y autorización en el servidor | ✅ sesión + roles (`SEC-01`, `SEC-02`, `SEC-07`, `SEC-08`) |
| Contraseñas | ✅ scrypt en reposo; nunca se envían al cliente (`SEC-06`) |
| Migración de claves viejas | ✅ a hash al arrancar y al primer login |
| Permisos de los datos | ✅ carpetas `700`, archivos `600` |
| Cambio de contraseña | ✅ desde el perfil, con la clave actual |
| Cifrado en tránsito | ❌ HTTP plano en la red local |
| Productos en código ejecutable | ✅ datos en JSON, nunca se evalúan (`SEC-04`) |
| XSS en el panel | ✅ escape en cliente y validación en servidor (`SEC-09`) |

### Cómo funciona el acceso

- `POST /api/login` valida cédula y contraseña en el servidor y devuelve una
  cookie `HttpOnly`, `SameSite=Lax`, válida 12 horas.
- La contraseña nunca llega al navegador ni se guarda en `localStorage`.
- `GET /api/users` exige sesión y devuelve solo nombre, cédula y rol.
- Las acciones de administración (roles, expulsiones, pasillos, historial)
  exigen rol `admin` en el servidor.
- El catálogo de productos vive en `src/products.json`. `src/products.js` es
  una plantilla: el servidor inyecta los datos serializados como JSON, así que
  un nombre de producto nunca se ejecuta como código.
- Todo texto que viene de usuarios, reportes o configuración se escapa antes
  de insertarse en el HTML (`src/seguridad.js`). El servidor además rechaza
  nombres con etiquetas HTML, avatares que no sean imágenes y pasillos con
  caracteres reservados.
- El panel tiene **Preferencias de inventario** (solo admin): modo de la
  calculadora y si se pide opinión al exportar. Se guardan en
  `registros/settings.json` y se aplican a todos los teléfonos.
- Los comentarios que dejan los trabajadores se guardan en
  `registros/feedback.json` y se leen en **Comentarios** (solo admin).
- Hay límite de 5 intentos fallidos por cédula y IP cada 5 minutos.
- Las contraseñas en texto plano de versiones anteriores se convierten a hash
  (`scrypt`) automáticamente al arrancar el servidor y también la primera vez
  que cada usuario inicia sesión.
- Cada usuario puede cambiar su contraseña desde **Mi Perfil → Cambiar
  contraseña**; el servidor pide la clave actual y cierra las demás sesiones.
- `registros/`, `inventarios base de datos/` y `reportes_enviados/` quedan con
  permisos `700` (carpetas) y `600` (archivos): solo el usuario que corre el
  servidor puede leerlos. Los archivos nuevos nacen con esos permisos.

La política de seguridad de contenido (CSP) solo permite scripts y estilos
propios y de los CDN usados (`cdn.jsdelivr.net`, `cdnjs.cloudflare.com`,
`fonts.googleapis.com`, `fonts.gstatic.com`).

**No exponer la aplicación a Internet** mientras use HTTP plano. Para uso en red
local, limitar el acceso a una VLAN o SSID de confianza.

Ver `REVISION-SEGURIDAD.md` para el detalle y el plan de corrección.

## Licencia

Sin licencia definida.
