param(
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$PublicDir = Join-Path $Root "public"
$DataDir = Join-Path $Root "data"
$PartesFile = Join-Path $DataDir "partes.json"

$MimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg" = "image/svg+xml"
  ".png" = "image/png"
  ".ico" = "image/x-icon"
  ".xlsx" = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
}

function Ensure-Store {
  if (-not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir | Out-Null
  }
  if (-not (Test-Path $PartesFile)) {
    "[]" | Set-Content -Path $PartesFile -Encoding UTF8
  }
}

function Read-Partes {
  Ensure-Store
  $raw = Get-Content -Path $PartesFile -Raw -Encoding UTF8
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return @()
  }
  $items = $raw | ConvertFrom-Json
  if ($null -eq $items) {
    return @()
  }
  return @($items)
}

function Write-Partes($Partes) {
  Ensure-Store
  $sorted = @($Partes) | Sort-Object @{ Expression = { $_.fecha } }, @{ Expression = { $_.createdAt } }
  ConvertTo-Json -InputObject @($sorted) -Depth 20 |
    Set-Content -Path $PartesFile -Encoding UTF8
}

function Get-Prop($Object, [string]$Name, $Default = "") {
  if ($null -eq $Object) {
    return $Default
  }
  $prop = $Object.PSObject.Properties[$Name]
  if ($null -eq $prop -or $null -eq $prop.Value) {
    return $Default
  }
  return $prop.Value
}

function To-Text($Value) {
  if ($null -eq $Value) {
    return ""
  }
  return ([string]$Value).Trim()
}

function To-Bool($Value) {
  if ($null -eq $Value) {
    return $false
  }
  return [bool]$Value
}

function Normalize-Part($InputPart, $Previous = $null) {
  $now = (Get-Date).ToUniversalTime().ToString("o")
  $id = To-Text (Get-Prop $Previous "id")
  if ([string]::IsNullOrWhiteSpace($id)) {
    $id = To-Text (Get-Prop $InputPart "id")
  }
  if ([string]::IsNullOrWhiteSpace($id)) {
    $id = [guid]::NewGuid().ToString("N").Substring(0, 16)
  }

  $tecnicosValue = Get-Prop $InputPart "tecnicos" @()
  $tecnicos = @()
  foreach ($tecnico in @($tecnicosValue)) {
    $name = To-Text $tecnico
    if (-not [string]::IsNullOrWhiteSpace($name)) {
      $tecnicos += $name
    }
  }

  $tiempoComida = To-Text (Get-Prop $InputPart "tiempoComida")
  if (@("", "30", "60", "90") -notcontains $tiempoComida) {
    $tiempoComida = ""
  }

  $tipoServicio = To-Text (Get-Prop $InputPart "tipoServicio")
  $administracion = "Administraci$([char]0x00F3)n"
  $averia = "Aver$([char]0x00ED)a"
  if (@("", "Presupuesto", $administracion, $averia) -notcontains $tipoServicio) {
    $tipoServicio = ""
  }

  $firma = To-Text (Get-Prop $InputPart "firma")
  if (-not $firma.StartsWith("data:image/")) {
    $firma = ""
  }

  $firmasValue = Get-Prop $InputPart "firmas" @()
  $firmas = @()
  foreach ($firmaItem in @($firmasValue)) {
    $firmaText = To-Text $firmaItem
    if ($firmaText.StartsWith("data:image/")) {
      $firmas += $firmaText
    } else {
      $firmas += ""
    }
  }
  if ($firmas.Count -eq 0 -and -not [string]::IsNullOrWhiteSpace($firma)) {
    $firmas += $firma
  }
  while ($firmas.Count -lt $tecnicos.Count) {
    $firmas += ""
  }

  $firmaCliente = To-Text (Get-Prop $InputPart "firmaCliente")
  if (-not $firmaCliente.StartsWith("data:image/")) {
    $firmaCliente = ""
  }

  $createdAt = To-Text (Get-Prop $Previous "createdAt")
  if ([string]::IsNullOrWhiteSpace($createdAt)) {
    $createdAt = $now
  }

  [pscustomobject]@{
    id = $id
    fecha = (To-Text (Get-Prop $InputPart "fecha")).Substring(0, [Math]::Min(10, (To-Text (Get-Prop $InputPart "fecha")).Length))
    tecnicos = $tecnicos
    cliente = To-Text (Get-Prop $InputPart "cliente")
    direccion = To-Text (Get-Prop $InputPart "direccion")
    tipoServicio = $tipoServicio
    anioOt = To-Text (Get-Prop $InputPart "anioOt")
    ot = To-Text (Get-Prop $InputPart "ot")
    horaInicio = To-Text (Get-Prop $InputPart "horaInicio")
    horaFinal = To-Text (Get-Prop $InputPart "horaFinal")
    horasJornada = To-Text (Get-Prop $InputPart "horasJornada")
    horasUrgencia = To-Text (Get-Prop $InputPart "horasUrgencia")
    descripcion = To-Text (Get-Prop $InputPart "descripcion")
    observaciones = To-Text (Get-Prop $InputPart "observaciones")
    almuerzo = To-Bool (Get-Prop $InputPart "almuerzo" $false)
    comida = To-Bool (Get-Prop $InputPart "comida" $false)
    tiempoComida = $tiempoComida
    km = To-Text (Get-Prop $InputPart "km")
    prima = To-Text (Get-Prop $InputPart "prima")
    busca = To-Bool (Get-Prop $InputPart "busca" $false)
    nocturnidad = To-Bool (Get-Prop $InputPart "nocturnidad" $false)
    firma = $(if ($firmas.Count -gt 0) { $firmas[0] } else { $firma })
    firmas = $firmas
    firmaCliente = $firmaCliente
    createdAt = $createdAt
    updatedAt = $now
  }
}

