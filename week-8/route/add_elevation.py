#!/usr/bin/env python3
"""
add_elevation.py -- fill in <ele> for a GPX that has none.

Looks each track point up against a free elevation service and writes a new
GPX with elevation. No API key.

Providers
    open-meteo     (default) Copernicus DEM, 100 points per request
    opentopodata   more datasets, e.g. eudem25m which is finer over Europe
                   but is rate limited to roughly 1 request/second, 1000/day

Why smoothing matters
    A DEM sampled at every track point is noisy: a flat road can wobble by a
    metre or two between samples, and summing those wobbles over 15,000 points
    invents thousands of metres of climbing. This script smooths the profile
    and ignores rises below --threshold before totalling ascent. It reports
    the raw figure too so you can see the difference.

Usage
    python add_elevation.py camino-frances.gpx -o camino-frances-ele.gpx
    python add_elevation.py in.gpx --provider opentopodata --dataset eudem25m -o out.gpx

Then re-split into days:
    python split_camino_gpx.py --track camino-frances-ele.gpx --all
"""

import argparse
import json
import math
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

USER_AGENT = "add_elevation/1.0 (personal route planning)"


class RateLimited(Exception):
    """The service told us to slow down (HTTP 429)."""
CACHE_PRECISION = 5  # ~1 m; keeps the cache useful across re-runs


def haversine_km(a, b):
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 2 * 6371.0088 * math.asin(math.sqrt(h))


# --------------------------------------------------------------------------
def fetch_open_meteo(batch):
    lats = ",".join("%.6f" % p[0] for p in batch)
    lons = ",".join("%.6f" % p[1] for p in batch)
    url = ("https://api.open-meteo.com/v1/elevation?latitude=%s&longitude=%s"
           % (lats, lons))
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        if e.code == 429:
            raise RateLimited("open-meteo rate limit")
        raise
    vals = data.get("elevation")
    if not vals or len(vals) != len(batch):
        raise RuntimeError("open-meteo returned %d values for %d points"
                           % (len(vals or []), len(batch)))
    return [float(v) for v in vals]


def fetch_opentopodata(batch, dataset="eudem25m"):
    locs = "|".join("%.6f,%.6f" % (p[0], p[1]) for p in batch)
    url = "https://api.opentopodata.org/v1/%s?locations=%s" % (dataset, locs)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        if e.code == 429:
            raise RateLimited("opentopodata rate limit")
        raise
    if data.get("status") != "OK":
        raise RuntimeError("opentopodata: %s" % data.get("error", data.get("status")))
    out = []
    for res in data["results"]:
        e = res.get("elevation")
        out.append(float(e) if e is not None else None)
    return out


def save_cache(cache, path):
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(cache, f)
    except Exception as e:
        sys.stderr.write("Could not write cache: %s\n" % e)


