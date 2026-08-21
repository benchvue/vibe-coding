#!/usr/bin/env python3
"""
split_camino_gpx.py -- cut one long Camino GPX into per-day files.

Instead of asking a routing engine to invent a route, this takes a track that
somebody actually rode (e.g. the Camino Frances track from bicigrino.com) and
slices it at your daily stops. The elevation data in the source track is kept.

Your stops come from the same dayNN.txt files you already have: the script
reads the coordinates out of the api=1 URL inside them.

Usage
    # one day
    python split_camino_gpx.py --track camino-frances.gpx --day day10.txt

    # every dayNN.txt in this folder
    python split_camino_gpx.py --track camino-frances.gpx --all

    # let it download the source track for you
    python split_camino_gpx.py --track https://example.com/camino.gpx --all

Output: camino-dayNN.gpx, containing the sliced track plus one waypoint per stop.

Check the report it prints. "stop is 4.2 km off the track" means that town is
not on this particular route variant -- the cut point will be wrong there.
"""

import argparse
import glob
import math
import os
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

LATLON_RE = re.compile(r"(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)")
OFF_TRACK_WARN_KM = 2.0


def haversine_km(a, b):
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 2 * 6371.0088 * math.asin(math.sqrt(h))


# --------------------------------------------------------------------------
def load_track(source):
    """Read every trkpt from a GPX file or URL -> [(lat, lon, ele_or_None)]."""
    if source.lower().startswith("http"):
        sys.stderr.write("Downloading %s ...\n" % source)
        req = urllib.request.Request(
            source, headers={"User-Agent": "split_camino_gpx/1.0"}
        )
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
        local = os.path.basename(urllib.parse.urlsplit(source).path) or "track.gpx"
        with open(local, "wb") as f:
            f.write(data)
        sys.stderr.write("Saved as %s\n" % local)
        root = ET.fromstring(data)
    else:
        root = ET.parse(source).getroot()

    ns = ""
    if root.tag.startswith("{"):
        ns = root.tag[: root.tag.index("}") + 1]

    pts = []
    for trkpt in root.iter(ns + "trkpt"):
        ele = trkpt.find(ns + "ele")
        pts.append(
            (
                float(trkpt.get("lat")),
                float(trkpt.get("lon")),
                float(ele.text) if ele is not None and ele.text else None,
            )
        )
    if not pts:  # some sources publish a route, not a track
        for rtept in root.iter(ns + "rtept"):
            pts.append((float(rtept.get("lat")), float(rtept.get("lon")), None))
    if not pts:
        raise SystemExit("No track points found in %s" % source)
    return pts


def load_day_stops(path):
    """Pull the stop coordinates out of a dayNN.txt api=1 URL."""
    with open(path, encoding="utf-8") as f:
        lines = [l.strip() for l in f if l.strip() and not l.strip().startswith("#")]
    if not lines:
        raise SystemExit("No URL in %s" % path)
    q = urllib.parse.parse_qs(urllib.parse.urlsplit(lines[0]).query)

    def pt(s):
        m = LATLON_RE.search(s)
        if not m:
            raise SystemExit("Not a coordinate: %r in %s" % (s, path))
        return (float(m.group(1)), float(m.group(2)))

    stops = [pt(q["origin"][0])]
    if q.get("waypoints"):
        stops += [pt(w) for w in q["waypoints"][0].split("|") if w.strip()]
    stops.append(pt(q["destination"][0]))
    return stops


# --------------------------------------------------------------------------
def nearest_index(pts, stop, lo=0):
    """Index of the closest track point at or after lo, plus that distance."""
    best_i, best_d = lo, float("inf")
    for i in range(lo, len(pts)):
        d = haversine_km((pts[i][0], pts[i][1]), stop)
        if d < best_d:
            best_i, best_d = i, d
    return best_i, best_d