function Test-ValidPart($Part) {
  $tecnicos = @($Part.tecnicos)
  $firmas = @($Part.firmas)
  if ([string]::IsNullOrWhiteSpace($Part.fecha)) { return $false }
  if ($tecnicos.Count -eq 0) { return $false }
  if ([string]::IsNullOrWhiteSpace($Part.cliente)) { return $false }
  if ([string]::IsNullOrWhiteSpace($Part.horaInicio)) { return $false }
  if ([string]::IsNullOrWhiteSpace($Part.horaFinal)) { return $false }
  if ([string]::IsNullOrWhiteSpace($Part.horasJornada)) { return $false }
  if ([string]::IsNullOrWhiteSpace($Part.descripcion)) { return $false }
  if ($firmas.Count -lt $tecnicos.Count) { return $false }
  for ($i = 0; $i -lt $tecnicos.Count; $i++) {
    if (-not (To-Text $firmas[$i]).StartsWith("data:image/")) {
      return $false
    }
  }
  return $true
}

function ConvertTo-JsonBytes($Object) {
  if ($null -eq $Object) {
    $json = "[]"
  } else {
    $json = ConvertTo-Json -InputObject $Object -Depth 20
    if ($null -eq $json) {
      $json = "[]"
    }
  }
  return [Text.Encoding]::UTF8.GetBytes($json)
}

function Xml-Escape($Value) {
  if ($null -eq $Value) {
    return ""
  }
  return [Security.SecurityElement]::Escape([string]$Value)
}

function Get-ColumnName([int]$Index) {
  $name = ""
  $value = $Index + 1
  while ($value -gt 0) {
    $mod = ($value - 1) % 26
    $name = [char](65 + $mod) + $name
    $value = [Math]::Floor(($value - $mod) / 26)
  }
  return $name
}

function Flatten-Partes($Partes) {
  $rows = @()
  foreach ($part in @($Partes | Sort-Object @{ Expression = { $_.fecha } }, @{ Expression = { $_.createdAt } })) {
    $tecnicos = @($part.tecnicos)
    if ($tecnicos.Count -eq 0) {
      $tecnicos = @("")
    }
    foreach ($tecnico in $tecnicos) {
      $rows += [ordered]@{
        "Fecha" = $part.fecha
        "Operario" = $tecnico
        "Cliente" = $part.cliente
        "Tipo de servicio" = $part.tipoServicio
        "Direccion" = $part.direccion
        "Anio OT" = $part.anioOt
        "OT" = $part.ot
        "Hora entrada" = $part.horaInicio
        "Hora salida" = $part.horaFinal
        "Horas jornada" = $part.horasJornada
        "Horas urgencia" = $part.horasUrgencia
        "Descripcion trabajo" = $part.descripcion
        "Observaciones" = $part.observaciones
        "Almuerzo" = $(if ($part.almuerzo) { "Si" } else { "No" })
        "Comida" = $(if ($part.comida) { "Si" } else { "No" })
        "T. comida" = $part.tiempoComida
        "KM" = $part.km
        "Prima" = $part.prima
        "Busca" = $(if ($part.busca) { "Si" } else { "No" })
        "Nocturnidad" = $(if ($part.nocturnidad) { "Si" } else { "No" })
        "Firma cliente" = $(if ((To-Text $part.firmaCliente).StartsWith("data:image/")) { "Si" } else { "No" })
      }
    }
  }
  return $rows
}

