<#
.SYNOPSIS
    웹사이트 배포용 GPX 12개만 남기고 나머지를 backup 으로 옮깁니다.

.DESCRIPTION
    Camino Francés 2027 · 작업 폴더 정리용.

    남기는 파일 (12개)
        camino-day01-bike-alb.gpx   camino-day02-bike-alb.gpx
        camino-day03-alb.gpx        camino-day04-alb.gpx
        camino-day05-alb.gpx        camino-day06-alb.gpx
        camino-day07-alb.gpx        camino-day09-alb.gpx
        camino-day10-bike-alb.gpx   camino-day11-bike-alb.gpx
        camino-day12-bike-alb.gpx   camino-day13-alb.gpx

    나머지는 backup 아래로 종류별로 나뉘어 이동합니다.
        backup\gpx     중간 산출물 GPX (…-alb, …-bike, …-beds, 우회 조각 등)
        backup\source  원본 자료 (Jacobswegen…, Voorzieningen…, PDF)
        backup\tools   스크립트 (.py .ps1)      ※ 기본값은 그대로 둠
        backup\data    좌표·캐시·표 (.txt .csv .json)
        backup\docs    문서 (.html .md)
        backup\misc    그 밖

    기본 동작은 안전 위주입니다.
      · 12개 중 하나라도 없으면 아무것도 옮기지 않고 멈춥니다
      · 파일 내용(트랙·웨이포인트)까지 확인합니다
      · 스크립트(.py .ps1)는 그대로 둡니다  →  옮기려면 -IncludeTools
      · 이름이 겹치면 뒤에 날짜시각을 붙입니다

.PARAMETER Path
    정리할 폴더. 기본값은 현재 폴더.

.PARAMETER Backup
    옮길 위치. 기본값은 <Path>\backup.

.PARAMETER PublishTo
    지정하면 12개 파일을 그 폴더로 복사합니다 (이동이 아니라 복사).
    예: -PublishTo ..\site\route

.PARAMETER IncludeTools
    .py .ps1 도 backup 으로 옮깁니다.

.PARAMETER SkipVerify
    GPX 내용 검사를 건너뜁니다.

.NOTES
    이 파일은 UTF-8 BOM 으로 저장되어 있습니다.
    Windows PowerShell 5.1 은 BOM 이 없으면 한글을 ANSI 로 읽어 구문 오류가 납니다.
    편집기에서 다시 저장할 때도 "UTF-8 with BOM(서명 있음)" 을 고르세요.

    인터넷에서 받은 파일이라 실행 경고가 뜨면 한 번만 아래를 실행하세요.
        Unblock-File .\cleanup-downloads.ps1

.EXAMPLE
    .\cleanup-downloads.ps1 -WhatIf
    무엇이 어디로 갈지 보기만 합니다. 먼저 이걸로 확인하세요.

.EXAMPLE
    .\cleanup-downloads.ps1
    실제로 정리합니다.

.EXAMPLE
    .\cleanup-downloads.ps1 -PublishTo ..\web\route
    정리하면서 12개를 웹사이트 route 폴더로 복사합니다.
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string] $Path       = '.',
    [string] $Backup     = '',
    [string] $PublishTo  = '',
    [switch] $IncludeTools,
    [switch] $SkipVerify
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── 남길 파일 ─────────────────────────────────────────────
$Keep = @(
    'camino-day01-bike-alb.gpx'
    'camino-day02-bike-alb.gpx'
    'camino-day03-alb.gpx'
    'camino-day04-alb.gpx'
    'camino-day05-alb.gpx'
    'camino-day06-alb.gpx'
    'camino-day07-alb.gpx'
    'camino-day09-alb.gpx'
    'camino-day10-bike-alb.gpx'
    'camino-day11-bike-alb.gpx'
    'camino-day12-bike-alb.gpx'
    'camino-day13-alb.gpx'
)

$root = (Resolve-Path -LiteralPath $Path).Path
if ([string]::IsNullOrWhiteSpace($Backup)) { $Backup = Join-Path $root 'backup' }

Write-Host ''
Write-Host '  Camino 2027 · 배포 파일 정리' -ForegroundColor Cyan
Write-Host ('  대상 폴더 : {0}' -f $root)
Write-Host ('  보관 폴더 : {0}' -f $Backup)
Write-Host ''

# ── 1. 남길 12개가 다 있는지 먼저 확인 ────────────────────
$missing = @()
foreach ($n in $Keep) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $n) -PathType Leaf)) { $missing += $n }
}
if ($missing.Count -gt 0) {
    Write-Host '  배포용 파일이 없습니다 - 아무것도 옮기지 않았습니다.' -ForegroundColor Red
    $missing | ForEach-Object { Write-Host ('    없음  {0}' -f $_) -ForegroundColor Red }
    throw '12개 파일을 모두 확인한 뒤 다시 실행하세요.'
}

