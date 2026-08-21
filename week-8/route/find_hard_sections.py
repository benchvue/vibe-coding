#!/usr/bin/env python3
"""
find_hard_sections.py -- flag the parts of a walking track a loaded bike will hate.

Two independent detectors, because neither alone is enough:

  gradient   Rolling grade over a ~150 m window. Steep is not automatically
             dangerous, but every notorious Camino descent shows up here.

  divergence Distance from the same day's road-routed track (BRouter). Where
             the walking line pulls away from the road network, it is on a
             footpath -- that is where the loose rock, steps and drop-offs are.
             This is the stronger signal of the two.

GPX carries no surface data, so neither detector can see "gravel" or "steps"
directly. Treat the output as a list of places to look at, not a verdict.

Usage
    python find_hard_sections.py --day camino-day10.gpx --road _replaced/camino-day10.gpx
    python find_hard_sections.py --all --road-dir _replaced
    python find_hard_sections.py --all --road-dir _replaced --csv hard.csv

Each flagged section prints as a cycle.travel From/To coordinate pair, already
padded so the detour rejoins the route cleanly.
"""

import argparse
import csv
import glob
import math
import os
import sys
import xml.etree.ElementTree as ET


def haversine_km(a, b):
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 2 * 6371.0088 * math.asin(math.sqrt(h))


def read_track(path):
    root = ET.parse(path).getroot()
    ns = root.tag[: root.tag.index("}") + 1] if root.tag.startswith("{") else ""
    pts = []
    for p in root.iter(ns + "trkpt"):
        ele = p.find(ns + "ele")
        pts.append((float(p.get("lat")), float(p.get("lon")),
                    float(ele.text) if ele is not None and ele.text else None))
    if not pts:
        raise SystemExit("No track points in %s" % path)
    cum = [0.0]
    for a, b in zip(pts, pts[1:]):
        cum.append(cum[-1] + haversine_km((a[0], a[1]), (b[0], b[1])))
    return pts, cum


def runs_from_flags(flags, cum, merge_km, min_km):
    """Contiguous True runs, merged across small gaps, then length filtered."""
    runs, start = [], None
    for i, f in enumerate(flags):
        if f and start is None:
            start = i
        elif not f and start is not None:
            runs.append((start, i - 1))
            start = None
    if start is not None:
        runs.append((start, len(flags) - 1))

    merged = []
    for r in runs:
        if merged and cum[r[0]] - cum[merged[-1][1]] <= merge_km:
            merged[-1] = (merged[-1][0], r[1])
        else:
            merged.append(r)
    return [r for r in merged if cum[r[1]] - cum[r[0]] >= min_km]


def grade_flags(pts, cum, window_km, limit_pct):
    """Rolling grade over window_km; flag points steeper than limit_pct."""
    n = len(pts)
    flags = [False] * n
    grades = [0.0] * n
    if not any(p[2] is not None for p in pts):
        return flags, grades, False

    j = 0
    for i in range(n):
        while j < n - 1 and cum[j] - cum[i] < window_km:
            j += 1
        if pts[i][2] is None or pts[j][2] is None:
            continue
        run = (cum[j] - cum[i]) * 1000.0
        if run < 30:
            continue
        g = (pts[j][2] - pts[i][2]) / run * 100.0
        grades[i] = g
        if abs(g) >= limit_pct:
            flags[i] = True
    return flags, grades, True


def divergence_flags(pts, road, limit_km):
    """Flag walking points further than limit_km from the road track."""
    cell = limit_km / 100.0 + 0.03
    flags, dists = [], []
    for p in pts:
        best = float("inf")
        for r in road:
            if abs(r[0] - p[0]) > cell or abs(r[1] - p[1]) > cell * 1.4:
                continue
            d = haversine_km((r[0], r[1]), (p[0], p[1]))
            if d < best:
                best = d
        if best == float("inf"):
            best = min(haversine_km((r[0], r[1]), (p[0], p[1])) for r in road)
        dists.append(best)
        flags.append(best > limit_km)
    return flags, dists


def pad(run, cum, buffer_km, n):
    """Widen a run so the detour leaves and rejoins away from the rough bit."""
    a, b = run
    while a > 0 and cum[run[0]] - cum[a] < buffer_km:
        a -= 1
    while b < n - 1 and cum[b] - cum[run[1]] < buffer_km:
        b += 1
    return a, b


def describe(pts, cum, run, grades, dists):
    a, b = run
    length = cum[b] - cum[a]
    seg_g = [grades[i] for i in range(a, b + 1)]
    up = sum(max(0.0, pts[i + 1][2] - pts[i][2])
             for i in range(a, b) if pts[i][2] is not None and pts[i + 1][2] is not None)
    down = sum(max(0.0, pts[i][2] - pts[i + 1][2])
               for i in range(a, b) if pts[i][2] is not None and pts[i + 1][2] is not None)
    out = {
        "km_from_start": cum[a],
        "length_km": length,
        "max_grade": max(seg_g, key=abs) if seg_g else 0.0,
        "ascent_m": up,
        "descent_m": down,
        "from": "%.5f,%.5f" % (pts[a][0], pts[a][1]),
        "to": "%.5f,%.5f" % (pts[b][0], pts[b][1]),
    }
    if dists:
        out["max_off_road_km"] = max(dists[a : b + 1])
    return out


