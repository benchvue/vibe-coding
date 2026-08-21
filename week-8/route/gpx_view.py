#!/usr/bin/env python3
"""
gpx_view.py -- draw one or more GPX files into a single standalone HTML page.

Made for comparing routes: put the BRouter version and the bicigrino version
side by side, toggle them on and off, and read both elevation profiles on one
chart. No API key, no upload, no service. The HTML file works offline apart
from the map tiles.

Usage
    python gpx_view.py camino-day10-v1.gpx camino-day10.gpx -o compare-day10.html

    # label the lines instead of using file names
    python gpx_view.py a.gpx b.gpx --labels "BRouter,bicigrino" -o out.html

    # also print a bikerouter.de permalink for the stops in a day file
    python gpx_view.py --bikerouter day10.txt

Notes
    Tracks are thinned to --max-points per line for browser performance; the
    distance and ascent figures are always computed from every original point.
"""

import argparse
import json
import math
import os
import re
import sys
import urllib.parse
import xml.etree.ElementTree as ET

LATLON_RE = re.compile(r"(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)")
COLORS = ["#e2445c", "#2f6fd0", "#1d9e75", "#ba7517", "#7f77dd", "#d4537e"]


def haversine_km(a, b):
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 2 * 6371.0088 * math.asin(math.sqrt(h))


def read_gpx(path):
    root = ET.parse(path).getroot()
    ns = root.tag[: root.tag.index("}") + 1] if root.tag.startswith("{") else ""
    pts = []
    for tag in ("trkpt", "rtept"):
        for p in root.iter(ns + tag):
            ele = p.find(ns + "ele")
            pts.append(
                (
                    float(p.get("lat")),
                    float(p.get("lon")),
                    float(ele.text) if ele is not None and ele.text else None,
                )
            )
        if pts:
            break
    if not pts:
        raise SystemExit("No points in %s" % path)
    return pts


def profile(pts):
    """[(cumulative_km, ele_or_None)] plus totals, from every original point."""
    out, dist, ascent, prev_ele = [], 0.0, 0.0, None
    for i, p in enumerate(pts):
        if i:
            dist += haversine_km((pts[i - 1][0], pts[i - 1][1]), (p[0], p[1]))
        if p[2] is not None:
            if prev_ele is not None and p[2] > prev_ele:
                ascent += p[2] - prev_ele
            prev_ele = p[2]
        out.append((dist, p[2]))
    return out, dist, ascent


def thin(seq, limit):
    if len(seq) <= limit:
        return seq
    step = len(seq) / float(limit)
    return [seq[int(i * step)] for i in range(limit)] + [seq[-1]]


def bikerouter_url(day_file):
    """Permalink that opens these stops in bikerouter.de for eyeballing."""
    with open(day_file, encoding="utf-8") as f:
        lines = [l.strip() for l in f if l.strip() and not l.strip().startswith("#")]
    q = urllib.parse.parse_qs(urllib.parse.urlsplit(lines[0]).query)

    def pt(s):
        m = LATLON_RE.search(s)
        return "%s,%s" % (m.group(2), m.group(1))  # lon,lat for BRouter

    stops = [pt(q["origin"][0])]
    if q.get("waypoints"):
        stops += [pt(w) for w in q["waypoints"][0].split("|") if w.strip()]
    stops.append(pt(q["destination"][0]))
    return (
        "https://bikerouter.de/#map=10/0/0/standard&lonlats="
        + "|".join(stops)
        + "&profile=trekking"
    )


