# Camino Francés 2027 — GPX / TCX 파일 규격

자전거 내비게이션에서 다운로드·표시할 때 필요한 정보입니다.
파일은 12개(주행일 기준), 모두 UTF-8, GPX 1.1 표준이며 확장 스키마를 쓰지 않습니다.

---

## 1. 파일 세트

| 날짜 | 파일 | 거리 | 상승 | 비고 |
|---|---|---|---|---|
| Day 1 | `camino-day01-bike-alb-photo-icons.gpx` | 45.8 km | 1,741 m | 나폴레옹 루트 |
| Day 2 | `camino-day02-bike-alb-photo-icons.gpx` | 68.9 km | 944 m | 페르돈 하산 우회 |
| Day 3 | `camino-day03-alb-photo-icons.gpx` | 61.3 km | 908 m | |
| Day 4 | `camino-day04-alb-photo-icons.gpx` | 58.7 km | 832 m | |
| Day 5 | `camino-day05-alb-photo-icons.gpx` | 90.0 km | 940 m | 최장 구간 |
| Day 6 | `camino-day06-alb-photo-icons.gpx` | 82.3 km | 516 m | 메세타 |
| Day 7 | `camino-day07-alb-photo-icons.gpx` | 54.7 km | 261 m | |
| Day 8 | — | 0 km | — | 레온 휴식일, 파일 없음 |
| Day 9 | `camino-day09-alb-photo-icons.gpx` | 68.9 km | 666 m | |
| Day 10 | `camino-day10-bike-alb-photo-icons.gpx` | 74.3 km | 908 m | LE-142 도로 우회 |
| Day 11 | `camino-day11-bike-alb-photo-icons.gpx` | 62.3 km | 1,067 m | 우회 2회 |
| Day 12 | `camino-day12-bike-alb-photo-icons.gpx` | 76.3 km | 1,337 m | |
| Day 13 | `camino-day13-alb-photo-icons.gpx` | 38.9 km | 606 m | 산티아고 도착 |

**합계 782.4 km / 10,726 m.** 각 파일에 `.tcx` 동명 파일이 함께 있습니다(선택).

### 파일명 접미사의 의미

```
camino-day10-bike-alb-photo-icons.gpx
            └bike  자전거 우회로가 접합된 날 (1, 2, 10, 11, 12)
                 └alb    알베르게 웨이포인트 포함
                     └photo  포토존 웨이포인트 포함
                          └icons  가민 심볼로 정규화됨
```

배포용으로는 `camino-2027-day10.gpx` 처럼 단순화해도 무방합니다.

---

## 2. GPX 구조

```xml
<?xml version='1.0' encoding='utf-8'?>
<gpx version="1.1" creator="..." xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Camino day10</name></metadata>

  <wpt lat="42.4888143" lon="-6.3614880">
    <ele>1505.0</ele>
    <name>Cruz de Ferro</name>          <!-- 영문, 길이 제한 없음 -->
    <cmt>철십자가 · 해발 1505 m</cmt>    <!-- 한글 -->
    <desc>Day 10 | 철십자가 · 해발 1505 m</desc>
    <sym>Summit</sym>                   <!-- 아이콘 -->
    <type>photo</type>                  <!-- 분류용 -->
  </wpt>
  ...

  <trk>
    <name>Camino day10</name>
    <trkseg>
      <trkpt lat="42.4811376" lon="-6.2847357"><ele>1149.0</ele></trkpt>
      ...
    </trkseg>
  </trk>
</gpx>
```

**중요한 점 세 가지**

- 경로는 `<trk>`입니다. `<rte>`는 없습니다. 파서가 `rte`만 읽으면 빈 파일로 보입니다.
- 모든 `<trkpt>`에 `<ele>`가 있습니다. 값은 EU-DEM(Copernicus) 25 m 격자에서 조회한 뒤 5점 이동평균으로 다듬은 것입니다.
- `<wpt>`는 트랙과 독립적인 최상위 요소입니다. 트랙 위에 정확히 놓여 있지 않고 최대 500 m(포토존은 3 km)까지 떨어져 있을 수 있습니다.

### 트랙 밀도

포인트 간격 약 50 m, 하루 900~1,800점, 파일 크기 90~200 KB입니다.
표시 성능이 문제되면 다운샘플링해도 형태가 거의 변하지 않습니다.

---

## 3. 웨이포인트 분류

`<sym>` 값으로 구분합니다. 총 519개.

