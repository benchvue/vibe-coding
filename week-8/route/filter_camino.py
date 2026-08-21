#!/usr/bin/env python3
"""
filter_camino.py -- pull one route out of a GPX that contains many.

The santiago.nl file holds every pilgrim path in Spain. This extracts just the
Camino Frances (or whichever route you point it at), two ways:

  --list                  show every track in the file so you can see the names
  --name REGEX            keep tracks whose name matches
  --corridor "day*.txt"   keep only what runs near your own day-stop chain

The corridor mode is the reliable one when names are unhelpful: it measures
each point against the polyline through your stops (Saint-Jean -> Santiago)
and keeps what falls inside --width km of it.

Usage
    python filter_camino.py --track all-spain.gpx --list
    python filter_camino.py --track all-spain.gpx --name "franc" -o frances.gpx
    python filter_camino.py --track all-spain.gpx --corridor "day*.txt" ^
        --width 8 --clip --merge -o camino-frances.gpx
"""

import argparse
import glob
import math
import re
import sys
import urllib.parse
import xml.etree.ElementTree as ET

LATLON_RE = re.compile(r"(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)")
R_KM = 6371.0088


def haversine_km(a, b):
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 2 * R_KM * math.asin(math.sqrt(h))


def to_xy(lat, lon, lat0):
    """Flat local projection, km. Good enough over Spain for distance tests."""
    return (math.radians(lon) * R_KM * math.cos(math.radians(lat0)),
            math.radians(lat) * R_KM)


def point_seg_km(p, a, b):
    """Distance from p to segment ab, and how far along ab the foot lands."""
    px, py = p
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L2))
    cx, cy = ax + t * dx, ay + t * dy
    return math.hypot(px - cx, py - cy), t


# --------------------------------------------------------------------------
def read_tracks(path):
    """[(name, [ [(lat,lon,ele), ...], ... ])] -- one entry per <trk>."""
    root = ET.parse(path).getroot()
    ns = root.tag[: root.tag.index("}") + 1] if root.tag.startswith("{") else ""
    tracks = []
    for trk in root.iter(ns + "trk"):
        nm = trk.find(ns + "name")
        name = (nm.text or "").strip() if nm is not None else ""
        segs = []
        for seg in trk.iter(ns + "trkseg"):
            pts = []
            for p in seg.iter(ns + "trkpt"):
                ele = p.find(ns + "ele")
                pts.append((float(p.get("lat")), float(p.get("lon")),
                            float(ele.text) if ele is not None and ele.text else None))
            if pts:
                segs.append(pts)
        if segs:
            tracks.append((name, segs))
    if not tracks:  # some files use routes instead of tracks
        for rte in root.iter(ns + "rte"):
            nm = rte.find(ns + "name")
            pts = [(float(p.get("lat")), float(p.get("lon")), None)
                   for p in rte.iter(ns + "rtept")]
            if pts:
                tracks.append(((nm.text or "").strip() if nm is not None else "", [pts]))
    return tracks


def seg_len_km(pts):
    return sum(haversine_km((pts[i][0], pts[i][1]), (pts[i + 1][0], pts[i + 1][1]))
               for i in range(len(pts) - 1))


def load_corridor(pattern):
    """Ordered stop coordinates from your dayNN.txt files."""
    files = sorted(glob.glob(pattern))
    if not files:
        raise SystemExit("No day files match %r" % pattern)
    stops = []
    for f in files:
        with open(f, encoding="utf-8") as fh:
            lines = [l.strip() for l in fh
                     if l.strip() and not l.strip().startswith("#")]
        q = urllib.parse.parse_qs(urllib.parse.urlsplit(lines[0]).query)

        def pt(s):
            m = LATLON_RE.search(s)
            return (float(m.group(1)), float(m.group(2)))

        day = [pt(q["origin"][0])]
        if q.get("waypoints"):
            day += [pt(w) for w in q["waypoints"][0].split("|") if w.strip()]
        day.append(pt(q["destination"][0]))
        for s in day:
            if not stops or haversine_km(stops[-1], s) > 0.2:
                stops.append(s)
    sys.stderr.write("Corridor: %d stops from %d day files\n" % (len(stops), len(files)))
    return stops


class Corridor:
    def __init__(self, stops):
        self.lat0 = sum(s[0] for s in stops) / len(stops)
        self.xy = [to_xy(s[0], s[1], self.lat0) for s in stops]
        self.cum = [0.0]
        for a, b in zip(self.xy, self.xy[1:]):
            self.cum.append(self.cum[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))

    def distance_and_progress(self, lat, lon):
        p = to_xy(lat, lon, self.lat0)
        best_d, best_s = float("inf"), 0.0
        for i in range(len(self.xy) - 1):
            d, t = point_seg_km(p, self.xy[i], self.xy[i + 1])
            if d < best_d:
                seg = self.cum[i + 1] - self.cum[i]
                best_d, best_s = d, self.cum[i] + t * seg
        return best_d, best_s


