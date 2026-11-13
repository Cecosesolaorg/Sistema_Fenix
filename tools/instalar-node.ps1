# Instalador portable de Node.js para Fenix
# - Usa tools\node_portable.zip si existe (sirve sin Internet).
# - Si no, descarga la ultima LTS oficial desde nodejs.org.
# - Verifica SHA-256 contra SHASUMS256.txt antes de usar el binario.
# - Extrae en tools\node_portable. No requiere administrador.
# - No modifica el sistema ni el PATH.

param(
    [string]$Destino = (Join-Path $PSScriptRoot 'node_portable')
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Info($texto) { Write-Host $texto }
function Falla($texto) { throw $texto }

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
} catch { }

# Arquitectura de Windows
$arquitectura = switch ($env:PROCESSOR_ARCHITECTURE) {
    'AMD64' { 'x64' }
    'ARM64' { 'arm64' }
    'x86'   { Falla 'Windows de 32 bits no esta soportado. Instala Node.js manualmente.' }
    default { 'x64' }
}

$raiz = Split-Path -Parent $PSScriptRoot
$temporal = Join-Path $env:TEMP ('fenix-node-' + [guid]::NewGuid().ToString('N'))

Info ''
Info '  Instalando Node.js portable para Fenix'
Info "  Arquitectura: $arquitectura"
Info "  Destino:      $Destino"
Info ''

New-Item -ItemType Directory -Path $temporal -Force | Out-Null

$codigo = 1
try {
    $zip = $null

    # 1. ZIP local (instalacion sin Internet)
    $candidatos = @(
        (Join-Path $PSScriptRoot 'node_portable.zip'),
        (Join-Path $raiz 'node_portable.zip')
    )
    foreach ($c in $candidatos) {
        if (Test-Path $c) { $zip = $c; break }
    }

    if ($zip) {
        Info "  Usando ZIP local: $zip"
        $hashLocal = "$zip.sha256"
        if (Test-Path $hashLocal) {
            $esperado = (Get-Content $hashLocal -TotalCount 1).Trim().Split(' ')[0].ToLower()
            $real = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
            if ($esperado -ne $real) {
                Falla 'El SHA-256 del ZIP local no coincide con el archivo .sha256.'
            }
            Info '  Hash del ZIP local verificado.'
        } else {
            Info '  Aviso: no hay archivo .sha256 junto al ZIP local;'
            Info '         se verifica solo que contenga node.exe.'
        }
    }

    # 2. Descarga desde nodejs.org
    if (-not $zip) {
        Info '  Consultando la version LTS en nodejs.org...'
        $indice = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -UseBasicParsing -TimeoutSec 30
        $lts = $indice | Where-Object { $_.lts } | Select-Object -First 1
        if (-not $lts) { Falla 'No se pudo determinar la version LTS de Node.js.' }

        $version = [string]$lts.version
        $archivo = "node-$version-win-$arquitectura.zip"
        $url = "https://nodejs.org/dist/$version/$archivo"

        Info "  Descargando $archivo ..."
        $zip = Join-Path $temporal $archivo
        Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing -TimeoutSec 300

        Info '  Verificando SHA-256 oficial...'
        $shasums = Invoke-WebRequest -Uri "https://nodejs.org/dist/$version/SHASUMS256.txt" -UseBasicParsing -TimeoutSec 30
        $linea = ($shasums.Content -split "`n") |
            Where-Object { $_ -match ('\s' + [regex]::Escape($archivo) + '$') } |
            Select-Object -First 1
        if (-not $linea) { Falla "No se encontro el hash de $archivo en SHASUMS256.txt." }

        $esperado = ($linea.Trim() -split '\s+')[0].ToLower()
        $real = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
        if ($esperado -ne $real) {
            Falla 'El SHA-256 del archivo descargado no coincide. Se cancela la instalacion.'
        }
        Info '  Hash verificado.'
    }

    # 3. Extraer
    Info '  Extrayendo...'
    $extraido = Join-Path $temporal 'extraido'
    Expand-Archive -Path $zip -DestinationPath $extraido -Force

    $nodeEncontrado = Get-ChildItem -Path $extraido -Recurse -Filter 'node.exe' -File |
        Select-Object -First 1
    if (-not $nodeEncontrado) {
        Falla 'El ZIP no contiene node.exe.'
    }
    $carpeta = $nodeEncontrado.Directory

    if (-not (Test-Path $PSScriptRoot)) {
        New-Item -ItemType Directory -Path $PSScriptRoot -Force | Out-Null
    }
    if (Test-Path $Destino) {
        Remove-Item $Destino -Recurse -Force
    }
    Move-Item -Path $carpeta.FullName -Destination $Destino

    $exe = Join-Path $Destino 'node.exe'
    Unblock-File -Path $exe -ErrorAction SilentlyContinue

    $ver = & $exe --version
    if ($LASTEXITCODE -ne 0) { Falla 'node.exe no pudo ejecutarse despues de extraerlo.' }

    Info ''
    Info "  Node.js instalado correctamente: $ver"
    Info '  Ya podes volver a la ventana del servidor.'
    Info ''
    $codigo = 0
}
catch {
    Write-Host ''
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ''
    Write-Host '  Revisa la conexion a Internet o copia tools\node_portable.zip'
    Write-Host '  desde otra PC con Node.js instalado.'
    Write-Host ''
    $codigo = 1
}
finally {
    if (Test-Path $temporal) {
        Remove-Item $temporal -Recurse -Force -ErrorAction SilentlyContinue
    }
}

exit $codigo