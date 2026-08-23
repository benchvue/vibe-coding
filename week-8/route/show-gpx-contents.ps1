<#
.SYNOPSIS
    Show what is inside each day's GPX: albergues, photo spots, restaurants,
    churches, passes - plus distance and elevation gain.

.DESCRIPTION
    Reads the files without changing anything. Categories come from the <sym>
    value that set_icons.py wrote:

        Lodging       albergue / bed
        Scenic Area   photo spot
        Restaurant    food
        Church        church, monastery, chapel
        Summit        pass or high point

    Distance is measured from the track. Ascent uses a 2 m threshold so DEM
    noise does not inflate it.

.EXAMPLE
    .\show-gpx-contents.ps1

.EXAMPLE
    .\show-gpx-contents.ps1 -Detail
    Also lists the photo spots, restaurants and passes by name.

.EXAMPLE
    .\show-gpx-contents.ps1 -Csv contents.csv
#>

[CmdletBinding()]
param(
    [string]$Path = ".",
    [string]$Filter = "camino-2027-day*.gpx",
    [switch]$Detail,
    [string]$Csv
)

$GPXNS = "http://www.topografix.com/GPX/1/1"

$LABEL = [ordered]@{
    "Lodging"     = "Albergue"
    "Scenic Area" = "Photo"
    "Restaurant"  = "Food"
    "Church"      = "Church"
    "Summit"      = "Pass"
}

function Get-DistanceKm($pts) {
    $sum = 0.0
    for ($i = 1; $i -lt $pts.Count; $i++) {
        $a = $pts[$i - 1]; $b = $pts[$i]
        $la1 = $a.lat * [Math]::PI / 180; $lo1 = $a.lon * [Math]::PI / 180
        $la2 = $b.lat * [Math]::PI / 180; $lo2 = $b.lon * [Math]::PI / 180
        $h = [Math]::Pow([Math]::Sin(($la2 - $la1) / 2), 2) +
             [Math]::Cos($la1) * [Math]::Cos($la2) *
             [Math]::Pow([Math]::Sin(($lo2 - $lo1) / 2), 2)
        $sum += 2 * 6371.0088 * [Math]::Asin([Math]::Sqrt($h))
    }
    return $sum
}

function Get-AscentM($pts) {
    $gain = 0.0; $base = $null
    foreach ($p in $pts) {
        if ($null -eq $p.ele) { continue }
        if ($null -eq $base) { $base = $p.ele; continue }
        if ($p.ele -gt $base + 2) { $gain += $p.ele - $base; $base = $p.ele }
        elseif ($p.ele -lt $base) { $base = $p.ele }
    }
    return $gain
}

$files = Get-ChildItem -Path $Path -Filter $Filter -File | Sort-Object Name
if (-not $files) {
    Write-Warning "No files matching '$Filter' in '$Path'."
    return
}

$rows = @()
foreach ($f in $files) {
    $xml = New-Object System.Xml.XmlDocument
    $xml.PreserveWhitespace = $false
    try { $xml.Load($f.FullName) }
    catch { Write-Warning ("{0}: not valid XML" -f $f.Name); continue }

    $trkpts = $xml.GetElementsByTagName("trkpt", $GPXNS)
    if ($trkpts.Count -eq 0) { $trkpts = $xml.GetElementsByTagName("trkpt") }
    $pts = foreach ($t in $trkpts) {
        $e = $null
        foreach ($c in $t.ChildNodes) { if ($c.LocalName -eq "ele") { $e = [double]$c.InnerText } }
        [pscustomobject]@{ lat = [double]$t.lat; lon = [double]$t.lon; ele = $e }
    }

    $wpts = $xml.GetElementsByTagName("wpt", $GPXNS)
    if ($wpts.Count -eq 0) { $wpts = $xml.GetElementsByTagName("wpt") }

    $counts = @{}; foreach ($k in $LABEL.Keys) { $counts[$k] = 0 }
    $other = 0
    $named = @{}

    foreach ($w in $wpts) {
        $sym = ""; $name = ""; $cmt = ""
        foreach ($c in $w.ChildNodes) {
            switch ($c.LocalName) {
                "sym"  { $sym  = $c.InnerText }
                "name" { $name = $c.InnerText }
                "cmt"  { $cmt  = $c.InnerText }
            }
        }
        if ($LABEL.Contains($sym)) {
            $counts[$sym]++
            if ($sym -ne "Lodging") {
                if (-not $named.ContainsKey($sym)) { $named[$sym] = @() }
                $named[$sym] += [pscustomobject]@{ Name = $name; Note = $cmt }
            }
        } else { $other++ }
    }

    $day = if ($f.Name -match 'day(\d{2})') { $Matches[1] } else { "--" }
    $rows += [pscustomobject]@{
        Day      = $day
        File     = $f.Name
        Km       = [Math]::Round((Get-DistanceKm $pts), 1)
        AscentM  = [Math]::Round((Get-AscentM $pts), 0)
        Albergue = $counts["Lodging"]
        Photo    = $counts["Scenic Area"]
        Food     = $counts["Restaurant"]
        Church   = $counts["Church"]
        Pass     = $counts["Summit"]
        Other    = $other
        Points   = $pts.Count
        Named    = $named
    }
}

Write-Host ""
$rows | Format-Table Day, Km, AscentM, Albergue, Photo, Food, Church, Pass, Other, Points -AutoSize

$sum = [pscustomobject]@{
    Days     = $rows.Count
    Km       = [Math]::Round(($rows | Measure-Object Km -Sum).Sum, 1)
    AscentM  = ($rows | Measure-Object AscentM -Sum).Sum
    Albergue = ($rows | Measure-Object Albergue -Sum).Sum
    Photo    = ($rows | Measure-Object Photo -Sum).Sum
    Food     = ($rows | Measure-Object Food -Sum).Sum
    Church   = ($rows | Measure-Object Church -Sum).Sum
    Pass     = ($rows | Measure-Object Pass -Sum).Sum
}
Write-Host ("TOTAL  {0} days, {1} km, {2} m climbing" -f $sum.Days, $sum.Km, $sum.AscentM) -ForegroundColor Cyan
Write-Host ("       {0} albergues, {1} photo spots, {2} restaurants, {3} churches, {4} passes" -f
            $sum.Albergue, $sum.Photo, $sum.Food, $sum.Church, $sum.Pass) -ForegroundColor Cyan

if ($Detail) {
    foreach ($r in $rows) {
        Write-Host ""
        Write-Host ("Day {0}  {1} km" -f $r.Day, $r.Km) -ForegroundColor Yellow
        foreach ($sym in @("Summit", "Scenic Area", "Church", "Restaurant")) {
            if (-not $r.Named.ContainsKey($sym)) { continue }
            foreach ($item in $r.Named[$sym]) {
                Write-Host ("   {0,-12} {1,-44} {2}" -f $LABEL[$sym], $item.Name, $item.Note)
            }
        }
    }
}

if ($Csv) {
    $rows | Select-Object Day, File, Km, AscentM, Albergue, Photo, Food, Church, Pass, Other, Points |
        Export-Csv -Path $Csv -NoTypeInformation -Encoding UTF8
    Write-Host ""
    Write-Host "Wrote $Csv"
}