| `sym` | 개수 | 의미 | 아이콘 |
|---|---|---|---|
| `Lodging` | 458 | 순례자 알베르게 및 숙소 | 침대 |
| `Church` | 33 | 성당·수도원·예배당 | 십자가 |
| `Scenic Area` | 17 | 포토존·전망 | 카메라 |
| `Restaurant` | 6 | 음식점 | 포크와 나이프 |
| `Summit` | 5 | 고개·정상 | 봉우리 |

이 이름들은 **가민 표준 심볼명**입니다. 다른 앱에서는 자체 아이콘으로 매핑하시면 됩니다.
`<type>`으로도 구분 가능합니다: `photo`는 관광 지점, 값이 없으면 숙소입니다.

### 표시 권장

지도 축척이 작을 때 458개 숙소를 모두 그리면 화면이 덮입니다.
`Summit` → `Scenic Area` → `Restaurant` → `Church` → `Lodging` 순으로
우선 표시하고, 숙소는 확대했을 때만 노출하는 방식을 권합니다.

---

## 4. TCX (선택)

가민 Edge에서 주행 중 알림을 띄우기 위한 별도 포맷입니다. 지도 표시용이 아닙니다.

```xml
<CoursePoint>
  <Name>Cruz de Fe</Name>              <!-- 10자 제한 (기기 제약) -->
  <Time>2027-05-09T08:12:00Z</Time>    <!-- 합성 시각, 15 km/h 가정 -->
  <Position>...</Position>
  <PointType>Summit</PointType>
  <Notes>Cruz de Ferro 철십자가</Notes>
</CoursePoint>
```

`PointType`은 고정 어휘입니다: `Generic`, `Summit`, `Valley`, `Water`, `Food`,
`Danger`, `Left`, `Right`, `Straight`, `First Aid`.
**숙소용 타입이 없어** 알베르게는 `Generic`으로 들어갑니다.

하루 25개로 제한했고, 랜드마크(고개·포토존·성당·음식점)를 먼저 채운 뒤
남는 자리에 숙소를 하루 전 구간에 균등 배치합니다.

**웹 다운로드에는 GPX만 제공해도 충분합니다.** TCX는 가민 사용자용 옵션입니다.

---

## 5. 데이터 출처와 가공 이력

```
santiago.nl 도보 노선 GPX (스페인 전역 165개 트랙, 297,067점)
  → 프랑스길만 추출                     762.4 km / 15,028점
  → 고도 채움 (EU-DEM, 5점 평활)        169~1,508 m / 상승 11,778 m
  → 정류지 40곳 기준 날짜별 분할        12개 파일
  → 알베르게 442곳 삽입                 santiago.nl 시설 데이터
  → 포토존 50곳 삽입                    좌표 수동 확인
  → 5개 날에 도로 우회로 접합           cycle.travel
  → 가민 심볼 정규화
```

**우회로가 접합된 날(1·2·10·11·12일 중 2·10·11·12)** 은 해당 구간이
포장도로로 대체되어 있습니다. Day 1은 나폴레옹 루트 원본을 유지했습니다.

---

## 6. 내비게이션 적용 시 주의사항

**노면 정보가 없습니다.** GPX 규격 자체에 노면 필드가 없어, 자갈인지 아스팔트인지
파일에서 알 수 없습니다. 우회 구간은 경사 기준으로만 선정했습니다.

**7개 날은 도보 노선 그대로입니다.** 경사가 12%를 넘지 않아 자전거 통과가
가능하다고 판단했으나, 실지 답사로 검증된 것은 아닙니다.

**Day 1에 -33% 구간이 있습니다.** 레포에데르 하산이며 의도적으로 남긴 것입니다.
자전거로는 끌고 내려가야 하는 구간이므로, 앱에서 경고를 띄우실 거면 이 지점입니다
(약 km 20.0, 43.030,-1.296 부근).

**턴바이턴 안내는 들어 있지 않습니다.** GPX 트랙에는 방향 지시가 없으므로,
앱에서 자체 라우팅 엔진으로 재계산하거나 트랙 팔로잉으로 처리해야 합니다.

**시간 정보가 없습니다.** `<trkpt>`에 `<time>`이 없습니다. 이를 필수로 요구하는
파서는 실패할 수 있으니, 없으면 무시하도록 처리하십시오.

---

## 7. 라이선스

경로 및 시설 데이터: santiago.nl (OpenStreetMap 기반, ODbL)
고도: EU-DEM / Copernicus
우회 경로: cycle.travel (OpenStreetMap 기반)

재배포 시 출처 표기가 필요하며, santiago.nl의 배포 조건은 별도 확인이 필요합니다.
생성 일자와 원본 파일 버전(2026-06-16판)을 함께 표기하시기 바랍니다.