# ── 2. 내용 검사 (트랙·웨이포인트·고도) ───────────────────
$report = @()
if (-not $SkipVerify) {
    Write-Host '  파일 검사' -ForegroundColor Cyan
    foreach ($n in $Keep) {
        $f    = Join-Path $root $n
        $txt  = Get-Content -LiteralPath $f -Raw -Encoding UTF8
        $trk  = ([regex]::Matches($txt, '<trkpt[\s>]')).Count
        $wpt  = ([regex]::Matches($txt, '<wpt[\s>]')).Count
        $ele  = ([regex]::Matches($txt, '<ele>')).Count
        $kb   = [math]::Round((Get-Item -LiteralPath $f).Length / 1KB)
        $ok   = ($trk -gt 100)
        $mark = if ($ok) { 'OK  ' } else { '주의' }
        $col  = if ($ok) { 'DarkGray' } else { 'Yellow' }
        Write-Host ('    {0} {1,-28} {2,6} 점  웨이포인트 {3,4}  고도 {4,6}  {5,5} KB' `
                    -f $mark, $n, $trk, $wpt, $ele, $kb) -ForegroundColor $col
        $report += [pscustomobject]@{
            File = $n; TrackPoints = $trk; Waypoints = $wpt; Elevations = $ele; KB = $kb
        }
        if (-not $ok) { Write-Warning ('{0} 의 트랙 점이 너무 적습니다 ({1}개)' -f $n, $trk) }
        if ($wpt -eq 0) { Write-Warning ('{0} 에 알베르게 웨이포인트가 없습니다' -f $n) }
    }
    Write-Host ''
}

# ── 3. 옮길 파일 고르기 ───────────────────────────────────
$self = $MyInvocation.MyCommand.Name

function Get-Bucket {
    param([System.IO.FileInfo] $File)

    $n   = $File.Name
    $ext = $File.Extension.ToLowerInvariant()

    if ($n -match '^(Jacobswegen|Voorzieningen|Facilities|Update-NL)') { return 'source' }
    if ($ext -eq '.pdf')                                              { return 'source' }
    if ($n -eq 'camino-frances-ele.gpx')                              { return 'source' }
    if ($ext -eq '.gpx')                                              { return 'gpx'    }
    if ($ext -in @('.py', '.ps1'))                                    { return 'tools'  }
    if ($ext -in @('.txt', '.csv', '.json'))                          { return 'data'   }
    if ($ext -in @('.html', '.htm', '.md'))                           { return 'docs'   }
    return 'misc'
}

$skip = @($self, 'download-manifest.csv')      # 이 스크립트와 자기가 만든 목록은 그대로 둠

$candidates = Get-ChildItem -LiteralPath $root -File |
    Where-Object { $Keep -notcontains $_.Name -and $skip -notcontains $_.Name }

if (-not $IncludeTools) {
    $candidates = $candidates | Where-Object { $_.Extension -notin @('.py', '.ps1') }
}

if (-not $candidates) {
    Write-Host '  옮길 파일이 없습니다. 이미 정리되어 있습니다.' -ForegroundColor Green
} else {

    # ── 4. 이동 ───────────────────────────────────────────
    $moved = 0
    $bytes = 0L
    $byBucket = @{}

    foreach ($f in ($candidates | Sort-Object Name)) {
        $bucket = Get-Bucket -File $f
        $dir    = Join-Path $Backup $bucket

        if (-not (Test-Path -LiteralPath $dir)) {
            if ($PSCmdlet.ShouldProcess($dir, '폴더 만들기')) {
                New-Item -ItemType Directory -Path $dir -Force | Out-Null
            }
        }

        $dest = Join-Path $dir $f.Name
        if (Test-Path -LiteralPath $dest) {          # 이름 충돌 → 날짜시각 덧붙임
            $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
            $dest  = Join-Path $dir ('{0}_{1}{2}' -f $f.BaseName, $stamp, $f.Extension)
        }

        if ($PSCmdlet.ShouldProcess($f.FullName, ('backup\{0} 로 이동' -f $bucket))) {
            Move-Item -LiteralPath $f.FullName -Destination $dest
        }
        $moved++
        $bytes += $f.Length
        if (-not $byBucket.ContainsKey($bucket)) { $byBucket[$bucket] = 0 }
        $byBucket[$bucket]++
    }

    Write-Host '  이동 결과' -ForegroundColor Cyan
    foreach ($k in ($byBucket.Keys | Sort-Object)) {
        Write-Host ('    backup\{0,-7} {1,3} 개' -f $k, $byBucket[$k])
    }
    Write-Host ('    합계 {0} 개 · {1} MB' -f $moved, [math]::Round($bytes / 1MB, 1))
    Write-Host ''
}

# ── 5. 웹사이트 route 폴더로 복사 (선택) ──────────────────
if (-not [string]::IsNullOrWhiteSpace($PublishTo)) {
    if (-not (Test-Path -LiteralPath $PublishTo)) {
        if ($PSCmdlet.ShouldProcess($PublishTo, '폴더 만들기')) {
            New-Item -ItemType Directory -Path $PublishTo -Force | Out-Null
        }
    }
    foreach ($n in $Keep) {
        $src = Join-Path $root $n
        if ($PSCmdlet.ShouldProcess($n, ('{0} 로 복사' -f $PublishTo))) {
            Copy-Item -LiteralPath $src -Destination (Join-Path $PublishTo $n) -Force
        }
    }
    Write-Host ('  {0} 로 12개 복사 완료' -f $PublishTo) -ForegroundColor Green
    Write-Host ''
}

# ── 6. 남은 것 확인 ───────────────────────────────────────
$left = Get-ChildItem -LiteralPath $root -File | Sort-Object Name
Write-Host ('  남은 파일 {0} 개' -f $left.Count) -ForegroundColor Cyan
foreach ($f in $left) {
    $tag = if ($Keep -contains $f.Name) { '배포' } else { '  ' }
    Write-Host ('    {0}  {1,-30} {2,7} KB' -f $tag, $f.Name, [math]::Round($f.Length / 1KB))
}
Write-Host ''

if ($report.Count -gt 0) {
    $csv = Join-Path $root 'download-manifest.csv'
    if ($PSCmdlet.ShouldProcess($csv, '목록 저장')) {
        $report | Export-Csv -LiteralPath $csv -NoTypeInformation -Encoding UTF8
        Write-Host ('  목록 저장 : {0}' -f $csv) -ForegroundColor DarkGray
    }
}
Write-Host '  끝났습니다.' -ForegroundColor Green
Write-Host ''
