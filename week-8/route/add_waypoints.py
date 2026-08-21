#!/usr/bin/env python3
"""
add_waypoints.py -- put albergues, stamps and other facilities onto your day GPX.

The santiago.nl "Facilities" file holds every waypoint for a whole camino. This
keeps only the ones near your actual track, splits them by day, and writes them
into each day's GPX as <wpt> entries that Garmin and OsmAnd show as icons.

Discovery first, like the track filtering: run --list-types to see what kinds of
waypoint the file actually contains before you filter on them.

Usage
    # 1. what is in the facilities file?
    python add_waypoints.py --facilities Facilities.gpx --list-types

    # 2. everything within 500 m of each day's track
    python add_waypoints.py --facilities Facilities.gpx --all

    # 3. only albergues and stamp points
    python add_waypoints.py --facilities Facilities.gpx --all ^
        --types "albergue|refugio|sello|stamp"

Output: camino-dayNN-poi.gpx (originals untouched).
"""

import argparse
import glob
import math
import os
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter

GPX_NS = "http://www.topografix.com/GPX/1/1"


def haversine_km(a, b):
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 2 * 6371.0088 * math.asin(math.sqrt(h))


def ns_of(root):
    return root.tag[: root.tag.index("}") + 1] if root.tag.startswith("{") else ""


HTML_TAG = re.compile(r"<[^>]+>")
HTML_BR = re.compile(r"<br\s*/?>", re.I)


def clean_html(text):
    """santiago.nl descriptions are HTML. Devices show the raw markup, so
    turn <br> into separators, drop the rest, and unescape entities."""
    if not text or "<" not in text:
        return text.strip()
    t = HTML_BR.sub(" | ", text)
    t = HTML_TAG.sub("", t)
    for a, b in (("&amp;", "&"), ("&nbsp;", " "), ("&quot;", '"'),
                 ("&#39;", "'"), ("&lt;", "<"), ("&gt;", ">")):
        t = t.replace(a, b)
    t = re.sub(r"\s*\|\s*(\|\s*)+", " | ", t)
    return t.strip(" |").strip()


def read_kml_waypoints(path):
    """Point placemarks from a .kml or .kmz."""
    if path.lower().endswith(".kmz"):
        import zipfile
        with zipfile.ZipFile(path) as z:
            names = [n for n in z.namelist() if n.lower().endswith(".kml")]
            if not names:
                raise SystemExit("No .kml inside %s" % path)
            root = ET.fromstring(z.read(names[0]))
    else:
        root = ET.parse(path).getroot()

    def local(t):
        return t.split("}")[-1]

    out = []
    for pm in root.iter():
        if local(pm.tag) != "Placemark":
            continue
        name = desc = ""
        for child in pm:
            if local(child.tag) == "name" and child.text:
                name = child.text.strip()
            elif local(child.tag) == "description" and child.text:
                desc = child.text.strip()
        style = ""
        for child in pm:
            if local(child.tag) == "styleUrl" and child.text:
                style = child.text.strip().lstrip("#")
        for c in pm.iter():
            if local(c.tag) == "coordinates" and c.text:
                bits = c.text.strip().split(",")
                if len(bits) >= 2:
                    out.append((float(bits[1]), float(bits[0]),
                                name, desc, style, ""))
                break
    return out


def read_waypoints(paths):
    """[(lat, lon, name, desc, sym, type)] from one or more GPX files."""
    out = []
    for path in paths:
        if not os.path.exists(path):
            raise SystemExit("File not found: %s\n(check the exact name with: dir *.gpx *.kml)" % path)
        if path.lower().endswith((".kml", ".kmz")):
            got = read_kml_waypoints(path)
            out.extend(got)
            sys.stderr.write("%s: %d placemarks\n" % (os.path.basename(path), len(got)))
            continue
        root = ET.parse(path).getroot()
        ns = ns_of(root)
        n = 0
        for w in root.iter(ns + "wpt"):
            def txt(tag):
                e = w.find(ns + tag)
                return (e.text or "").strip() if e is not None and e.text else ""
            out.append((float(w.get("lat")), float(w.get("lon")),
                        txt("name"), txt("desc"), txt("sym"), txt("type")))
            n += 1
        sys.stderr.write("%s: %d waypoints\n" % (os.path.basename(path), n))
    return out


def read_track(path):
    root = ET.parse(path).getroot()
    ns = ns_of(root)
    pts = [(float(p.get("lat")), float(p.get("lon")))
           for p in root.iter(ns + "trkpt")]
    if not pts:
        pts = [(float(p.get("lat")), float(p.get("lon")))
               for p in root.iter(ns + "rtept")]
    if not pts:
        raise SystemExit("No track points in %s" % path)
    return pts, root, ns


def nearest_on_track(track, pt, cell):
    """Closest track point and its index, using a coarse grid to stay fast."""
    best_d, best_i = float("inf"), 0
    for i, t in enumerate(track):
        if abs(t[0] - pt[0]) > cell or abs(t[1] - pt[1]) > cell * 1.4:
            continue
        d = haversine_km(t, pt)
        if d < best_d:
            best_d, best_i = d, i
    if best_d == float("inf"):  # nothing in the coarse box, do it the slow way
        for i, t in enumerate(track):
            d = haversine_km(t, pt)
            if d < best_d:
                best_d, best_i = d, i
    return best_d, best_i


