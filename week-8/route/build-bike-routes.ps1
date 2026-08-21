<#
.SYNOPSIS
    Build the rideable versions of the days that need a road detour.

.DESCRIPTION
    For each day listed below it runs three steps:

      1. splice_detour.py    graft the cycle.travel detour into the day route
      2. add_elevation.py    fill the elevation the detour arrived without
      3. add_waypoints.py    put the albergues back, matched to the new line

    Days whose detour GPX is missing are skipped with a note, so you can build
    them one at a time as you draw each detour. Days not listed here need no
    detour and are already fine.

    Produces:  camino-dayNN-bike.gpx        route only
               camino-dayNN-bike-alb.gpx    route plus albergues

.EXAMPLE
    .\build-bike-routes.ps1 -WhatIf
    Shows what it would run, touching nothing.

.EXAMPLE
    .\build-bike-routes.ps1
    Builds every day whose detour file is present.

.EXAMPLE
    .\build-bike-routes.ps1 -Only 10
    Just day 10.
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$Facilities = "Voorzieningen-ES-CaminoFrances-meertalig-GPXViewer-20260427.gpx",
    [string]$Provider = "opentopodata",
    [string]$Dataset = "eudem25m",
    [double]$Pause = 1.2,
    [string[]]$Only,
    [switch]$SkipWaypoints
)

# day -> the detour GPX files that belong to it, in route order
$plan = [ordered]@{
    "01" = @("day01-valcarlos.gpx")
    "02" = @("day02-perdon.gpx")
    "10" = @("day10-le142.gpx")
    "11" = @("day11-cebreiro.gpx", "day11-sarria.gpx")
    "12" = @("day12-portomarin.gpx")
}

function Invoke-Step($label, $exe, $argList) {
    Write-Host "   $label" -ForegroundColor DarkGray
    & $exe @argList
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "   step failed: $label"
        return $false
    }
    return $true
}

$built = @()
$skipped = @()

foreach ($day in $plan.Keys) {
    if ($Only -and ($Only -notcontains $day)) { continue }

    $detours = $plan[$day]
    $missing = $detours | Where-Object { -not (Test-Path -LiteralPath $_) }
    $source = "camino-day$day.gpx"

    if (-not (Test-Path -LiteralPath $source)) {
        Write-Warning "Day $day : $source not found, skipping."
        $skipped += "$day (no day file)"
        continue
    }
    if ($missing) {
        Write-Host "Day $day : waiting for $($missing -join ', ')" -ForegroundColor Yellow
        $skipped += "$day (detour not drawn yet)"
        continue
    }

    Write-Host ""
    Write-Host "=== Day $day ===" -ForegroundColor Cyan

    $tmp   = "camino-day$day-bike-tmp.gpx"
    $final = "camino-day$day-bike.gpx"

    if (-not $PSCmdlet.ShouldProcess($source, "Splice $($detours -join ' + '), fill elevation, add albergues")) {
        continue
    }

    $spliceArgs = @("splice_detour.py", "--day", $source)
    foreach ($d in $detours) { $spliceArgs += @("--detour", $d) }
    $spliceArgs += @("-o", $tmp)
    if (-not (Invoke-Step "splice" "python" $spliceArgs)) { continue }

    $eleArgs = @("add_elevation.py", $tmp, "--only-missing",
                 "--provider", $Provider, "--dataset", $Dataset,
                 "--pause", $Pause, "-o", $final)
    if (-not (Invoke-Step "elevation" "python" $eleArgs)) {
        Write-Warning "   keeping $tmp so you can retry the elevation step"
        continue
    }
    Remove-Item -LiteralPath $tmp -ErrorAction SilentlyContinue

    if (-not $SkipWaypoints) {
        if (Test-Path -LiteralPath $Facilities) {
            $wpArgs = @("add_waypoints.py", "--facilities", $Facilities,
                        "--track", $final, "--types", "Flag, Red", "--suffix=-alb")
            Invoke-Step "albergues" "python" $wpArgs | Out-Null
        } else {
            Write-Warning "   facilities file not found, skipping albergues"
        }
    }

    $built += $day
}

Write-Host ""
Write-Host "-------------------------------------------" -ForegroundColor Cyan
if ($built)   { Write-Host "Built:   day $($built -join ', day')" -ForegroundColor Green }
if ($skipped) { Write-Host "Skipped: $($skipped -join ' | ')" -ForegroundColor Yellow }
Write-Host ""
Write-Host "Days 03, 04, 05, 06, 07, 09, 13 need no detour - ride the originals."
Write-Host ""
Write-Host "Check each result before riding, e.g.:"
Write-Host "  python gpx_view.py camino-day10.gpx camino-day10-bike.gpx --labels `"walking,detour`" -o check-day10.html"
