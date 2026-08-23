<#
.SYNOPSIS
    Rewrite GPX waypoint notes down to address and phone, so Garmin Connect
    will save the file as a course.

.DESCRIPTION
    The albergue entries carried the whole listing - address, town, phone, bed
    count, opening months, facilities - up to 700 characters. Garmin Connect
    imports and shows that fine, but refuses to save it as a course.

    This keeps what you would actually want at the roadside:

        Calle Real 12, Molinaseca · Tel +34 987 453 057

    Address and town come from the first fields, the phone is picked out
    wherever it sits, and everything else (bed counts, facility lists, opening
    hours, web links) is dropped.

    Waypoints whose note is Korean - the photo spots and sights - are left as
    Korean, just tidied and length-capped.

    Only <desc> and <cmt> change. Track, elevation, coordinates, English
    <name> and <sym> icons are untouched. The file is overwritten, with a .bak
    kept unless you pass -NoBackup.

.EXAMPLE
    .\clean-gpx-desc.ps1 -WhatIf

.EXAMPLE
    .\clean-gpx-desc.ps1

.EXAMPLE
    .\clean-gpx-desc.ps1 -MaxLength 60 -Filter "camino-day02*.gpx"
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$Path = ".",
    [string]$Filter = "*-icons.gpx",
    [int]$MaxLength = 80,
    [switch]$NoBackup,
    [switch]$ShowSamples
)

$GPXNS  = "http://www.topografix.com/GPX/1/1"
$RxPhone  = [regex]'(?i)(?:tel[:.\s]*)?(\+?\d[\d\s().\-]{6,}\d)'
$RxHasTel = [regex]'(?i)tel|\+\d'
$RxHangul = [regex]'[\uAC00-\uD7A3]'
$RxBeds   = [regex]'(?i)^\d+\s*(camas|plazas|beds|places)'

function Compress-Text([string]$s) {
    if ([string]::IsNullOrWhiteSpace($s)) { return "" }
    return ([regex]::Replace($s, '\s+', ' ')).Trim()
}

function Get-ShortNote([string]$text, [int]$max) {
    $text = Compress-Text $text
    if ($text -eq "") { return "" }

    # Korean note (photo spots): keep it, drop any "Day 10 | " prefix
    if ($RxHangul.IsMatch($text)) {
        $ko = $text
        if ($text.Contains("|")) { $ko = ($text -split '\|', 2)[1].Trim() }
        if ($ko.Length -gt $max) { $ko = $ko.Substring(0, $max).TrimEnd(' ', ',', '.', '|') }
        return $ko
    }

    $parts = @($text -split '\|' | ForEach-Object { $_.Trim() } | Where-Object { $_ })

    $phone = ""
    foreach ($p in $parts) {
        if (-not $RxHasTel.IsMatch($p)) { continue }
        $m = $RxPhone.Match($p)
        if ($m.Success) { $phone = (Compress-Text $m.Groups[1].Value); break }
    }

    $keep = @()
    foreach ($p in $parts | Select-Object -First 2) {
        if ($RxHasTel.IsMatch($p) -and $RxPhone.IsMatch($p)) { continue }
        if ($RxBeds.IsMatch($p)) { continue }
        $keep += $p
    }

    $out = ($keep -join ", ")
    if ($phone) {
        if ($out) { $out += " · " }
        $out += "Tel $phone"
    }
    if (-not $out) { $out = $parts | Select-Object -First 1 }
    if ($out.Length -gt $max) { $out = $out.Substring(0, $max).TrimEnd(' ', ',', '.', '|') }
    return $out
}

$files = Get-ChildItem -Path $Path -Filter $Filter -File | Sort-Object Name
if (-not $files) {
    Write-Warning "No files matching '$Filter' in '$Path'."
    return
}

Write-Host "Rewriting waypoint notes to address + phone (max $MaxLength chars)" -ForegroundColor Cyan
Write-Host ""

$grand = 0
foreach ($f in $files) {
    $xml = New-Object System.Xml.XmlDocument
    $xml.PreserveWhitespace = $false
    try { $xml.Load($f.FullName) }
    catch {
        Write-Warning ("{0}: not valid XML, skipped" -f $f.Name)
        continue
    }

    $wpts = $xml.GetElementsByTagName("wpt", $GPXNS)
    if ($wpts.Count -eq 0) { $wpts = $xml.GetElementsByTagName("wpt") }

    $changed = 0
    $beforeMax = 0
    $afterMax = 0
    $samples = @()

    foreach ($w in $wpts) {
        $descNode = $null
        $cmtNode  = $null
        foreach ($c in @($w.ChildNodes)) {
            if ($c.LocalName -eq "desc") { $descNode = $c }
            if ($c.LocalName -eq "cmt")  { $cmtNode  = $c }
        }

        # the fuller of the two is the better source
        $source = ""
        foreach ($n in @($descNode, $cmtNode)) {
            if ($n -and ([string]$n.InnerText).Length -gt $source.Length) {
                $source = [string]$n.InnerText
            }
        }
        if (-not $source) { continue }
        if ($source.Length -gt $beforeMax) { $beforeMax = $source.Length }

        $short = Get-ShortNote $source $MaxLength
        if ($short.Length -gt $afterMax) { $afterMax = $short.Length }

        foreach ($n in @($descNode, $cmtNode)) {
            if ($n -and $n.InnerText -ne $short) {
                $n.InnerText = $short
                $changed++
            }
        }
        if ($samples.Count -lt 3 -and $source.Length -gt $MaxLength) {
            $samples += $short
        }
    }

    if ($changed -eq 0) {
        Write-Host ("   {0,-46} already clean (longest {1})" -f $f.Name, $beforeMax)
        continue
    }

    if ($PSCmdlet.ShouldProcess($f.Name, "Rewrite $changed note(s), longest $beforeMax -> $afterMax")) {
        if (-not $NoBackup) {
            $bak = "$($f.FullName).bak"
            if (-not (Test-Path -LiteralPath $bak)) {
                Copy-Item -LiteralPath $f.FullName -Destination $bak
            }
        }
        $settings = New-Object System.Xml.XmlWriterSettings
        $settings.Indent = $true
        $settings.IndentChars = "  "
        $settings.Encoding = New-Object System.Text.UTF8Encoding($false)   # no BOM
        $writer = [System.Xml.XmlWriter]::Create($f.FullName, $settings)
        try   { $xml.Save($writer) }
        finally { $writer.Close() }

        Write-Host ("   {0,-46} {1,3} note(s), {2} -> {3} chars" -f
                    $f.Name, $changed, $beforeMax, $afterMax) -ForegroundColor Green
        if ($ShowSamples) {
            foreach ($s in $samples) { Write-Host ("        {0}" -f $s) -ForegroundColor DarkGray }
        }
        $grand += $changed
    }
}

Write-Host ""
Write-Host "$grand note(s) rewritten across $($files.Count) file(s)." -ForegroundColor Cyan
Write-Host "Names, icons, track and elevation unchanged. Korean notes kept as Korean."
if (-not $NoBackup) { Write-Host "Originals kept as *.gpx.bak" }