function New-Xlsx($Rows) {
  Add-Type -AssemblyName System.IO.Compression | Out-Null
  Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null

  $columns = @(
    @{ Key = "Fecha"; Label = "Fecha" },
    @{ Key = "Operario"; Label = "Operario" },
    @{ Key = "Cliente"; Label = "Cliente" },
    @{ Key = "Tipo de servicio"; Label = "Tipo de servicio" },
    @{ Key = "Direccion"; Label = "Direcci$([char]0x00F3)n" },
    @{ Key = "Anio OT"; Label = "A$([char]0x00F1)o OT" },
    @{ Key = "OT"; Label = "OT" },
    @{ Key = "Hora entrada"; Label = "Hora entrada" },
    @{ Key = "Hora salida"; Label = "Hora salida" },
    @{ Key = "Horas jornada"; Label = "Horas jornada" },
    @{ Key = "Horas urgencia"; Label = "Horas urgencia" },
    @{ Key = "Descripcion trabajo"; Label = "Descripci$([char]0x00F3)n trabajo" },
    @{ Key = "Observaciones"; Label = "Observaciones" },
    @{ Key = "Almuerzo"; Label = "Almuerzo" },
    @{ Key = "Comida"; Label = "Comida" },
    @{ Key = "T. comida"; Label = "T. comida" },
    @{ Key = "KM"; Label = "KM" },
    @{ Key = "Prima"; Label = "Prima" },
    @{ Key = "Busca"; Label = "Busca" },
    @{ Key = "Nocturnidad"; Label = "Nocturnidad" },
    @{ Key = "Firma cliente"; Label = "Firma cliente" }
  )
  $headers = @($columns | ForEach-Object { $_.Label })

  $allRows = @()
  $allRows += ,$headers
  foreach ($row in @($Rows)) {
    if ($null -eq $row) {
      continue
    }
    $values = @()
    foreach ($column in $columns) {
      $values += $row[$column.Key]
    }
    $allRows += ,$values
  }

  $sheetRows = New-Object System.Text.StringBuilder
  for ($rowIndex = 0; $rowIndex -lt $allRows.Count; $rowIndex++) {
    [void]$sheetRows.Append("<row r=""$($rowIndex + 1)"">")
    for ($colIndex = 0; $colIndex -lt $headers.Count; $colIndex++) {
      $ref = "$(Get-ColumnName $colIndex)$($rowIndex + 1)"
      $value = Xml-Escape $allRows[$rowIndex][$colIndex]
      [void]$sheetRows.Append("<c r=""$ref"" t=""inlineStr""><is><t>$value</t></is></c>")
    }
    [void]$sheetRows.Append("</row>")
  }

  $lastColumn = Get-ColumnName ($headers.Count - 1)
  $cols = New-Object System.Text.StringBuilder
  for ($i = 0; $i -lt $headers.Count; $i++) {
    $width = [Math]::Min([Math]::Max($headers[$i].Length + 6, 12), 36)
    [void]$cols.Append("<col min=""$($i + 1)"" max=""$($i + 1)"" width=""$width"" customWidth=""1""/>")
  }

  $worksheet = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:${lastColumn}$($allRows.Count)"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>$cols</cols>
  <sheetData>$sheetRows</sheetData>
  <autoFilter ref="A1:${lastColumn}$($allRows.Count)"/>
</worksheet>
"@

  $files = [ordered]@{
    "[Content_Types].xml" = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>
"@
    "_rels/.rels" = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>
"@
    "xl/workbook.xml" = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Resumen partes" sheetId="1" r:id="rId1"/></sheets>
</workbook>
"@
    "xl/_rels/workbook.xml.rels" = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
"@
    "xl/styles.xml" = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>
"@
    "xl/worksheets/sheet1.xml" = $worksheet
  }

  $memory = New-Object System.IO.MemoryStream
  $zip = New-Object System.IO.Compression.ZipArchive($memory, [System.IO.Compression.ZipArchiveMode]::Create, $true)
  $utf8 = New-Object System.Text.UTF8Encoding $false
  foreach ($name in $files.Keys) {
    $entry = $zip.CreateEntry($name, [System.IO.Compression.CompressionLevel]::NoCompression)
    $stream = $entry.Open()
    $writer = New-Object System.IO.StreamWriter($stream, $utf8)
    $writer.Write($files[$name])
    $writer.Dispose()
  }
  $zip.Dispose()
  $bytes = $memory.ToArray()
  $memory.Dispose()
  return $bytes
}

