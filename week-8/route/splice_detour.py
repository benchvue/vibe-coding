#!/usr/bin/env python3
"""
splice_detour.py -- graft a road detour into a day's walking route.

You draw the detour on cycle.travel and save it as GPX. This finds where that
detour meets the day's track, cuts out the bit in between, and stitches the
detour in its place. The rest of the day is untouched.

    original:  A ----- [rough descent] ----- B ----- end
    detour:         A ==== (road) ==== B
    result:    A ==== (road) ==== B ----- end

Several detours can go into one day; they are applied in route order and
checked for overlap.

Usage
    python splice_detour.py --day camino-day01.gpx \
        --detour day01-valcarlos.gpx -o camino-day01-bike.gpx

    python splice_detour.py --day camino-day11.gpx \
        --detour day11-cebreiro.gpx --detour day11-triacastela.gpx \
        -o camino-day11-bike.gpx

Check the junction distances it prints. Anything over ~300 m means the detour
does not actually start on the route, and the result will have a gap.
"""

import argparse
import math
import os
import xml.etree.ElementTree as ET

GPX_NS = "http://www.topografix.com/GPX/1/1"


def haversine_km(a, b):
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 2 * 6371.0088 * math.asin(math.sqrt(h))


def read_points(path):
    root = ET.parse(path).getroot()
    ns = root.tag[: root.tag.index("}") + 1] if root.tag.startswith("{") else ""
    pts = []
    for tag in ("trkpt", "rtept"):
        for p in root.iter(ns + tag):
            ele = p.find(ns + "ele")
            pts.append((float(p.get("lat")), float(p.get("lon")),
                        float(ele.text) if ele is not None and ele.text else None))
        if pts:
            break
    if not pts:
        raise SystemExit("No points in %s" % path)
    return pts, root, ns


def read_waypoints(root, ns):
    out = []
    for w in root.iter(ns + "wpt"):
        fields = {}
        for tag in ("name", "desc", "sym", "type"):
            e = w.find(ns + tag)
            if e is not None and e.text:
                fields[tag] = e.text
        out.append((float(w.get("lat")), float(w.get("lon")), fields))
    return out


def nearest(track, pt):
    best_i, best_d = 0, float("inf")
    for i, t in enumerate(track):
        d = haversine_km((t[0], t[1]), (pt[0], pt[1]))
        if d < best_d:
            best_i, best_d = i, d
    return best_i, best_d


def length_km(pts):
    return sum(haversine_km((pts[i][0], pts[i][1]), (pts[i + 1][0], pts[i + 1][1]))
               for i in range(len(pts) - 1))


def ascent_m(pts):
    total, prev = 0.0, None
    for p in pts:
        if p[2] is None:
            continue
        if prev is not None and p[2] > prev:
            total += p[2] - prev
        prev = p[2]
    return total


def plan_detour(day, det, label):
    """Where does this detour join the day route, and which way round is it?"""
    i_start, d_start = nearest(day, det[0])
    i_end, d_end = nearest(day, det[-1])

    reversed_ = False
    if i_start > i_end:
        det = det[::-1]
        i_start, d_start = nearest(day, det[0])
        i_end, d_end = nearest(day, det[-1])
        reversed_ = True

    if i_end <= i_start:
        raise SystemExit(
            "%s: both ends of the detour land on the same place of the route. "
            "Is it really a detour for this day?" % label)
    return {"pts": det, "i": i_start, "j": i_end,
            "d_in": d_start, "d_out": d_end, "reversed": reversed_,
            "label": label}


def write_gpx(path, name, pts, wpts):
    ET.register_namespace("", GPX_NS)
    N = "{%s}" % GPX_NS
    gpx = ET.Element(N + "gpx", {"version": "1.1", "creator": "splice_detour.py"})
    meta = ET.SubElement(gpx, N + "metadata")
    ET.SubElement(meta, N + "name").text = name

    for lat, lon, fields in wpts:
        w = ET.SubElement(gpx, N + "wpt",
                          {"lat": "%.7f" % lat, "lon": "%.7f" % lon})
        for tag in ("name", "desc", "sym", "type"):
            if tag in fields:
                ET.SubElement(w, N + tag).text = fields[tag]

    trk = ET.SubElement(gpx, N + "trk")
    ET.SubElement(trk, N + "name").text = name
    seg = ET.SubElement(trk, N + "trkseg")
    for lat, lon, ele in pts:
        p = ET.SubElement(seg, N + "trkpt",
                          {"lat": "%.7f" % lat, "lon": "%.7f" % lon})
        if ele is not None:
            ET.SubElement(p, N + "ele").text = "%.1f" % ele

    ET.indent(gpx, space="  ")
    ET.ElementTree(gpx).write(path, encoding="utf-8", xml_declaration=True)


