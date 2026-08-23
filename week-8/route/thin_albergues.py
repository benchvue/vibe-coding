#!/usr/bin/env python3
"""
thin_albergues.py -- keep the albergues that matter for the day you are riding.

An albergue means three different things depending on where it sits:

  at the start   you slept there last night. Useless today -> removed.
  in the middle  somewhere to get a stamp, water, a toilet -> a few, spaced out.
  at the finish  tonight's bed, and you want options -> all of them kept.

Photo spots, churches, restaurants and summits are never touched.

Stamp preference: municipal, parroquial and Xunta albergues are the reliable
ones during the day. Private places often only open in the afternoon, so they
lose to a municipal one when both sit in the same stretch.

Usage
    python thin_albergues.py --all
    python thin_albergues.py --all --spacing 8 --end-radius 6
    python thin_albergues.py --day camino-day10-...-icons.gpx --suffix=-lite
"""

import argparse
import glob
import math
import os
import re
import xml.etree.ElementTree as ET

GPX_NS = "http://www.topografix.com/GPX/1/1"
LODGING = "Lodging"

# names that mean "open in the daytime, will stamp your credencial"
PREFERRED = re.compile(
    r"municipal|parroquial|xunta|peregrin|asociaci|concello|junta|"
    r"albergue de\b", re.I)


def haversine_km(a, b):
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    h = (math.sin((lat2 - lat1) / 2) ** 2
         + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2)
    return 2 * 6371.0088 * math.asin(math.sqrt(h))


def load(path):
    ET.register_namespace("", GPX_NS)
    tree = ET.parse(path)
    root = tree.getroot()
    ns = root.tag[: root.tag.index("}") + 1] if root.tag.startswith("{") else ""
    return tree, root, ns


def track_of(root, ns):
    pts = [(float(p.get("lat")), float(p.get("lon")))
           for p in root.iter(ns + "trkpt")]
    cum = [0.0]
    for a, b in zip(pts, pts[1:]):
        cum.append(cum[-1] + haversine_km(a, b))
    return pts, cum


def km_along(pts, cum, lat, lon):
    best, bd = 0, float("inf")
    for i, p in enumerate(pts):
        d = haversine_km(p, (lat, lon))
        if d < bd:
            best, bd = i, d
    return cum[best], bd


def text_of(w, ns, tag):
    e = w.find(ns + tag)
    return (e.text or "").strip() if e is not None and e.text else ""


def process(path, out_path, args):
    tree, root, ns = load(path)
    pts, cum = track_of(root, ns)
    if not pts:
        return None
    total = cum[-1]

    beds, others = [], 0
    for w in list(root.iter(ns + "wpt")):
        if text_of(w, ns, "sym") != LODGING:
            others += 1
            continue
        km, off = km_along(pts, cum, float(w.get("lat")), float(w.get("lon")))
        beds.append({"el": w, "km": km, "off": off,
                     "name": text_of(w, ns, "name")})
    beds.sort(key=lambda b: b["km"])

    keep, drop_start, kept_end, kept_mid = [], 0, 0, 0
    middle = []
    for b in beds:
        if b["km"] <= args.start_radius:
            drop_start += 1                      # last night's town
        elif b["km"] >= total - args.end_radius:
            keep.append(b)                       # tonight's town: keep them all
            kept_end += 1
        else:
            middle.append(b)

    # one stamp stop per spacing band, municipal preferred
    band = -1
    for b in middle:
        b["band"] = int(b["km"] // args.spacing)
    for b in middle:
        b["pref"] = 0 if PREFERRED.search(b["name"]) else 1
    chosen = {}
    for b in middle:
        cur = chosen.get(b["band"])
        if cur is None or (b["pref"], b["km"]) < (cur["pref"], cur["km"]):
            chosen[b["band"]] = b
    for b in sorted(chosen.values(), key=lambda x: x["km"]):
        keep.append(b)
        kept_mid += 1

    keep_ids = {id(b["el"]) for b in keep}
    removed = 0
    for b in beds:
        if id(b["el"]) not in keep_ids:
            root.remove(b["el"])
            removed += 1

    ET.indent(root, space="  ")
    tree.write(out_path, encoding="utf-8", xml_declaration=True)
    return {"total_km": total, "beds": len(beds), "removed": removed,
            "start": drop_start, "mid": kept_mid, "end": kept_end,
            "others": others}


def main():
    ap = argparse.ArgumentParser(description="Thin albergue waypoints by role")
    ap.add_argument("--day", help="one GPX file")
    ap.add_argument("--all", action="store_true",
                    help="every camino-day*-icons.gpx in --dir")
    ap.add_argument("--dir", default=".")
    ap.add_argument("--pattern", default="camino-day*-icons.gpx")
    ap.add_argument("--start-radius", type=float, default=3.0,
                    help="drop albergues within this many km of the start "
                         "(you slept there) (default 3)")
    ap.add_argument("--end-radius", type=float, default=5.0,
                    help="keep every albergue within this many km of the "
                         "finish (default 5)")
    ap.add_argument("--spacing", type=float, default=10.0,
                    help="in between, keep about one per this many km "
                         "(default 10)")
    ap.add_argument("--suffix", default="-lite",
                    help="output suffix, or --suffix= to overwrite in place")
    args = ap.parse_args()

    if args.all:
        files = sorted(f for f in glob.glob(os.path.join(args.dir, args.pattern))
                       if args.suffix == "" or args.suffix not in os.path.basename(f))
    elif args.day:
        files = [args.day]
    else:
        raise SystemExit("Give --day FILE or --all")
    if not files:
        raise SystemExit("No files matching %s" % args.pattern)

    tot_before = tot_after = 0
    for path in files:
        base, ext = os.path.splitext(path)
        out = base + args.suffix + ext if args.suffix else path
        r = process(path, out, args)
        if not r:
            print("%s: no track, skipped" % os.path.basename(path))
            continue
        kept = r["mid"] + r["end"]
        tot_before += r["beds"]
        tot_after += kept
        print("%-46s %3d -> %2d beds  (start -%d, mid %d, finish %d)  +%d other"
              % (os.path.basename(out), r["beds"], kept,
                 r["start"], r["mid"], r["end"], r["others"]))

    print()
    print("Albergues %d -> %d across %d file(s)." % (tot_before, tot_after, len(files)))
    print("Photo spots, churches, restaurants and summits were left alone.")


if __name__ == "__main__":
    main()
