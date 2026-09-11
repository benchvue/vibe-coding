#!/usr/bin/env python3
"""주행 GPX 에 명소(<wpt>)를 붙입니다.
사용:  python add-waypoints.py ride.gpx pois.csv out.gpx
       (Windows 도 그대로 — 출력을 > 로 돌리지 말고 세 번째 인자로 파일 이름을 주세요)
pois.csv (UTF-8, 첫 줄 제목):
  lat,lon,name,desc,sym
  40.85179,-74.79152,Home,집 앞 출발점,Flag
sym: Lodging Church "Scenic Area" Restaurant Summit Bar Flag Water Bridge "Bike Shop" Museum Park Shop Danger Toilet
"""
import sys, csv, html
if len(sys.argv)<4:
    sys.exit("사용: python add-waypoints.py ride.gpx pois.csv out.gpx")
gpx=open(sys.argv[1],encoding="utf-8").read()
rows=list(csv.DictReader(open(sys.argv[2],encoding="utf-8-sig")))
w=[]
for r in rows:
    g=lambda k:(r.get(k) or "").strip()
    if not g("lat") or not g("lon"): continue
    w.append('  <wpt lat="%s" lon="%s"><name>%s</name><desc>%s</desc><sym>%s</sym></wpt>'
             %(g("lat"), g("lon"), html.escape(g("name")), html.escape(g("desc")), g("sym") or "Waypoint"))
i=gpx.find("<trk")                      # GPX 규격상 wpt 는 trk 앞
if i<0: i=gpx.rfind("</gpx>")
open(sys.argv[3],"w",encoding="utf-8",newline="\n").write(gpx[:i]+"\n".join(w)+"\n"+gpx[i:])
print("%d 개 명소를 붙여 %s 에 저장했습니다"%(len(w),sys.argv[3]))