HTML = """<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>%(title)s</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css"/>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"></script>
<style>
 body{margin:0;font:14px system-ui,sans-serif;color:#222}
 #map{height:65vh}
 #panel{padding:10px 14px}
 table{border-collapse:collapse;font-size:13px}
 td,th{padding:3px 10px 3px 0;text-align:left}
 .sw{display:inline-block;width:12px;height:12px;border-radius:2px;vertical-align:middle}
 svg{width:100%%;height:180px;background:#fafafa;border:1px solid #ddd}
</style></head><body>
<div id="map"></div>
<div id="panel">
 <table id="stats"></table>
 <svg id="ele" viewBox="0 0 1000 180" preserveAspectRatio="none"></svg>
 <p style="color:#666;font-size:12px">Map data (c) OpenStreetMap contributors</p>
</div>
<script>
const TRACKS = %(data)s;
const map = L.map('map');
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  {maxZoom:19, attribution:'(c) OpenStreetMap'}).addTo(map);

let bounds = null;
const rows = [];
TRACKS.forEach(t => {
  const line = L.polyline(t.pts.map(p=>[p[0],p[1]]),
                          {color:t.color, weight:4, opacity:.8}).addTo(map);
  t.line = line;
  bounds = bounds ? bounds.extend(line.getBounds()) : line.getBounds();
  rows.push('<tr><td><input type="checkbox" checked onchange="tog('+t.i+',this.checked)">'
    + '</td><td><span class="sw" style="background:'+t.color+'"></span></td>'
    + '<td>'+t.label+'</td><td>'+t.km.toFixed(1)+' km</td>'
    + '<td>'+(t.ascent?Math.round(t.ascent)+' m':'-')+'</td>'
    + '<td>'+t.n+' pts</td></tr>');
});
document.getElementById('stats').innerHTML =
  '<tr><th></th><th></th><th>track</th><th>distance</th><th>ascent</th><th>points</th></tr>'
  + rows.join('');
if (bounds) map.fitBounds(bounds.pad(0.05));
function tog(i,on){ const t=TRACKS[i]; on ? t.line.addTo(map) : t.line.remove(); }

const withEle = TRACKS.filter(t => t.prof.some(p => p[1] !== null));
if (withEle.length) {
  const maxKm = Math.max(...withEle.map(t => t.prof[t.prof.length-1][0]));
  const eles = withEle.flatMap(t => t.prof.map(p=>p[1]).filter(v=>v!==null));
  const lo = Math.min(...eles), hi = Math.max(...eles), span = (hi-lo)||1;
  const svg = document.getElementById('ele');
  let out = '';
  withEle.forEach(t => {
    const d = t.prof.filter(p=>p[1]!==null)
      .map(p => (p[0]/maxKm*1000).toFixed(1)+','+(170-(p[1]-lo)/span*160).toFixed(1))
      .join(' ');
    out += '<polyline fill="none" stroke="'+t.color+'" stroke-width="1.5" points="'+d+'"/>';
  });
  out += '<text x="4" y="12" font-size="11" fill="#666">'+Math.round(hi)+' m</text>';
  out += '<text x="4" y="168" font-size="11" fill="#666">'+Math.round(lo)+' m</text>';
  out += '<text x="940" y="168" font-size="11" fill="#666">'+maxKm.toFixed(0)+' km</text>';
  svg.innerHTML = out;
}
</script></body></html>
"""


def main():
    ap = argparse.ArgumentParser(description="Draw GPX files into one HTML page")
    ap.add_argument("gpx", nargs="*", help="GPX files to draw")
    ap.add_argument("-o", "--out", default="gpx-view.html")
    ap.add_argument("--labels", help="comma separated names, one per file")
    ap.add_argument("--max-points", type=int, default=3000)
    ap.add_argument("--bikerouter", metavar="DAYFILE",
                    help="print a bikerouter.de permalink for a dayNN.txt")
    args = ap.parse_args()

    if args.bikerouter:
        print(bikerouter_url(args.bikerouter))
        return
    if not args.gpx:
        raise SystemExit("Give at least one GPX file, or --bikerouter dayNN.txt")

    labels = args.labels.split(",") if args.labels else None
    tracks = []
    for i, path in enumerate(args.gpx):
        pts = read_gpx(path)
        prof, km, ascent = profile(pts)
        label = labels[i].strip() if labels and i < len(labels) else os.path.basename(path)
        tracks.append(
            {
                "i": i,
                "label": label,
                "color": COLORS[i % len(COLORS)],
                "km": km,
                "ascent": ascent,
                "n": len(pts),
                "pts": [[round(p[0], 6), round(p[1], 6)]
                        for p in thin(pts, args.max_points)],
                "prof": [[round(d, 3), (round(e, 1) if e is not None else None)]
                         for d, e in thin(prof, args.max_points)],
            }
        )
        print("%-28s %7.1f km  ascent %5.0f m  %d points"
              % (label, km, ascent, len(pts)))

    with open(args.out, "w", encoding="utf-8") as f:
        f.write(HTML % {"title": os.path.basename(args.out),
                        "data": json.dumps(tracks)})
    print("\nWrote %s -- open it in a browser" % args.out)


if __name__ == "__main__":
    main()
