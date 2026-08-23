<#
.SYNOPSIS
    Package the published day GPX files into one zip for the download page.

.DESCRIPTION
    Collects camino-2027-day*.gpx, writes a short README next to them, and
    zips the lot with today's date in the file name. The date matters: OSM data
    changes, so a downloader needs to know how old their copy is.

    Optionally includes the TCX courses from backup\tcx and the format spec.

.EXAMPLE
    .\make-camino-zip.ps1 -WhatIf

.EXAMPLE
    .\make-camino-zip.ps1

.EXAMPLE
    .\make-camino-zip.ps1 -IncludeTcx -IncludeDocs
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$Path = ".",
    [string]$Filter = "camino-2027-day*.gpx",
    [string]$Name = "camino-frances-2027-gpx",
    [switch]$IncludeTcx,
    [switch]$IncludeDocs,
    [string]$TcxDir = "backup\tcx"
)

$root  = (Resolve-Path $Path).Path
$stamp = Get-Date -Format "yyyyMMdd"
$zip   = Join-Path $root ("{0}-{1}.zip" -f $Name, $stamp)

$gpx = Get-ChildItem -Path $root -Filter $Filter -File | Sort-Object Name
if (-not $gpx) {
    Write-Warning "No files matching '$Filter'. Run publish-route.ps1 -Rename first."
    return
}

Write-Host ("Packing {0} GPX file(s)" -f $gpx.Count) -ForegroundColor Cyan
foreach ($f in $gpx) {
    Write-Host ("   {0,-28} {1,6:N0} KB" -f $f.Name, ($f.Length / 1KB))
}

# staging folder so the zip has a clean structure and a README inside
$stage = Join-Path $env:TEMP ("camino-zip-" + [Guid]::NewGuid().ToString("N").Substring(0, 8))
if (-not $PSCmdlet.ShouldProcess($zip, "Create archive")) { return }

New-Item -ItemType Directory -Path $stage | Out-Null
try {
    foreach ($f in $gpx) { Copy-Item -LiteralPath $f.FullName -Destination $stage }

    $tcxCount = 0
    if ($IncludeTcx) {
        $tcxPath = Join-Path $root $TcxDir
        if (Test-Path -LiteralPath $tcxPath) {
            $tcx = Get-ChildItem -Path $tcxPath -Filter "*.tcx" -File
            if ($tcx) {
                $sub = Join-Path $stage "garmin-courses-tcx"
                New-Item -ItemType Directory -Path $sub | Out-Null
                foreach ($t in $tcx) { Copy-Item -LiteralPath $t.FullName -Destination $sub }
                $tcxCount = $tcx.Count
                Write-Host ("   + {0} TCX course(s)" -f $tcxCount)
            }
        } else {
            Write-Warning "   $TcxDir not found, skipping TCX"
        }
    }

    if ($IncludeDocs) {
        foreach ($doc in @("gpx-format-spec.md", "camino-2027-plan.csv")) {
            $p = Join-Path $root $doc
            if (Test-Path -LiteralPath $p) {
                Copy-Item -LiteralPath $p -Destination $stage
                Write-Host ("   + {0}" -f $doc)
            }
        }
    }

    $totalKb = [Math]::Round((($gpx | Measure-Object Length -Sum).Sum / 1KB), 0)
    $readme = @"
Camino Frances 2027 - cycling GPX
=================================
Generated: $(Get-Date -Format "yyyy-MM-dd")
Files: $($gpx.Count) daily GPX ($totalKb KB total)

Saint-Jean-Pied-de-Port to Santiago de Compostela, 782 km over 13 days.
Day 8 is a rest day in Leon, so there is no day08 file.

Each file contains
  - the route as a GPX track, with elevation on every point
  - albergue waypoints (bed icon), thinned: none at the start town where you
    slept, a few along the way for stamps, all of them at the destination
  - photo spots and sights (camera icon), churches (cross), restaurants (fork),
    passes (summit)
  - waypoint names in English, notes in Korean

Loading them
  Garmin    copy the .gpx files to GARMIN\NewFiles\ and restart the device
  Phone     open with OsmAnd, Komoot, Gaia GPS or Garmin Explore
  Editing   gpx.studio, bikerouter.de

Notes
  - Days 2, 10, 11 and 12 use road detours where the walking route is too
    steep or too rough for a loaded bike.
  - Day 1 keeps the Napoleon route over the Pyrenees: 28% climbs and a -33%
    descent. Expect to push. The Valcarlos road alternative is gentler.
  - Surface type is not in GPX. Detours were chosen on gradient, not by
    riding them.

Sources
  Route and facilities: santiago.nl (OpenStreetMap, ODbL)
  Elevation: EU-DEM / Copernicus
  Detours: cycle.travel (OpenStreetMap)
"@
    Set-Content -Path (Join-Path $stage "README.txt") -Value $readme -Encoding UTF8

    if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip }
    Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip -CompressionLevel Optimal

    $z = Get-Item -LiteralPath $zip
    Write-Host ""
    Write-Host ("Wrote {0}  ({1:N0} KB)" -f $z.Name, ($z.Length / 1KB)) -ForegroundColor Green
    Write-Host "README.txt is inside, with the generation date and the caveats."
}
finally {
    if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
}
