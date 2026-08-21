<#
.SYNOPSIS
    Rename camino-dayNN.gpx to camino-dayNN-v1.gpx so a new run can't overwrite them.

.DESCRIPTION
    Files that already carry a version suffix (-v1, -v2 ...) are skipped, so
    running this twice is safe. If the target name already exists the file is
    left alone and a warning is printed - nothing is ever overwritten.

.EXAMPLE
    .\rename-v1.ps1 -WhatIf
    Shows what would be renamed without touching anything. Do this first.

.EXAMPLE
    .\rename-v1.ps1
    Performs the rename in the current folder.

.EXAMPLE
    .\rename-v1.ps1 -Suffix "-brouter"
    Uses a different suffix, e.g. to mark where the files came from.
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$Path = ".",
    [string]$Filter = "camino-day*.gpx",
    [string]$Suffix = "-v1"
)

$files = Get-ChildItem -Path $Path -Filter $Filter -File |
         Where-Object { $_.BaseName -notmatch '-v\d+$' } |
         Sort-Object Name

if (-not $files) {
    Write-Host "Nothing to rename in '$Path' (matching $Filter)." -ForegroundColor Yellow
    return
}

$renamed = 0
$skipped = 0

foreach ($f in $files) {
    $newName = "{0}{1}{2}" -f $f.BaseName, $Suffix, $f.Extension
    $target  = Join-Path $f.DirectoryName $newName

    if (Test-Path -LiteralPath $target) {
        Write-Warning "$newName already exists - skipping $($f.Name)"
        $skipped++
        continue
    }

    if ($PSCmdlet.ShouldProcess($f.Name, "Rename to $newName")) {
        Rename-Item -LiteralPath $f.FullName -NewName $newName
        Write-Host ("{0,-24} -> {1}" -f $f.Name, $newName)
        $renamed++
    }
}

Write-Host ""
Write-Host "Renamed: $renamed   Skipped: $skipped" -ForegroundColor Cyan
