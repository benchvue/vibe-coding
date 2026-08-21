<#
.SYNOPSIS
    Tidy the Camino route folder: bin the junk, archive the big unused downloads.

.DESCRIPTION
    Nothing is deleted by default. Files are moved into two folders so you can
    look before anything is gone for good:

      _trash    duplicates and regenerable output (safe to delete)
      _archive  large source files you are not using but paid bandwidth for

    Protected and never touched: all .py and .ps1 scripts, dayNN.txt, the
    dayNN GPX files you actually ride from, elevation-cache.json (expensive to
    rebuild), pipeline HTML, and the hard-section CSVs.

.EXAMPLE
    .\cleanup-route.ps1 -WhatIf
    Dry run. Always do this first.

.EXAMPLE
    .\cleanup-route.ps1
    Moves files into _trash and _archive.

.EXAMPLE
    .\cleanup-route.ps1 -Permanent
    Deletes the _trash category outright. _archive is still only moved.

.EXAMPLE
    .\cleanup-route.ps1 -ArchiveToo
    Also removes the _archive category (after moving it, or deleting it with
    -Permanent). Only do this if you can re-download those files.
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$Path = ".",
    [switch]$Permanent,
    [switch]$ArchiveToo
)

$root = (Resolve-Path $Path).Path

# --- never touch these ---------------------------------------------------
$protect = @(
    '\.py$', '\.ps1$',
    '^day\d+\.txt$',
    '^camino-day\d+\.gpx$',
    '^camino-day\d+-alb\.gpx$',
    '^camino-day\d+-beds\.gpx$',
    '^camino-frances-ele\.gpx$',
    '^elevation-cache\.json$',
    '^pipeline.*\.html$',
    '^hard.*\.csv$'
)

# --- duplicates and regenerable output -----------------------------------
$trash = @(
    '^camino-day\d+-alb-beds\.gpx$',      # made by re-annotating an annotated file
    '^camino-day\d+-beds-alb\.gpx$',      # same, other order
    '^check.*\.html$',                    # gpx_view output, seconds to remake
    '^compare-.*\.html$',
    '^profile\.html$'
)

# --- big downloads you are no longer using -------------------------------
$archive = @(
    '^Jacobswegen-wandelaars-FR-',        # France file, route starts in Spain
    '^Jacobswegen-wandelaars-ES-.*\.kml$',# the GPX of the same data is the one used
    '^Voorzieningen-.*-Garmin-',          # GPXViewer version is the one you filtered
    '^Voorzieningen-.*-MapsMe-',
    '^Voorzieningen-ES-Santiago-',        # city facilities, not on the day routes
    '^camino-de-santiago-frances\.gpx$',  # bicigrino, 493 points, rejected
    '^camino-frances\.gpx$',              # pre-elevation intermediate, rebuildable
    '^Route_de_Saint_Jean'                # unclear origin, keeping a copy
)

function Test-Any($name, $patterns) {
    foreach ($p in $patterns) { if ($name -match $p) { return $true } }
    return $false
}

$files = Get-ChildItem -Path $root -File
$toTrash = @()
$toArchive = @()

foreach ($f in $files) {
    if (Test-Any $f.Name $protect)   { continue }
    if (Test-Any $f.Name $trash)     { $toTrash += $f;   continue }
    if (Test-Any $f.Name $archive)   { $toArchive += $f; continue }
}

function Show-Plan($label, $list, $colour) {
    if (-not $list) { return }
    $mb = ($list | Measure-Object Length -Sum).Sum / 1MB
    Write-Host ""
    Write-Host ("{0}  ({1} files, {2:N1} MB)" -f $label, $list.Count, $mb) -ForegroundColor $colour
    $list | Sort-Object Name | ForEach-Object {
        Write-Host ("   {0,-56} {1,8:N0} KB" -f $_.Name, ($_.Length / 1KB))
    }
}

Show-Plan "TRASH  - duplicates and regenerable output" $toTrash "Yellow"
Show-Plan "ARCHIVE - large unused downloads"           $toArchive "Cyan"

if (-not $toTrash -and -not $toArchive) {
    Write-Host "`nNothing to clean." -ForegroundColor Green
    return
}

$kept = $files.Count - $toTrash.Count - $toArchive.Count
Write-Host ""
Write-Host ("Keeping {0} files untouched (scripts, day GPX, cache, docs)." -f $kept) -ForegroundColor Green

function Move-Batch($list, $folder) {
    if (-not $list) { return 0 }
    $dest = Join-Path $root $folder
    if (-not (Test-Path -LiteralPath $dest)) {
        if ($PSCmdlet.ShouldProcess($dest, "Create folder")) {
            New-Item -ItemType Directory -Path $dest | Out-Null
        }
    }
    $n = 0
    foreach ($f in $list) {
        $target = Join-Path $dest $f.Name
        if (Test-Path -LiteralPath $target) {
            $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
            $target = Join-Path $dest ("{0}-{1}{2}" -f
                [IO.Path]::GetFileNameWithoutExtension($f.Name), $stamp, $f.Extension)
        }
        if ($PSCmdlet.ShouldProcess($f.Name, "Move to $folder")) {
            Move-Item -LiteralPath $f.FullName -Destination $target
            $n++
        }
    }
    return $n
}

function Remove-Batch($list) {
    $n = 0
    foreach ($f in $list) {
        if ($PSCmdlet.ShouldProcess($f.Name, "Delete permanently")) {
            Remove-Item -LiteralPath $f.FullName
            $n++
        }
    }
    return $n
}

Write-Host ""
if ($Permanent) {
    $a = Remove-Batch $toTrash
    Write-Host "Deleted $a file(s) from the trash category." -ForegroundColor Yellow
    if ($ArchiveToo) {
        $b = Remove-Batch $toArchive
        Write-Host "Deleted $b archived file(s)." -ForegroundColor Yellow
    } else {
        $b = Move-Batch $toArchive "_archive"
        Write-Host "Moved $b file(s) to _archive." -ForegroundColor Cyan
    }
} else {
    $a = Move-Batch $toTrash "_trash"
    $b = Move-Batch $toArchive "_archive"
    Write-Host "Moved $a file(s) to _trash and $b to _archive." -ForegroundColor Cyan
    Write-Host "Check them, then delete the folders yourself when happy."
}
