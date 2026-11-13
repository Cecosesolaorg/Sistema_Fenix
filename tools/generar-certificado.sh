#!/usr/bin/env bash
# ─── Certificados HTTPS para Fénix ──────────────────────────────────────────
# Crea una CA local y un certificado de servidor con la IP de esta máquina.
# Los dispositivos deben confiar una vez en certificados/fenix-ca.crt.
#
# Uso:  bash tools/generar-certificado.sh
# Luego: FENIX_HTTPS=1 node server.js
# ────────────────────────────────────────────────────────────────────────────
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="$RAIZ/certificados"

if ! command -v openssl >/dev/null 2>&1; then
    echo "❌ Falta openssl. Instalalo (por ejemplo: sudo dnf install openssl)."
    exit 1
fi

mkdir -p "$DIR"
chmod 700 "$DIR"

# IP de la red local (la misma que imprime el servidor)
IP_LAN="$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')" || true
if [ -z "${IP_LAN:-}" ]; then
    IP_LAN="$(hostname -I 2>/dev/null | awk '{print $1}')" || true
fi
if [ -z "${IP_LAN:-}" ]; then
    IP_LAN="127.0.0.1"
fi
NOMBRE_HOST="$(hostname 2>/dev/null || echo fenix)"

echo "→ Carpeta:      $DIR"
echo "→ IP local:     $IP_LAN"
echo "→ Hostname:     $NOMBRE_HOST"

# 1. Autoridad certificadora local (10 años)
if [ ! -f "$DIR/fenix-ca.crt" ] || [ ! -f "$DIR/fenix-ca-key.pem" ]; then
    echo "→ Creando CA local…"
    openssl genrsa -out "$DIR/fenix-ca-key.pem" 4096
    openssl req -x509 -new -nodes -key "$DIR/fenix-ca-key.pem" -sha256 -days 3650 \
        -out "$DIR/fenix-ca.crt" \
        -subj "/C=VE/O=Cecosesola/OU=Fenix/CN=Fenix CA local"
else
    echo "→ Reutilizando CA existente."
fi

# 2. Clave y certificado del servidor (2 años)
echo "→ Creando certificado del servidor…"
openssl genrsa -out "$DIR/fenix-key.pem" 2048

cat > "$DIR/ext.cnf" <<EOF
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = DNS:localhost, DNS:$NOMBRE_HOST, IP:127.0.0.1, IP:$IP_LAN
EOF

openssl req -new -key "$DIR/fenix-key.pem" -out "$DIR/server.csr" \
    -subj "/C=VE/O=Cecosesola/OU=Fenix/CN=$IP_LAN"

openssl x509 -req -in "$DIR/server.csr" \
    -CA "$DIR/fenix-ca.crt" -CAkey "$DIR/fenix-ca-key.pem" -CAcreateserial \
    -out "$DIR/fenix-cert.pem" -days 825 -sha256 -extfile "$DIR/ext.cnf"

rm -f "$DIR/server.csr" "$DIR/ext.cnf"
chmod 600 "$DIR"/*.pem "$DIR"/*.crt "$DIR"/*.srl 2>/dev/null || true

echo
echo "✅ Certificados listos en $DIR"
echo
echo "   1. Iniciá el servidor con HTTPS:"
echo "        FENIX_HTTPS=1 node server.js"
echo "      (por defecto usa el puerto 8443; podés cambiarlo con PORT=443)"
echo
echo "   2. En cada teléfono o PC, instalá una sola vez la CA:"
echo "        $DIR/fenix-ca.crt"
echo "      Android: Ajustes → Seguridad → Cifrado y credenciales → Instalar certificado → CA"
echo "      iPhone:  Ajustes → General → VPN y dispositivo → Instalar perfil,"
echo "               y luego Ajustes → General → Información → Confianza en certificados"
echo
echo "   3. Abrí: https://$IP_LAN:8443"
