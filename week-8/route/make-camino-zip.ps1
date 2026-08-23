<#
.SYNOPSIS
    Package the day GPX and TCX files into one dated zip.

.DESCRIPTION
    Looks for camino-2027-day*.gpx and camino-2027-day*.tcx in the same folder,
    stages them with a README, and writes camino-frances-2027-gpx-YYYYMMDD.zip.

    The date in the name matters: OSM data moves, so anyone holding a copy
    needs to know how old it is.

    TCX files go into a garmin-courses-tcx subfolder so a non-Garmin user can
    ignore them.

.EXAMPLE
    .\make-camino-zip.ps1 -WhatIf

.EXAMPLE
    .\make-camino-zip.ps1

.EXAMPLE
    .\make-camino-zip.ps1 -NoTcx
    GPX only, about 1.4 MB - the lighter download for a website.

.EXAMPLE
    .\make-camino-zip.ps1 -Separate
    Two archives: one GPX, one TCX.
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$Path = ".",
    [string]$Name = "camino-frances-2027-gpx",
    [string]$GpxFilter = "camino-2027-day*.gpx",
    [string]$TcxFilter = "camino-2027-day*.tcx",
    [switch]$NoTcx,
    [switch]$Separate,
    [switch]$IncludeDocs
)

$root  = (Resolve-Path $Path).Path
$stamp = Get-Date -Format "yyyyMMdd"

$gpx = Get-ChildItem -Path $root -Filter $GpxFilter -File | Sort-Object Name
if (-not $gpx) {
    Write-Warning "No files matching '$GpxFilter' in '$root'."
    return
}
$tcx = @()
if (-not $NoTcx) {
    $tcx = Get-ChildItem -Path $root -Filter $TcxFilter -File | Sort-Object Name
}

$gpxKb = [Math]::Round((($gpx | Measure-Object Length -Sum).Sum / 1KB), 0)
Write-Host ("GPX: {0} file(s), {1:N0} KB" -f $gpx.Count, $gpxKb) -ForegroundColor Cyan
foreach ($f in $gpx) {
    Write-Host ("   {0,-26} {1,6:N0} KB" -f $f.Name, ($f.Length / 1KB))
}
if ($tcx) {
    $tcxKb = [Math]::Round((($tcx | Measure-Object Length -Sum).Sum / 1KB), 0)
    Write-Host ("TCX: {0} file(s), {1:N0} KB" -f $tcx.Count, $tcxKb) -ForegroundColor Cyan
}

$readme = @"
Camino Frances 2027 - cycling GPX
=================================
Generated: $(Get-Date -Format "yyyy-MM-dd")

Saint-Jean-Pied-de-Port to Santiago de Compostela
782 km, 10,726 m of climbing, 13 days.
Day 8 is a rest day in Leon, so there is no day08 file.

FILES
  camino-2027-dayNN.gpx      route + waypoints, for any app or device
  garmin-courses-tcx\*.tcx   Garmin Edge courses with ride alerts (optional)

WHAT IS IN THE GPX
  - the route as a track, roughly a point every 50 m, elevation on every point
  - waypoints with Garmin icons:
        bed      albergue (147)
        cross    church, monastery, chapel (35)
        camera   photo spot or viewpoint (28)
        fork     restaurant (6)
        summit   pass or high point (5)
  - waypoint names in English, notes in Korean

  Albergues are thinned on purpose: none in the town you started from, a few
  along the way for stamps, all of them at the destination.

LOADING THEM
  Garmin Edge   copy .gpx and .tcx to GARMIN\NewFiles\ and restart the unit.
                The .tcx appears under Navigation > Courses; the .gpx
                waypoints appear as icons on the map.
  Phone         OsmAnd, Komoot, Gaia GPS or Garmin Explore will open the .gpx.
  Editing       gpx.studio or bikerouter.de

GARMIN EDGE - IMPORTANT
  Opening a course may stall at 5% with a warning that the route is too long.
  Turn recalculation off:
      Settings > Activity Profiles > (profile) > Navigation > Routing >
      Recalculation  ->  Off
  The track is already correct, so there is nothing for the unit to recompute.

  Ride alerts come from the .tcx course, not from the .gpx. Start the course
  and the unit announces each course point (about 20 per day) as you approach.
  Titles are in Korean; set the unit language to Korean or they show as boxes.

