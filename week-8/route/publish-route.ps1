<#
.SYNOPSIS
    Keep exactly one GPX per day for the website; move every other route file
    into backup\.

.DESCRIPTION
    For each day it picks the most refined variant available, in this order:

        1  *-final.gpx    hand-tuned for that day   (day 13)
        2  *-lite.gpx     albergues thinned          (days 1-12)
        3  *-icons.gpx    Garmin symbols set
        4  *-photo.gpx    photo spots added
        5  *-alb.gpx      albergues added
        6  plain .gpx

    Everything else - other variants, the .tcx courses, old zips - is moved to
    backup\gpx and backup\tcx. Nothing is deleted.

    With -Rename the survivors become camino-2027-dayNN.gpx, which is what you
    want on a download page.

.EXAMPLE
    .\publish-route.ps1 -WhatIf

.EXAMPLE
    .\publish-route.ps1 -Rename

.EXAMPLE
    .\publish-route.ps1 -KeepTcx
    Leaves the .tcx files in place as well.
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$Path = ".",
    [string]$BackupDir = "backup",
    [switch]$Rename,
    [switch]$KeepTcx
)

$root = (Resolve-Path $Path).Path

# lower number wins
function Get-Rank([string]$name) {
    if ($name -match '-final\.gpx$') { return 1 }
    if ($name -match '-lite\.gpx$')  { return 2 }
    if ($name -match '-icons\.gpx$') { return 3 }
    if ($name -match '-photo\.gpx$') { return 4 }
    if ($name -match '-alb\.gpx$')   { return 5 }
    return 6
}

$gpx = Get-ChildItem -Path $root -Filter "camino-day*.gpx" -File
if (-not $gpx) {
    Write-Warning "No camino-day*.gpx found in '$root'."
    return
}

# group by the day number in the file name
$byDay = @{}
foreach ($f in $gpx) {
    if ($f.Name -notmatch 'camino-day(\d{2})') { continue }
    $d = $Matches[1]
    if (-not $byDay.ContainsKey($d)) { $byDay[$d] = @() }
    $byDay[$d] += $f
}

$keepers = @{}
Write-Host "Publishing one file per day:" -ForegroundColor Cyan
foreach ($d in ($byDay.Keys | Sort-Object)) {
    $winner = $byDay[$d] | Sort-Object @{Expression = { Get-Rank $_.Name }}, Name |
              Select-Object -First 1
    $keepers[$winner.FullName] = $d
    $others = ($byDay[$d].Count - 1)
    Write-Host ("   Day {0}  {1,-46} {2,6:N0} KB   ({3} other variant{4})" -f
                $d, $winner.Name, ($winner.Length / 1KB), $others,
                $(if ($others -eq 1) { "" } else { "s" }))
}

# everything else that belongs to the route folder
$toMove = @()
foreach ($f in Get-ChildItem -Path $root -File) {
    if ($keepers.ContainsKey($f.FullName)) { continue }
    if ($f.Extension -eq ".gpx" -and $f.Name -like "camino-day*") { $toMove += $f; continue }
    if ($f.Extension -eq ".tcx" -and -not $KeepTcx)               { $toMove += $f; continue }
    if ($f.Extension -eq ".zip" -and $f.Name -like "camino*")     { $toMove += $f; continue }
    if ($f.Extension -eq ".bak")                                   { $toMove += $f; continue }
}

if ($toMove) {
    $mb = ($toMove | Measure-Object Length -Sum).Sum / 1MB
    Write-Host ""
    Write-Host ("Moving {0} file(s), {1:N1} MB, to {2}\" -f $toMove.Count, $mb, $BackupDir) -ForegroundColor Yellow
}

$moved = 0
foreach ($f in $toMove) {
    $cat  = switch ($f.Extension) { ".tcx" { "tcx" } ".zip" { "zip" } default { "gpx" } }
    $dest = Join-Path (Join-Path $root $BackupDir) $cat
    if (-not (Test-Path -LiteralPath $dest)) {
        if ($PSCmdlet.ShouldProcess($dest, "Create folder")) {
            New-Item -ItemType Directory -Path $dest -Force | Out-Null
        }
    }
    $target = Join-Path $dest $f.Name
    if (Test-Path -LiteralPath $target) {
        $stamp  = Get-Date -Format "yyyyMMdd-HHmmss"
        $target = Join-Path $dest ("{0}-{1}{2}" -f
            [IO.Path]::GetFileNameWithoutExtension($f.Name), $stamp, $f.Extension)
    }
    if ($PSCmdlet.ShouldProcess($f.Name, "Move to $BackupDir\$cat")) {
        Move-Item -LiteralPath $f.FullName -Destination $target
        $moved++
    }
}

if ($Rename) {
    Write-Host ""
    Write-Host "Renaming for the download page:" -ForegroundColor Cyan
    foreach ($full in ($keepers.Keys | Sort-Object { $keepers[$_] })) {
        if (-not (Test-Path -LiteralPath $full)) { continue }
        $day  = $keepers[$full]
        $new  = "camino-2027-day$day.gpx"
        $dest = Join-Path $root $new
        if ((Split-Path $full -Leaf) -eq $new) { continue }
        if (Test-Path -LiteralPath $dest) {
            Write-Warning "   $new already exists, skipping"
            continue
        }
        if ($PSCmdlet.ShouldProcess((Split-Path $full -Leaf), "Rename to $new")) {
            Rename-Item -LiteralPath $full -NewName $new
            Write-Host ("   {0}" -f $new)
        }
    }
}

Write-Host ""
Write-Host ("{0} day file(s) published, {1} file(s) moved to {2}\." -f
            $keepers.Count, $moved, $BackupDir) -ForegroundColor Green
if (-not $KeepTcx) {
    Write-Host "TCX courses are in $BackupDir\tcx - offer them separately if Garmin users ask."
}