def lookup_all(points, provider, dataset, batch_size, pause, cache, cache_path):
    """points -> elevations, using cache and batching.

    A 429 is not a failure to retry quickly: it means we are going too fast.
    We wait a full minute and permanently slow down before continuing.
    """
    uniq = {}
    for p in points:
        key = "%.*f,%.*f" % (CACHE_PRECISION, p[0], CACHE_PRECISION, p[1])
        if key not in cache:
            uniq.setdefault(key, p)
    todo = list(uniq.items())

    total = len(todo)
    if not total:
        return [cache.get("%.*f,%.*f" % (CACHE_PRECISION, p[0], CACHE_PRECISION, p[1]))
                for p in points]

    est = math.ceil(total / float(batch_size))
    sys.stderr.write("Looking up %d new points in %d requests "
                     "(about %.0f s if nothing throttles)\n"
                     % (total, est, est * (pause + 0.4)))

    done = 0
    for i in range(0, total, batch_size):
        chunk = todo[i : i + batch_size]
        pts = [p for _, p in chunk]
        vals = None
        for attempt in range(6):
            try:
                vals = (fetch_open_meteo(pts) if provider == "open-meteo"
                        else fetch_opentopodata(pts, dataset))
                break
            except RateLimited:
                pause = min(pause * 1.5 + 0.5, 20.0)
                wait = 60 * (attempt + 1)
                sys.stderr.write("\n  rate limited -- waiting %ds, then %.1fs "
                                 "between requests\n" % (wait, pause))
                save_cache(cache, cache_path)
                time.sleep(wait)
            except (urllib.error.URLError, RuntimeError, ValueError) as e:
                wait = 2 ** attempt
                sys.stderr.write("\n  request failed (%s), retry in %ds\n" % (e, wait))
                time.sleep(wait)
        if vals is None:
            save_cache(cache, cache_path)
            raise SystemExit(
                "\nGave up after repeated failures. %d points are cached, so "
                "re-running resumes where it stopped.\nTry: --provider "
                "opentopodata --pause 1.2   or   --every 4 to need fewer points."
                % len(cache))

        for (key, _), v in zip(chunk, vals):
            cache[key] = v
        done += len(chunk)
        if (i // batch_size) % 10 == 0:
            save_cache(cache, cache_path)
        sys.stderr.write("\r  %d / %d points" % (done, total))
        sys.stderr.flush()
        time.sleep(pause)
    sys.stderr.write("\n")
    save_cache(cache, cache_path)

    return [cache.get("%.*f,%.*f" % (CACHE_PRECISION, p[0], CACHE_PRECISION, p[1]))
            for p in points]


def interpolate(values):
    """Fill None gaps between known values by linear interpolation on index."""
    n = len(values)
    known = [i for i, v in enumerate(values) if v is not None]
    if not known:
        return values
    out = list(values)
    for i in range(n):
        if out[i] is not None:
            continue
        lo = max((k for k in known if k < i), default=None)
        hi = min((k for k in known if k > i), default=None)
        if lo is None:
            out[i] = values[hi]
        elif hi is None:
            out[i] = values[lo]
        else:
            f = (i - lo) / float(hi - lo)
            out[i] = values[lo] + (values[hi] - values[lo]) * f
    return out


# --------------------------------------------------------------------------
def smooth(values, window):
    """Moving average over a window, ignoring None."""
    if window < 2:
        return list(values)
    n = len(values)
    out = []
    half = window // 2
    for i in range(n):
        lo, hi = max(0, i - half), min(n, i + half + 1)
        vals = [v for v in values[lo:hi] if v is not None]
        out.append(sum(vals) / len(vals) if vals else None)
    return out


def ascent_of(values, threshold=0.0):
    """Total climb, ignoring rises smaller than threshold metres."""
    total, base = 0.0, None
    for v in values:
        if v is None:
            continue
        if base is None:
            base = v
            continue
        if v > base + threshold:
            total += v - base
            base = v
        elif v < base:
            base = v
    return total


# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Add elevation to a GPX")
    ap.add_argument("gpx", help="input GPX")
    ap.add_argument("-o", "--out", required=True, help="output GPX")
    ap.add_argument("--provider", choices=["open-meteo", "opentopodata"],
                    default="open-meteo")
    ap.add_argument("--dataset", default="eudem25m",
                    help="opentopodata dataset (eudem25m, srtm90m, mapzen ...)")
    ap.add_argument("--batch", type=int, default=100, help="points per request")
    ap.add_argument("--pause", type=float, default=1.1,
                    help="seconds between requests (be polite; opentopodata "
                         "needs at least 1.0)")
    ap.add_argument("--smooth", type=int, default=5,
                    help="moving-average window, 0 to disable (default 5)")
    ap.add_argument("--threshold", type=float, default=2.0,
                    help="ignore climbs below this many metres (default 2)")
    ap.add_argument("--only-missing", action="store_true",
                    help="keep elevation that is already in the file and only "
                         "look up the points that lack it. Use this after "
                         "splicing in a cycle.travel detour")
    ap.add_argument("--every", type=int, default=1, metavar="N",
                    help="only look up every Nth point and interpolate the "
                         "rest. Points here are ~50 m apart, so --every 4 "
                         "(200 m) barely changes the profile and cuts the "
                         "requests to a quarter")
    ap.add_argument("--cache", default="elevation-cache.json",
                    help="reuse lookups across runs")
    args = ap.parse_args()

    tree = ET.parse(args.gpx)
    root = tree.getroot()
    ns = root.tag[: root.tag.index("}") + 1] if root.tag.startswith("{") else ""

    nodes = list(root.iter(ns + "trkpt")) or list(root.iter(ns + "rtept"))
    if not nodes:
        raise SystemExit("No track points in %s" % args.gpx)
    pts = [(float(n.get("lat")), float(n.get("lon"))) for n in nodes]

    existing = []
    for n in nodes:
        e = n.find(ns + "ele")
        existing.append(float(e.text) if e is not None and e.text else None)
    have = sum(1 for e in existing if e is not None)
    print("%d points in %s (%d already have elevation)"
          % (len(pts), args.gpx, have))

    gap_idx = [i for i, e in enumerate(existing) if e is None]
    if args.only_missing:
        if not gap_idx:
            raise SystemExit("Every point already has elevation. Nothing to do.")
        print("Filling %d missing points only" % len(gap_idx))
        pts_wanted = [pts[i] for i in gap_idx]
    else:
        pts_wanted = pts

    cache = {}
    if os.path.exists(args.cache):
        try:
            with open(args.cache, encoding="utf-8") as f:
                cache = json.load(f)
            print("Cache: %d points already known" % len(cache))
        except Exception:
            cache = {}

    if args.every > 1:
        idx = list(range(0, len(pts_wanted), args.every))
        if idx[-1] != len(pts_wanted) - 1:
            idx.append(len(pts_wanted) - 1)
        print("Sampling every %d points: %d lookups instead of %d"
              % (args.every, len(idx), len(pts_wanted)))
        sampled = lookup_all([pts_wanted[i] for i in idx], args.provider,
                             args.dataset, args.batch, args.pause, cache,
                             args.cache)
        got = [None] * len(pts_wanted)
        for i, v in zip(idx, sampled):
            got[i] = v
        got = interpolate(got)
    else:
        got = lookup_all(pts_wanted, args.provider, args.dataset,
                         args.batch, args.pause, cache, args.cache)
        got = interpolate(got)

    if args.only_missing:
        eles = list(existing)
        for i, v in zip(gap_idx, got):
            eles[i] = v
    else:
        eles = got

    missing = sum(1 for e in eles if e is None)
    if missing:
        print("Warning: %d points got no elevation" % missing)

    raw_ascent = ascent_of(eles)
    smoothed = smooth(eles, args.smooth)
    final_ascent = ascent_of(smoothed, args.threshold)

    for node, e in zip(nodes, smoothed):
        for old in node.findall(ns + "ele"):
            node.remove(old)
        if e is not None:
            ET.SubElement(node, ns.join(["", "ele"]) if ns else "ele").text = "%.1f" % e

    dist = sum(haversine_km(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
    vals = [e for e in smoothed if e is not None]
    print("\nDistance   %.1f km" % dist)
    if vals:
        print("Elevation  %.0f m to %.0f m" % (min(vals), max(vals)))
    print("Ascent     %.0f m  (raw unsmoothed would be %.0f m)"
          % (final_ascent, raw_ascent))

    if ns:
        ET.register_namespace("", ns.strip("{}"))
    tree.write(args.out, encoding="utf-8", xml_declaration=True)
    print("\nWrote %s" % args.out)


if __name__ == "__main__":
    main()
