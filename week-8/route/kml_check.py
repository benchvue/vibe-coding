#!/usr/bin/env python3
"""
kml_check.py -- does this KML actually carry elevation, and can we use it?

KML coordinates are written as lon,lat,altitude. The altitude is optional and
very often either missing or a column of zeros. On top of that, if the
placemark says altitudeMode=clampToGround then any altitude present is ignored
by Google Earth -- the line is draped on the terrain instead. So "the file has
a third number" is not the same as "the file has elevation".

This reports what is really in there, per placemark, and can convert to GPX
keeping whatever real elevation exists.

Usage
    python kml_check.py camino.kml
    python kml_check.py camino.kmz --to-gpx camino-from-kml.gpx
    python kml_check.py camino.kml --name "^Camino Frances$" --to-gpx out.gpx
"""

import argparse
import math
import os
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

KML_NS = "{http://www.opengis.net/kml/2.2}"
GX_NS = "{http://www.google.com/kml/ext/2.2}"


def haversine_km(a, b):
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 2 * 6371.0088 * math.asin(math.sqrt(h))


def load_root(path):
    """Read .kml, or the doc.kml inside a .kmz."""
    if path.lower().endswith(".kmz"):
        with zipfile.ZipFile(path) as z:
            names = [n for n in z.namelist() if n.lower().endswith(".kml")]
            if not names:
                raise SystemExit("No .kml inside %s" % path)
            sys.stderr.write("Reading %s from the kmz\n" % names[0])
            return ET.fromstring(z.read(names[0]))
    return ET.parse(path).getroot()


def local(tag):
    return tag.split("}")[-1]


def parse_coords(text):
    """KML coordinate blob -> [(lat, lon, alt_or_None)]."""
    pts = []
    for token in text.replace("\n", " ").replace("\t", " ").split():
        bits = token.split(",")
        if len(bits) < 2:
            continue
        try:
            lon, lat = float(bits[0]), float(bits[1])
            alt = float(bits[2]) if len(bits) > 2 and bits[2] != "" else None
        except ValueError:
            continue
        pts.append((lat, lon, alt))
    return pts


def placemarks(root):
    """[(name, altitude_mode, [(lat,lon,alt)])] for every line-like placemark."""
    out = []
    for pm in root.iter():
        if local(pm.tag) != "Placemark":
            continue
        nm = None
        for child in pm:
            if local(child.tag) == "name":
                nm = (child.text or "").strip()
                break

        mode = ""
        for e in pm.iter():
            if local(e.tag) == "altitudeMode" and e.text:
                mode = e.text.strip()
                break

        pts = []
        # gx:Track stores each point in its own <gx:coord>lon lat alt</gx:coord>
        for c in pm.iter():
            if local(c.tag) == "coord" and c.text:
                bits = c.text.split()
                if len(bits) >= 2:
                    pts.append((float(bits[1]), float(bits[0]),
                                float(bits[2]) if len(bits) > 2 else None))
        if not pts:
            for c in pm.iter():
                if local(c.tag) == "coordinates" and c.text:
                    pts.extend(parse_coords(c.text))
        if len(pts) > 1:
            out.append((nm or "(no name)", mode, pts))
    return out


def stats(pts):
    alts = [p[2] for p in pts if p[2] is not None]
    nonzero = [a for a in alts if abs(a) > 0.5]
    km = sum(haversine_km((pts[i][0], pts[i][1]), (pts[i + 1][0], pts[i + 1][1]))
             for i in range(len(pts) - 1))
    ascent, prev = 0.0, None
    for p in pts:
        if p[2] is None:
            continue
        if prev is not None and p[2] > prev:
            ascent += p[2] - prev
        prev = p[2]
    return {
        "km": km,
        "n": len(pts),
        "with_alt": len(alts),
        "nonzero": len(nonzero),
        "lo": min(alts) if alts else None,
        "hi": max(alts) if alts else None,
        "ascent": ascent,
    }


def verdict(s, mode):
    if s["with_alt"] == 0:
        return "NO elevation (only lon,lat pairs)"
    if s["nonzero"] == 0:
        return "NO elevation (third value is all zeros)"
    if mode.lower() == "clamptoground":
        return "has numbers, but altitudeMode=clampToGround -- Google Earth ignores them"
    return "REAL elevation (%.0f..%.0f m, ascent %.0f m)" % (s["lo"], s["hi"], s["ascent"])


def write_gpx(path, tracks):
    gpx = ET.Element("gpx", {"version": "1.1", "creator": "kml_check.py",
                             "xmlns": "http://www.topografix.com/GPX/1/1"})
    for name, _mode, pts in tracks:
        trk = ET.SubElement(gpx, "trk")
        ET.SubElement(trk, "name").text = name
        seg = ET.SubElement(trk, "trkseg")
        for lat, lon, alt in pts:
            p = ET.SubElement(seg, "trkpt",
                              {"lat": "%.7f" % lat, "lon": "%.7f" % lon})
            if alt is not None and abs(alt) > 0.5:
                ET.SubElement(p, "ele").text = "%.1f" % alt
    ET.indent(gpx, space="  ")
    ET.ElementTree(gpx).write(path, encoding="utf-8", xml_declaration=True)


def main():
    ap = argparse.ArgumentParser(description="Check a KML/KMZ for elevation data")
    ap.add_argument("kml", help=".kml or .kmz file")
    ap.add_argument("--name", help="regex: only placemarks whose name matches")
    ap.add_argument("--to-gpx", metavar="OUT", help="also write the selection as GPX")
    ap.add_argument("--top", type=int, default=25,
                    help="how many placemarks to list (default 25)")
    args = ap.parse_args()

    pms = placemarks(load_root(args.kml))
    if not pms:
        raise SystemExit("No line placemarks found in %s" % args.kml)

    if args.name:
        rx = re.compile(args.name, re.I)
        pms = [p for p in pms if rx.search(p[0])]
        if not pms:
            raise SystemExit("Nothing matched %r" % args.name)

    print("%d placemark(s)\n" % len(pms))
    shown = sorted(pms, key=lambda p: -len(p[2]))[: args.top]
    any_real = False
    for name, mode, pts in shown:
        s = stats(pts)
        v = verdict(s, mode)
        if v.startswith("REAL"):
            any_real = True
        print("%-42s %7.1f km %6d pts  %s"
              % (name[:42], s["km"], s["n"], v))
        if mode:
            print("%-42s altitudeMode=%s" % ("", mode))

    if len(pms) > len(shown):
        print("\n(%d more not shown -- raise --top)" % (len(pms) - len(shown)))

    print("")
    if any_real:
        print("At least one placemark carries usable elevation.")
    else:
        print("No usable elevation in this file. Google Earth still draws an")
        print("elevation profile because it drapes the line over its own terrain")
        print("model -- that profile comes from Google, not from your file.")

    if args.to_gpx:
        write_gpx(args.to_gpx, pms)
        print("\nWrote %s (%d tracks)" % (args.to_gpx, len(pms)))


if __name__ == "__main__":
    main()