function Send-Response($Stream, [int]$StatusCode, [string]$ContentType, [byte[]]$Body, $ExtraHeaders = @{}) {
  $reason = @{
    200 = "OK"
    201 = "Created"
    400 = "Bad Request"
    403 = "Forbidden"
    404 = "Not Found"
    405 = "Method Not Allowed"
    500 = "Internal Server Error"
  }[$StatusCode]
  if ([string]::IsNullOrWhiteSpace($reason)) {
    $reason = "OK"
  }

  $headers = New-Object System.Text.StringBuilder
  [void]$headers.Append("HTTP/1.1 $StatusCode $reason`r`n")
  [void]$headers.Append("Content-Type: $ContentType`r`n")
  [void]$headers.Append("Content-Length: $($Body.Length)`r`n")
  [void]$headers.Append("Connection: close`r`n")
  [void]$headers.Append("Cache-Control: no-store`r`n")
  foreach ($key in $ExtraHeaders.Keys) {
    [void]$headers.Append("${key}: $($ExtraHeaders[$key])`r`n")
  }
  [void]$headers.Append("`r`n")

  $headerBytes = [Text.Encoding]::ASCII.GetBytes($headers.ToString())
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
}

function Send-Json($Stream, [int]$StatusCode, $Object) {
  Send-Response $Stream $StatusCode "application/json; charset=utf-8" (ConvertTo-JsonBytes $Object)
}

function Send-Error($Stream, [int]$StatusCode, [string]$Message) {
  Send-Json $Stream $StatusCode ([pscustomobject]@{ error = $Message })
}

function Read-HttpRequest($Client) {
  $stream = $Client.GetStream()
  $memory = New-Object System.IO.MemoryStream
  $buffer = New-Object byte[] 8192
  $headerEnd = -1

  while ($headerEnd -lt 0) {
    $count = $stream.Read($buffer, 0, $buffer.Length)
    if ($count -le 0) {
      break
    }
    $memory.Write($buffer, 0, $count)
    $text = [Text.Encoding]::ASCII.GetString($memory.ToArray())
    $headerEnd = $text.IndexOf("`r`n`r`n", [StringComparison]::Ordinal)
  }

  if ($headerEnd -lt 0) {
    return $null
  }

  $allBytes = $memory.ToArray()
  $headerLength = $headerEnd + 4
  $headerText = [Text.Encoding]::ASCII.GetString($allBytes, 0, $headerLength)
  $headerLines = $headerText -split "`r`n"
  $requestLine = $headerLines[0]
  if ([string]::IsNullOrWhiteSpace($requestLine)) {
    return $null
  }

  $headers = @{}
  foreach ($line in $headerLines[1..($headerLines.Count - 1)]) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $separator = $line.IndexOf(":")
    if ($separator -gt 0) {
      $name = $line.Substring(0, $separator).Trim().ToLowerInvariant()
      $value = $line.Substring($separator + 1).Trim()
      $headers[$name] = $value
    }
  }

  $contentLength = 0
  if ($headers.ContainsKey("content-length")) {
    [void][int]::TryParse($headers["content-length"], [ref]$contentLength)
  }

  if ($contentLength -gt 0) {
    while ($allBytes.Length -lt ($headerLength + $contentLength)) {
      $count = $stream.Read($buffer, 0, $buffer.Length)
      if ($count -le 0) {
        break
      }
      $memory.Write($buffer, 0, $count)
      $allBytes = $memory.ToArray()
    }
    $body = [Text.Encoding]::UTF8.GetString($allBytes, $headerLength, $contentLength)
  } else {
    $body = ""
  }

  $parts = $requestLine.Split(" ")
  [pscustomobject]@{
    Method = $parts[0]
    Path = $parts[1].Split("?")[0]
    Headers = $headers
    Body = $body
    Stream = $stream
  }
}

function Read-JsonBody($Request) {
  if ([string]::IsNullOrWhiteSpace($Request.Body)) {
    return [pscustomobject]@{}
  }
  return $Request.Body | ConvertFrom-Json
}