def process(day_path, road_path, args, writer):
    pts, cum = read_track(day_path)
    tag = os.path.splitext(os.path.basename(day_path))[0]

    gflags, grades, have_ele = grade_flags(pts, cum, args.window / 1000.0, args.grade)
    dflags, dists = ([False] * len(pts), [])
    if road_path and os.path.exists(road_path):
        road, _ = read_track(road_path)
        dflags, dists = divergence_flags(pts, road, args.off_road)

    if args.require_both and dists:
        combined = [g and d for g, d in zip(gflags, dflags)]
    else:
        combined = [g or d for g, d in zip(gflags, dflags)]
    runs = runs_from_flags(combined, cum, args.merge / 1000.0, args.min_len / 1000.0)

    if args.top:
        def severity(r):
            seg = [abs(grades[i]) for i in range(r[0], r[1] + 1)]
            return (max(seg) if seg else 0) * (cum[r[1]] - cum[r[0]])
        runs = sorted(sorted(runs, key=severity, reverse=True)[: args.top])

    print("\n=== %s  (%.1f km, %d points%s) ===" %
          (tag, cum[-1], len(pts), "" if have_ele else ", NO elevation"))
    if not have_ele and not road_path:
        print("  Nothing to measure: no elevation and no road track given.")
        return
    if not runs:
        print("  No sections flagged.")
        return

    for k, run in enumerate(runs, 1):
        padded = pad(run, cum, args.buffer / 1000.0, len(pts))
        d = describe(pts, cum, padded, grades, dists)
        why = []
        if any(gflags[run[0] : run[1] + 1]):
            why.append("grade %.0f%%" % d["max_grade"])
        if dists and any(dflags[run[0] : run[1] + 1]):
            why.append("%.0f m off road" % (d["max_off_road_km"] * 1000))
        print("\n  [%d] at km %.1f, %.1f km long  (%s)"
              % (k, d["km_from_start"], d["length_km"], ", ".join(why)))
        print("      climb %.0f m / drop %.0f m" % (d["ascent_m"], d["descent_m"]))
        print("      cycle.travel  From: %s   To: %s" % (d["from"], d["to"]))
        if writer:
            writer.writerow([tag, k, "%.1f" % d["km_from_start"],
                             "%.2f" % d["length_km"], "%.0f" % d["max_grade"],
                             "%.0f" % d["ascent_m"], "%.0f" % d["descent_m"],
                             d["from"], d["to"], ", ".join(why)])


def main():
    ap = argparse.ArgumentParser(description="Find bike-unfriendly sections")
    ap.add_argument("--day", help="one day GPX (walking route, with elevation)")
    ap.add_argument("--all", action="store_true",
                    help="every camino-day*.gpx in --dir")
    ap.add_argument("--dir", default=".")
    ap.add_argument("--road", help="road-routed GPX for the same day")
    ap.add_argument("--road-dir",
                    help="folder holding same-named road versions, e.g. _replaced")
    ap.add_argument("--grade", type=float, default=12.0,
                    help="flag rolling grade at or above this %% (default 12)")
    ap.add_argument("--window", type=float, default=150.0,
                    help="metres over which grade is measured (default 150)")
    ap.add_argument("--off-road", type=float, default=0.25,
                    help="flag where the walking line is more than this many km "
                         "from the road track (default 0.25)")
    ap.add_argument("--merge", type=float, default=400.0,
                    help="join flagged bits closer than this many metres")
    ap.add_argument("--min-len", type=float, default=200.0,
                    help="drop flagged runs shorter than this many metres")
    ap.add_argument("--buffer", type=float, default=400.0,
                    help="pad each end by this many metres so the detour "
                         "rejoins cleanly (default 400)")
    ap.add_argument("--require-both", action="store_true",
                    help="only flag where the track is BOTH steep AND off the "
                         "road network. Use this: divergence alone fires on "
                         "ordinary farm tracks, which are fine to ride")
    ap.add_argument("--top", type=int,
                    help="keep only the N worst sections per day, ranked by "
                         "steepness x length")
    ap.add_argument("--csv", help="also write the sections to this CSV")
    args = ap.parse_args()

    if args.all:
        days = sorted(f for f in glob.glob(os.path.join(args.dir, "camino-day*.gpx"))
                      if "-poi" not in f and "-alb" not in f and "-beds" not in f)
    elif args.day:
        days = [args.day]
    else:
        raise SystemExit("Give --day FILE or --all")
    if not days:
        raise SystemExit("No day files found")

    fh = writer = None
    if args.csv:
        fh = open(args.csv, "w", newline="", encoding="utf-8")
        writer = csv.writer(fh)
        writer.writerow(["day", "n", "km_from_start", "length_km", "max_grade_pct",
                         "climb_m", "drop_m", "from", "to", "why"])

    try:
        for day in days:
            road = args.road
            if not road and args.road_dir:
                cand = os.path.join(args.road_dir, os.path.basename(day))
                road = cand if os.path.exists(cand) else None
            process(day, road, args, writer)
    finally:
        if fh:
            fh.close()
            print("\nWrote %s" % args.csv)

    print("\nPaste each From/To into cycle.travel, check the line it draws, "
          "then Save -> GPX.")


if __name__ == "__main__":
    main()
