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
| Cabeceras de seguridad | ✅ `nosniff`, `DENY`, `no-referrer` (`SEC-12`) |
| Autenticación y autorización en el servidor | ✅ sesión + roles (`SEC-01`, `SEC-02`, `SEC-07`, `SEC-08`) |
| Contraseñas | ✅ scrypt en reposo; nunca se envían al cliente (`SEC-06`) |
| Cifrado en tránsito | ❌ HTTP plano en la red local |
| Productos en código ejecutable | ❌ pendiente (`SEC-04`) |
| XSS en el panel | ❌ pendiente (`SEC-09`) |

### Cómo funciona el acceso

- `POST /api/login` valida cédula y contraseña en el servidor y devuelve una
  cookie `HttpOnly`, `SameSite=Lax`, válida 12 horas.
- La contraseña nunca llega al navegador ni se guarda en `localStorage`.
- `GET /api/users` exige sesión y devuelve solo nombre, cédula y rol.
- Las acciones de administración (roles, expulsiones, pasillos, historial)
  exigen rol `admin` en el servidor.
- Hay límite de 5 intentos fallidos por cédula y IP cada 5 minutos.
- Las contraseñas en texto plano de versiones anteriores se convierten a hash
  (`scrypt`) automáticamente la primera vez que cada usuario inicia sesión.

**No exponer la aplicación a Internet** mientras use HTTP plano. Para uso en red
local, limitar el acceso a una VLAN o SSID de confianza.

Ver `REVISION-SEGURIDAD.md` para el detalle y el plan de corrección.

## Licencia

Sin licencia definida.