function Handle-Api($Request) {
  $stream = $Request.Stream
  $path = [Uri]::UnescapeDataString($Request.Path)

  if ($path -eq "/api/partes" -and $Request.Method -eq "GET") {
    $items = @(Read-Partes | Sort-Object @{ Expression = { $_.fecha } }, @{ Expression = { $_.createdAt } })
    Send-Json -Stream $stream -StatusCode 200 -Object $items
    return
  }

  if ($path -eq "/api/partes" -and $Request.Method -eq "POST") {
    $part = Normalize-Part (Read-JsonBody $Request)
    if (-not (Test-ValidPart $part)) {
      Send-Error $stream 400 "Fecha, t$([char]0x00E9)cnicos, cliente, horas, descripci$([char]0x00F3)n y firmas son obligatorios"
      return
    }
    $partes = @(Read-Partes)
    $partes += $part
    Write-Partes $partes
    Send-Json $stream 201 $part
    return
  }

  if ($path -match "^/api/partes/([a-zA-Z0-9]+)$") {
    $id = $Matches[1]
    $partes = @(Read-Partes)
    $index = -1
    for ($i = 0; $i -lt $partes.Count; $i++) {
      if ($partes[$i].id -eq $id) {
        $index = $i
        break
      }
    }

    if ($Request.Method -eq "PUT") {
      if ($index -lt 0) {
        Send-Error $stream 404 "Parte no encontrado"
        return
      }
      $inputPart = Read-JsonBody $Request
      $inputPart | Add-Member -NotePropertyName id -NotePropertyValue $id -Force
      $updated = Normalize-Part $inputPart $partes[$index]
      if (-not (Test-ValidPart $updated)) {
        Send-Error $stream 400 "Fecha, t$([char]0x00E9)cnicos, cliente, horas, descripci$([char]0x00F3)n y firmas son obligatorios"
        return
      }
      $partes[$index] = $updated
      Write-Partes $partes
      Send-Json $stream 200 $updated
      return
    }

    if ($Request.Method -eq "DELETE") {
      if ($index -lt 0) {
        Send-Error $stream 404 "Parte no encontrado"
        return
      }
      $remaining = @()
      for ($i = 0; $i -lt $partes.Count; $i++) {
        if ($i -ne $index) {
          $remaining += $partes[$i]
        }
      }
      Write-Partes $remaining
      Send-Json $stream 200 ([pscustomobject]@{ ok = $true })
      return
    }
  }

  if ($path -eq "/api/resumen.xlsx" -and $Request.Method -eq "GET") {
    $bytes = New-Xlsx (Flatten-Partes (Read-Partes))
    Send-Response $stream 200 $MimeTypes[".xlsx"] $bytes @{
      "Content-Disposition" = 'attachment; filename="resumen-partes.xlsx"'
    }
    return
  }

  Send-Error $stream 404 "API no encontrada"
}

function Handle-Static($Request) {
  $stream = $Request.Stream
  $path = [Uri]::UnescapeDataString($Request.Path)
  if ($path -eq "/") {
    $path = "/index.html"
  }

  $relative = $path.TrimStart("/").Replace("/", [IO.Path]::DirectorySeparatorChar)
  $filePath = [IO.Path]::GetFullPath((Join-Path $PublicDir $relative))
  $publicFull = [IO.Path]::GetFullPath($PublicDir)
  if (-not $filePath.StartsWith($publicFull, [StringComparison]::OrdinalIgnoreCase)) {
    Send-Error $stream 403 "Ruta no permitida"
    return
  }

  if (-not (Test-Path $filePath -PathType Leaf)) {
    Send-Error $stream 404 "No encontrado"
    return
  }

  $ext = [IO.Path]::GetExtension($filePath).ToLowerInvariant()
  $contentType = $MimeTypes[$ext]
  if ([string]::IsNullOrWhiteSpace($contentType)) {
    $contentType = "application/octet-stream"
  }
  $bytes = [IO.File]::ReadAllBytes($filePath)
  Send-Response $stream 200 $contentType $bytes
}

Ensure-Store

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $Port)
$listener.Start()

$localIp = "localhost"
try {
  $localIp = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" } |
    Select-Object -First 1 -ExpandProperty IPAddress)
} catch {
  $localIp = "IP-DE-ESTE-PC"
}

Write-Host ""
Write-Host "Partes digitales iniciado."
Write-Host "En este equipo: http://localhost:$Port"
Write-Host "Desde otros dispositivos: http://${localIp}:$Port"
Write-Host "Pulsa Ctrl+C para cerrar."
Write-Host ""

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $request = Read-HttpRequest $client
      if ($null -ne $request) {
        if ($request.Path.StartsWith("/api/")) {
          Handle-Api $request
        } else {
          Handle-Static $request
        }
      }
    } catch {
      try {
        Send-Error ($client.GetStream()) 500 $_.Exception.Message
      } catch {
      }
    } finally {
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}