def slice_day(pts, stops):
    """Cut the track between the first and last stop, walking forward.

    Searching forward from the previous stop keeps things right where the
    route passes near the same place twice.
    """
    marks, lo = [], 0
    for stop in stops:
        i, d = nearest_index(pts, stop, lo)
        marks.append((i, d))
        lo = i  # next stop must come later along the track
    start, end = marks[0][0], marks[-1][0]
    if end <= start:
        raise SystemExit(
            "Stops are not in track order -- is the source track reversed?"
        )
    return pts[start : end + 1], marks


def track_stats(seg):
    dist = sum(
        haversine_km((seg[i][0], seg[i][1]), (seg[i + 1][0], seg[i + 1][1]))
        for i in range(len(seg) - 1)
    )
    ascent = 0.0
    have_ele = [p[2] for p in seg if p[2] is not None]
    if len(have_ele) > 1:
        prev = None
        for p in seg:
            if p[2] is None:
                continue
            if prev is not None and p[2] > prev:
                ascent += p[2] - prev
            prev = p[2]
    return dist, ascent


def write_gpx(path, name, seg, stops, marks):
    gpx = ET.Element(
        "gpx",
        {
            "version": "1.1",
            "creator": "split_camino_gpx.py",
            "xmlns": "http://www.topografix.com/GPX/1/1",
        },
    )
    meta = ET.SubElement(gpx, "metadata")
    ET.SubElement(meta, "name").text = name

    for n, (lat, lon) in enumerate(stops, 1):
        wpt = ET.SubElement(gpx, "wpt", {"lat": "%.7f" % lat, "lon": "%.7f" % lon})
        ET.SubElement(wpt, "name").text = "Stop %d" % n

    trk = ET.SubElement(gpx, "trk")
    ET.SubElement(trk, "name").text = name
    seg_el = ET.SubElement(trk, "trkseg")
    for lat, lon, ele in seg:
        p = ET.SubElement(seg_el, "trkpt", {"lat": "%.7f" % lat, "lon": "%.7f" % lon})
        if ele is not None:
            ET.SubElement(p, "ele").text = "%.1f" % ele

    ET.indent(gpx, space="  ")
    ET.ElementTree(gpx).write(path, encoding="utf-8", xml_declaration=True)


def do_day(pts, day_file, out_dir):
    stops = load_day_stops(day_file)
    seg, marks = slice_day(pts, stops)
    dist, ascent = track_stats(seg)

    tag = os.path.splitext(os.path.basename(day_file))[0]
    out = os.path.join(out_dir, "camino-%s.gpx" % tag)
    write_gpx(out, "Camino %s" % tag, seg, stops, marks)

    print("%s: %6.1f km, ascent %5.0f m, %d points -> %s"
          % (tag, dist, ascent, len(seg), out))
    for n, (i, d) in enumerate(marks, 1):
        flag = "  <-- OFF TRACK" if d > OFF_TRACK_WARN_KM else ""
        print("    stop %d: %5.2f km from track%s" % (n, d, flag))
    return out


def main():
    ap = argparse.ArgumentParser(description="Slice a long Camino GPX by day")
    ap.add_argument("--track", required=True,
                    help="source GPX file or URL of the full route")
    ap.add_argument("--day", help="one dayNN.txt file")
    ap.add_argument("--all", action="store_true",
                    help="process every day*.txt in the folder")
    ap.add_argument("--dir", default=".", help="folder holding day*.txt")
    ap.add_argument("-o", "--out-dir", default=".", help="where to write GPX files")
    args = ap.parse_args()

    pts = load_track(args.track)
    print("Source track: %d points\n" % len(pts))

    if args.all:
        files = sorted(glob.glob(os.path.join(args.dir, "day*.txt")))
        if not files:
            raise SystemExit("No day*.txt found in %s" % args.dir)
        for f in files:
            do_day(pts, f, args.out_dir)
    elif args.day:
        do_day(pts, args.day, args.out_dir)
    else:
        raise SystemExit("Give --day dayNN.txt or --all")


if __name__ == "__main__":
    main()