def main():
    ap = argparse.ArgumentParser(description="Splice detours into a day route")
    ap.add_argument("--day", required=True, help="the day's GPX")
    ap.add_argument("--detour", action="append", required=True,
                    help="a detour GPX from cycle.travel (repeat for several)")
    ap.add_argument("-o", "--out", help="output file (default: <day>-bike.gpx)")
    ap.add_argument("--warn-gap", type=float, default=0.3,
                    help="warn if a detour end is further than this many km "
                         "from the route (default 0.3)")
    ap.add_argument("--max-overlap", type=float, default=2.0,
                    help="how much two detours may overlap before it is "
                         "treated as an error, in km (default 2). Detours "
                         "that merely touch end-to-end are always fine")
    ap.add_argument("--drop-waypoints", action="store_true",
                    help="do not carry the day's waypoints into the result")
    args = ap.parse_args()

    day, day_root, day_ns = read_points(args.day)
    wpts = [] if args.drop_waypoints else read_waypoints(day_root, day_ns)

    plans = []
    for path in args.detour:
        det, _, _ = read_points(path)
        plans.append(plan_detour(day, det, os.path.basename(path)))
    plans.sort(key=lambda p: p["i"])

    # Two detours that meet end-to-end (one finishes where the next starts)
    # are fine -- that is a normal way to cover two problems in a day. Only a
    # real overlap, where the second eats into ground the first already
    # replaced, is a problem.
    for a, b in zip(plans, plans[1:]):
        if b["i"] <= a["j"]:
            overlap = length_km(day[b["i"] : a["j"] + 1])
            if overlap > args.max_overlap:
                raise SystemExit(
                    "%s and %s overlap by %.1f km on the route. Splice them "
                    "one at a time, or redraw so they do not cross."
                    % (a["label"], b["label"], overlap))
            if overlap > 0.05:
                print("Note: %s and %s overlap by %.0f m; trimming the join."
                      % (a["label"], b["label"], overlap * 1000))
            b["i"] = a["j"] + 1
            if b["i"] > b["j"]:
                raise SystemExit(
                    "%s is entirely inside %s. Use only one of them."
                    % (b["label"], a["label"]))

    out_pts, cursor = [], 0
    print("Original: %.1f km, ascent %.0f m, %d points"
          % (length_km(day), ascent_m(day), len(day)))
    for p in plans:
        replaced = day[p["i"] : p["j"] + 1]
        out_pts.extend(day[cursor : p["i"]])
        out_pts.extend(p["pts"])
        cursor = p["j"] + 1
        flag_in = "  <-- CHECK" if p["d_in"] > args.warn_gap else ""
        flag_out = "  <-- CHECK" if p["d_out"] > args.warn_gap else ""
        print("\n%s%s" % (p["label"], "  (reversed to match route direction)"
                          if p["reversed"] else ""))
        print("  joins route at km %.1f, rejoins at km %.1f"
              % (length_km(day[: p["i"] + 1]), length_km(day[: p["j"] + 1])))
        print("  replaces %.1f km (ascent %.0f m) with %.1f km (ascent %.0f m)"
              % (length_km(replaced), ascent_m(replaced),
                 length_km(p["pts"]), ascent_m(p["pts"])))
        print("  junction gaps: in %.0f m%s, out %.0f m%s"
              % (p["d_in"] * 1000, flag_in, p["d_out"] * 1000, flag_out))
        if p["pts"][0][2] is None:
            print("  note: this detour has no elevation data")
    out_pts.extend(day[cursor:])

    out = args.out or (os.path.splitext(args.day)[0] + "-bike.gpx")
    name = os.path.splitext(os.path.basename(out))[0]
    write_gpx(out, name, out_pts, wpts)

    print("\nResult:   %.1f km, ascent %.0f m, %d points"
          % (length_km(out_pts), ascent_m(out_pts), len(out_pts)))
    print("Wrote %s" % out)
    if wpts:
        print("Carried over %d waypoints -- some may sit on the skipped "
              "section, so re-run add_waypoints.py if you want them exact."
              % len(wpts))


if __name__ == "__main__":
    main()