# --------------------------------------------------------------------------
def write_gpx(path, name, segments, merge):
    gpx = ET.Element("gpx", {"version": "1.1", "creator": "filter_camino.py",
                             "xmlns": "http://www.topografix.com/GPX/1/1"})
    meta = ET.SubElement(gpx, "metadata")
    ET.SubElement(meta, "name").text = name

    if merge:
        trk = ET.SubElement(gpx, "trk")
        ET.SubElement(trk, "name").text = name
        holders = [ET.SubElement(trk, "trkseg") for _ in segments]
    else:
        holders = []
        for i, _ in enumerate(segments, 1):
            trk = ET.SubElement(gpx, "trk")
            ET.SubElement(trk, "name").text = "%s %d" % (name, i)
            holders.append(ET.SubElement(trk, "trkseg"))

    for holder, pts in zip(holders, segments):
        for lat, lon, ele in pts:
            p = ET.SubElement(holder, "trkpt",
                              {"lat": "%.7f" % lat, "lon": "%.7f" % lon})
            if ele is not None:
                ET.SubElement(p, "ele").text = "%.1f" % ele

    ET.indent(gpx, space="  ")
    ET.ElementTree(gpx).write(path, encoding="utf-8", xml_declaration=True)


def main():
    ap = argparse.ArgumentParser(description="Extract one route from a multi-route GPX")
    ap.add_argument("--track", required=True, help="the big GPX file")
    ap.add_argument("--list", action="store_true", help="show all tracks and exit")
    ap.add_argument("--name", help="regex matched against track names")
    ap.add_argument("--corridor", help="glob for dayNN.txt files, e.g. \"day*.txt\"")
    ap.add_argument("--width", type=float, default=8.0,
                    help="corridor half-width in km (default 8)")
    ap.add_argument("--clip", action="store_true",
                    help="cut segments at the corridor edge instead of "
                         "keeping or dropping whole tracks")
    ap.add_argument("--min-inside", type=float, default=0.5,
                    help="without --clip, fraction of points that must be "
                         "inside to keep a track (default 0.5)")
    ap.add_argument("--min-km", type=float, default=1.0,
                    help="drop kept pieces shorter than this (default 1 km)")
    ap.add_argument("--merge", action="store_true",
                    help="write one track with many segments instead of many tracks")
    ap.add_argument("-o", "--out", default="filtered.gpx")
    args = ap.parse_args()

    tracks = read_tracks(args.track)
    total_pts = sum(len(s) for _, segs in tracks for s in segs)
    print("Loaded %d tracks, %d points\n" % (len(tracks), total_pts))

    if args.list:
        for i, (name, segs) in enumerate(tracks):
            pts = [p for s in segs for p in s]
            km = sum(seg_len_km(s) for s in segs)
            lats = [p[0] for p in pts]
            lons = [p[1] for p in pts]
            print("%3d  %-46s %7.1f km  %6d pts  lat %.2f..%.2f lon %.2f..%.2f"
                  % (i, (name or "(no name)")[:46], km, len(pts),
                     min(lats), max(lats), min(lons), max(lons)))
        return

    kept = []  # (progress, points)

    if args.name:
        rx = re.compile(args.name, re.I)
        for name, segs in tracks:
            if rx.search(name or ""):
                for s in segs:
                    kept.append((0.0, s))
                print("match: %s (%d segments)" % (name, len(segs)))
        if not kept:
            raise SystemExit("Nothing matched %r -- run --list to see the names"
                             % args.name)

    elif args.corridor:
        cor = Corridor(load_corridor(args.corridor))
        for name, segs in tracks:
            for s in segs:
                marks = [cor.distance_and_progress(p[0], p[1]) for p in s]
                inside = [d <= args.width for d, _ in marks]

                if args.clip:
                    run = []
                    for p, ok, (_, prog) in zip(s, inside, marks):
                        if ok:
                            run.append((p, prog))
                        elif run:
                            kept.append((run[0][1], [q[0] for q in run]))
                            run = []
                    if run:
                        kept.append((run[0][1], [q[0] for q in run]))
                else:
                    if sum(inside) / float(len(inside)) >= args.min_inside:
                        kept.append((min(m[1] for m in marks), s))
                        print("keep: %-40s %.0f%% inside"
                              % ((name or "(no name)")[:40],
                                 100.0 * sum(inside) / len(inside)))
    else:
        raise SystemExit("Give --list, --name REGEX or --corridor \"day*.txt\"")

    kept = [(prog, pts) for prog, pts in kept
            if len(pts) > 1 and seg_len_km(pts) >= args.min_km]
    if not kept:
        raise SystemExit("Nothing survived the filter -- try a larger --width")

    kept.sort(key=lambda k: k[0])  # west-to-east order along the corridor
    segments = [pts for _, pts in kept]

    km = sum(seg_len_km(p) for p in segments)
    npts = sum(len(p) for p in segments)
    write_gpx(args.out, "Camino", segments, args.merge)
    print("\n%d pieces, %.1f km, %d points -> %s" % (len(segments), km, npts, args.out))
    if len(segments) > 1:
        print("Gaps between pieces:")
        for a, b in zip(segments, segments[1:]):
            print("   %.2f km" % haversine_km((a[-1][0], a[-1][1]), (b[0][0], b[0][1])))


if __name__ == "__main__":
    main()
