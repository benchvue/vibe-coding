<#
.SYNOPSIS
    Make the -brouter files the main ones: camino-dayNN-brouter.gpx -> camino-dayNN.gpx

.DESCRIPTION
    For every camino-dayNN-brouter.gpx in the folder:
      1. the existing camino-dayNN.gpx is moved into a '_replaced' subfolder
         (or deleted outright with -Permanent)
      2. the -brouter file is renamed to camino-dayNN.gpx

    Nothing is destroyed by default - the displaced files sit in _replaced
    until you delete that folder yourself.

.EXAMPLE
    .\promote-brouter.ps1 -WhatIf
    Dry run. Do this first.

.EXAMPLE
    .\promote-brouter.ps1
    Displaced files go to .\_replaced\

.EXAMPLE
    .\promote-brouter.ps1 -Permanent
    Really deletes the displaced files. No undo.

.EXAMPLE
    .\promote-brouter.ps1 -Suffix "-bicigrino"
    Promotes a different variant instead.
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$Path = ".",
    [string]$Suffix = "-brouter",
    [string]$TrashDir = "_replaced",
    [switch]$Permanent
)

$sources = Get-ChildItem -Path $Path -Filter "camino-day*$Suffix.gpx" -File |
           Sort-Object Name

if (-not $sources) {
    Write-Host "No *$Suffix.gpx files found in '$Path'." -ForegroundColor Yellow
    return
}

$trash = Join-Path (Resolve-Path $Path) $TrashDir
if (-not $Permanent -and -not (Test-Path -LiteralPath $trash)) {
    if ($PSCmdlet.ShouldProcess($trash, "Create folder")) {
        New-Item -ItemType Directory -Path $trash | Out-Null
    }
}

$promoted = 0
$displaced = 0

foreach ($src in $sources) {
    $newName = $src.Name -replace [regex]::Escape("$Suffix.gpx"), ".gpx"
    $target  = Join-Path $src.DirectoryName $newName

    if (Test-Path -LiteralPath $target) {
        if ($Permanent) {
            if ($PSCmdlet.ShouldProcess($newName, "Delete permanently")) {
                Remove-Item -LiteralPath $target
                Write-Host ("deleted  {0}" -f $newName) -ForegroundColor DarkGray
                $displaced++
            }
        }
        else {
            $keep = Join-Path $trash $newName
            if (Test-Path -LiteralPath $keep) {
                $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
                $keep = Join-Path $trash ("{0}-{1}.gpx" -f [IO.Path]::GetFileNameWithoutExtension($newName), $stamp)
            }
            if ($PSCmdlet.ShouldProcess($newName, "Move to $TrashDir")) {
                Move-Item -LiteralPath $target -Destination $keep
                Write-Host ("moved    {0} -> {1}\" -f $newName, $TrashDir) -ForegroundColor DarkGray
                $displaced++
            }
        }
    }

    if ($PSCmdlet.ShouldProcess($src.Name, "Rename to $newName")) {
        Rename-Item -LiteralPath $src.FullName -NewName $newName
        Write-Host ("promoted {0,-30} -> {1}" -f $src.Name, $newName)
        $promoted++
    }
}

Write-Host ""
Write-Host "Promoted: $promoted   Displaced: $displaced" -ForegroundColor Cyan
if (-not $Permanent -and $displaced -gt 0) {
    Write-Host "Old files kept in $trash" -ForegroundColor Cyan
}