STAGES
  Day  1  45.8 km  1,741 m   Saint-Jean-Pied-de-Port - Zubiri
  Day  2  68.9 km    944 m   Zubiri - Estella
  Day  3  61.3 km    908 m   Estella - Navarrete
  Day  4  58.7 km    832 m   Navarrete - Belorado
  Day  5  90.0 km    940 m   Belorado - Castrojeriz
  Day  6  82.3 km    516 m   Castrojeriz - Sahagun
  Day  7  54.7 km    261 m   Sahagun - Leon
  Day  8      rest day in Leon
  Day  9  68.9 km    666 m   Leon - Rabanal del Camino
  Day 10  74.3 km    908 m   Rabanal del Camino - Vega de Valcarce
  Day 11  62.3 km  1,067 m   Vega de Valcarce - Sarria
  Day 12  76.3 km  1,337 m   Sarria - Arzua
  Day 13  38.9 km    606 m   Arzua - Santiago de Compostela

BEFORE YOU RIDE
  - Day 1 keeps the Napoleon route over the Pyrenees: a 28% climb and a -33%
    descent. Expect to push the bike up and walk it down. The Valcarlos road
    is the gentler alternative if you would rather not.
  - Days 2, 10, 11 and 12 replace the walking line with paved road where it
    was too steep or too rough for a loaded bike.
  - Surface type does not exist in GPX. The detours were chosen on gradient,
    not by riding them. Check each day on a map before you go.

SOURCES
  Route and facilities: santiago.nl (OpenStreetMap, ODbL), 2026-06-16 edition
  Elevation: EU-DEM / Copernicus
  Detours: cycle.travel (OpenStreetMap)
"@

function New-Archive($zipPath, $files, $tcxFiles, $withReadme) {
    $stage = Join-Path $env:TEMP ("camino-zip-" + [Guid]::NewGuid().ToString("N").Substring(0, 8))
    New-Item -ItemType Directory -Path $stage | Out-Null
    try {
        foreach ($f in $files) { Copy-Item -LiteralPath $f.FullName -Destination $stage }
        if ($tcxFiles) {
            $sub = Join-Path $stage "garmin-courses-tcx"
            New-Item -ItemType Directory -Path $sub | Out-Null
            foreach ($t in $tcxFiles) { Copy-Item -LiteralPath $t.FullName -Destination $sub }
        }
        if ($withReadme) {
            Set-Content -Path (Join-Path $stage "README.txt") -Value $readme -Encoding UTF8
        }
        if ($IncludeDocs) {
            foreach ($doc in @("gpx-format-spec.md", "camino-2027-plan.csv",
                               "camino-2027-profile.png")) {
                $p = Join-Path $root $doc
                if (Test-Path -LiteralPath $p) { Copy-Item -LiteralPath $p -Destination $stage }
            }
        }
        if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath }
        Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zipPath -CompressionLevel Optimal
        $z = Get-Item -LiteralPath $zipPath
        Write-Host ("Wrote {0}  ({1:N2} MB)" -f $z.Name, ($z.Length / 1MB)) -ForegroundColor Green
    }
    finally {
        if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
    }
}

Write-Host ""
if ($Separate) {
    $zipGpx = Join-Path $root ("{0}-{1}.zip" -f $Name, $stamp)
    $zipTcx = Join-Path $root ("camino-frances-2027-tcx-{0}.zip" -f $stamp)
    if ($PSCmdlet.ShouldProcess($zipGpx, "Create archive")) {
        New-Archive $zipGpx $gpx @() $true
    }
    if ($tcx -and $PSCmdlet.ShouldProcess($zipTcx, "Create archive")) {
        New-Archive $zipTcx $tcx @() $false
    }
}
else {
    $zip = Join-Path $root ("{0}-{1}.zip" -f $Name, $stamp)
    if ($PSCmdlet.ShouldProcess($zip, "Create archive")) {
        New-Archive $zip $gpx $tcx $true
    }
}

Write-Host ""
Write-Host "README.txt inside carries the generation date, the Edge recalculation"
Write-Host "setting, the stage table and the caveats."
