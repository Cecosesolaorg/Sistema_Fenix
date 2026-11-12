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

- La API no tiene autenticación ni autorización en el servidor.
- Las contraseñas se guardan y se sirven en texto plano.
- El servidor de archivos estáticos permite rutas fuera del proyecto.
- El panel de administración valida el rol solo en el navegador.

**No exponer la aplicación a Internet** hasta resolver estos puntos. Para uso en
red local, limitar el acceso a una VLAN o SSID de confianza.

Ver `REVISION-SEGURIDAD.md` para el detalle y el plan de corrección.

## Licencia

Sin licencia definida.