def write_with_waypoints(src_root, ns, out_path, wpts):
    """Copy the day GPX and insert waypoints before the track.

    The source elements keep whatever namespace they already carry, so new
    elements must use the same one -- mixing a manual xmlns attribute with
    namespaced children produces a duplicate xmlns and an unreadable file.
    """
    if ns:
        ET.register_namespace("", ns.strip("{}"))
        tag = lambda t: ns + t
        attrib = {"version": "1.1", "creator": "add_waypoints.py"}
    else:
        tag = lambda t: t
        attrib = {"version": "1.1", "creator": "add_waypoints.py",
                  "xmlns": GPX_NS}

    gpx = ET.Element(tag("gpx"), attrib)

    for child in src_root:
        if child.tag == tag("metadata"):
            gpx.append(child)

    for lat, lon, name, desc, sym, typ in wpts:
        w = ET.SubElement(gpx, tag("wpt"),
                          {"lat": "%.7f" % lat, "lon": "%.7f" % lon})
        ET.SubElement(w, tag("name")).text = name or "POI"
        if desc:
            ET.SubElement(w, tag("desc")).text = desc
        if sym:
            ET.SubElement(w, tag("sym")).text = sym
        if typ:
            ET.SubElement(w, tag("type")).text = typ

    for child in src_root:
        if child.tag in (tag("trk"), tag("rte")):
            gpx.append(child)

    ET.indent(gpx, space="  ")
    ET.ElementTree(gpx).write(out_path, encoding="utf-8", xml_declaration=True)


def main():
    ap = argparse.ArgumentParser(description="Add facility waypoints to day GPX files")
    ap.add_argument("--facilities", nargs="+", required=True,
                    help="one or more facilities GPX files")
    ap.add_argument("--list-types", action="store_true",
                    help="show what sym/type values exist, then exit")
    ap.add_argument("--track", help="one route GPX to annotate")
    ap.add_argument("--all", action="store_true",
                    help="process every camino-day*.gpx in the folder "
                         "(skipping ones already annotated)")
    ap.add_argument("--dir", default=".", help="folder holding the day files")
    ap.add_argument("--width", type=float, default=0.5,
                    help="keep waypoints within this many km of the track "
                         "(default 0.5)")
    ap.add_argument("--types",
                    help="regex matched against the name (plus sym/type). "
                         "Add --match-desc to search descriptions too")
    ap.add_argument("--match-desc", action="store_true",
                    help="also match the regex against the description. Off by "
                         "default because descriptions hold street addresses "
                         "that cause false matches")
    ap.add_argument("--raw-desc", action="store_true",
                    help="keep the original HTML description instead of "
                         "stripping it to plain text")
    ap.add_argument("--max", type=int, default=200,
                    help="cap per file; Garmin units choke on huge waypoint "
                         "lists (default 200)")
    ap.add_argument("--suffix", default="-poi",
                    help="output name suffix. A value starting with '-' must "
                         "use an equals sign: --suffix=-alb")
    args = ap.parse_args()

    wpts = read_waypoints(args.facilities)
    if not wpts:
        raise SystemExit("No waypoints found in those files")

    if args.list_types:
        syms = Counter(w[4] or "(no sym)" for w in wpts)
        types = Counter(w[5] or "(no type)" for w in wpts)
        print("\n%d waypoints total\n" % len(wpts))
        print("sym values:")
        for k, n in syms.most_common(30):
            print("  %-32s %5d" % (k[:32], n))
        print("\ntype values:")
        for k, n in types.most_common(30):
            print("  %-32s %5d" % (k[:32], n))
        first = Counter((w[2].split() or ["(blank)"])[0] for w in wpts)
        print("\nfirst word of name (usually the real category):")
        for k, n in first.most_common(20):
            print("  %-32s %5d" % (k[:32], n))
        print("\nsample names:")
        for w in wpts[:8]:
            print("  %s | %s" % (w[2][:50], w[3][:60]))
        return

    if not args.raw_desc:
        wpts = [(a, b, clean_html(c), clean_html(d), e, f)
                for a, b, c, d, e, f in wpts]

    if args.types:
        rx = re.compile(args.types, re.I)
        before = len(wpts)
        fields = (lambda w: " ".join((w[2], w[3], w[4], w[5]))) if args.match_desc \
            else (lambda w: " ".join((w[2], w[4], w[5])))
        wpts = [w for w in wpts if rx.search(fields(w))]
        print("Type filter: %d of %d waypoints match\n" % (len(wpts), before))
        if not wpts:
            raise SystemExit("Nothing matched -- try --list-types first")

    if args.all:
        files = sorted(f for f in glob.glob(os.path.join(args.dir, "camino-day*.gpx"))
                       if args.suffix not in os.path.basename(f))
        if not files:
            raise SystemExit("No camino-day*.gpx in %s" % args.dir)
    elif args.track:
        files = [args.track]
    else:
        raise SystemExit("Give --track FILE or --all")

    cell = args.width / 100.0 + 0.02  # degrees, generous coarse filter
    grand = 0
    for path in files:
        track, root, ns = read_track(path)
        keep = []
        for w in wpts:
            d, i = nearest_on_track(track, (w[0], w[1]), cell)
            if d <= args.width:
                keep.append((i, d, w))
        keep.sort(key=lambda k: k[0])  # in order along the day's route

        dropped = 0
        if len(keep) > args.max:
            keep.sort(key=lambda k: k[1])          # closest first
            keep = keep[: args.max]
            keep.sort(key=lambda k: k[0])          # back into route order
            dropped = 1

        tag = os.path.splitext(os.path.basename(path))[0]
        out = os.path.join(args.dir, "%s%s.gpx" % (tag, args.suffix))
        write_with_waypoints(root, ns, out, [k[2] for k in keep])
        grand += len(keep)
        msg = "%s: %3d waypoints -> %s" % (tag, len(keep), os.path.basename(out))
        if dropped:
            msg += "  (capped at --max)"
        print(msg)

    print("\n%d waypoints placed across %d files" % (grand, len(files)))
    if grand == 0:
        print("Nothing landed. Is the facilities file for this camino? "
              "Try a larger --width.")


if __name__ == "__main__":
    main()
