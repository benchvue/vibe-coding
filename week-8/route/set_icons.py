#!/usr/bin/env python3
"""
set_icons.py -- give every waypoint a Garmin icon, and optionally build TCX courses.

Two different things, often confused:

  <wpt><sym>   a WAYPOINT icon. Works in GPX, shows on the map as a bed, a fork,
               a camera. This is what you want for albergues and photo spots.

  CoursePoint  an alert attached to a COURSE, shown as you ride past it on an
               Edge. It does not exist in GPX -- it needs TCX or FIT. The type
               list is short and fixed (Food, Water, Summit, Danger, Generic...),
               so a bed icon is simply not available there.

So: the GPX keeps rich icons, the optional TCX adds ride-time alerts.

Naming: the waypoint name stays English (device screens and older Garmins
handle it reliably), the Korean goes in <desc> and <cmt>, which the device
shows when you open the point.

Usage
    python set_icons.py --all                       # rewrite icons in place-ish
    python set_icons.py --all --suffix=-icons
    python set_icons.py --all --tcx                 # also write dayNN.tcx
    python set_icons.py --day camino-day10-bike-alb-photo.gpx --tcx
"""

import argparse
import datetime as dt
import glob
import math
import os
import re
import sys
import xml.etree.ElementTree as ET

GPX_NS = "http://www.topografix.com/GPX/1/1"
TCX_NS = "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"

# Garmin waypoint symbols. These names are the ones Garmin devices and BaseCamp
# recognise; an unknown name falls back to a plain dot on the device.
SYM_LODGING = "Lodging"        # bed
SYM_FOOD = "Restaurant"        # knife and fork
SYM_PHOTO = "Scenic Area"      # camera / viewpoint
SYM_CHURCH = "Church"
SYM_SUMMIT = "Summit"

FOOD_WORDS = re.compile(
    r"pulper|restaurant|restaurante|meson|mesón|bar\b|taberna|cafe|café|"
    r"asador|marisquer|panader", re.I)
CHURCH_WORDS = re.compile(
    r"iglesia|igrexa|catedral|concatedral|colegiata|basilica|basílica|"
    r"monasterio|convento|ermita|capela|capilla|santuario", re.I)
SUMMIT_WORDS = re.compile(r"alto|col |cruz de ferro|puerto|mirador|monte", re.I)
LODGING_WORDS = re.compile(
    r"albergue|refugio|hostal|pension|pensión|hotel|casa rural|camping|"
    r"apartament|hosped|posada|xunta", re.I)

# TCX only accepts these; anything else is rejected by the device.
TCX_TYPES = {"Generic", "Summit", "Valley", "Water", "Food", "Danger",
             "Left", "Right", "Straight", "First Aid"}


def haversine_m(a, b):
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    h = (math.sin((lat2 - lat1) / 2) ** 2
         + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2)
    return 2 * 6371008.8 * math.asin(math.sqrt(h))


def classify(name, desc, sym, typ):
    """-> (garmin sym, tcx course point type)"""
    blob = " ".join((name or "", sym or "", typ or ""))
    is_photo = "blue" in (sym or "").lower() or "photo" in (typ or "").lower()
    is_alb = "flag, red" in (sym or "").lower() or "pin, red" in (sym or "").lower()

    if FOOD_WORDS.search(name or ""):
        return SYM_FOOD, "Food"
    if is_photo:
        if SUMMIT_WORDS.search(name or ""):
            return SYM_SUMMIT, "Summit"
        if CHURCH_WORDS.search(name or ""):
            return SYM_CHURCH, "Generic"
        return SYM_PHOTO, "Generic"
    if is_alb or LODGING_WORDS.search(name or ""):
        return SYM_LODGING, "Generic"
    if CHURCH_WORDS.search(blob):
        return SYM_CHURCH, "Generic"
    return SYM_PHOTO, "Generic"


def korean_of(desc):
    """The Korean half of 'Day 10 | 철십자가' style descriptions."""
    if not desc:
        return ""
    return desc.split("|", 1)[1].strip() if "|" in desc else desc.strip()


def process_gpx(path, out_path):
    ET.register_namespace("", GPX_NS)
    tree = ET.parse(path)
    root = tree.getroot()
    ns = root.tag[: root.tag.index("}") + 1] if root.tag.startswith("{") else ""

    counts = {}
    points = []
    for w in root.iter(ns + "wpt"):
        def txt(tag):
            e = w.find(ns + tag)
            return (e.text or "").strip() if e is not None and e.text else ""

        name, desc, sym, typ = txt("name"), txt("desc"), txt("sym"), txt("type")
        new_sym, cp_type = classify(name, desc, sym, typ)
        ko = korean_of(desc)

        # <sym> drives the icon
        e = w.find(ns + "sym")
        if e is None:
            e = ET.SubElement(w, ns + "sym")
        e.text = new_sym

        # <cmt> is what many Garmins show first; keep Korean there and in desc
        if ko:
            c = w.find(ns + "cmt")
            if c is None:
                c = ET.SubElement(w, ns + "cmt")
            c.text = ko
            d = w.find(ns + "desc")
            if d is None:
                d = ET.SubElement(w, ns + "desc")
            d.text = ko if "|" not in desc else desc

        counts[new_sym] = counts.get(new_sym, 0) + 1
        ele = w.find(ns + "ele")
        points.append({
            "name": name, "ko": ko, "type": cp_type, "sym": new_sym,
            "lat": float(w.get("lat")), "lon": float(w.get("lon")),
            "ele": float(ele.text) if ele is not None and ele.text else None,
        })

    ET.indent(root, space="  ")
    tree.write(out_path, encoding="utf-8", xml_declaration=True)

    track = [(float(p.get("lat")), float(p.get("lon")),
              (lambda e: float(e.text) if e is not None and e.text else 0.0)(
                  p.find(ns + "ele")))
             for p in root.iter(ns + "trkpt")]
    return counts, points, track


def write_tcx(path, name, track, points, max_points, speed_kmh=15.0, lang="en"):
    """A Garmin course: the track plus course-point alerts."""
    ET.register_namespace("", TCX_NS)
    N = "{%s}" % TCX_NS
    root = ET.Element(N + "TrainingCenterDatabase")
    courses = ET.SubElement(root, N + "Courses")
    course = ET.SubElement(courses, N + "Course")
    ET.SubElement(course, N + "Name").text = name[:15]

    # cumulative distance and a synthetic clock, both required by the format
    cum, times = [0.0], []
    for i in range(1, len(track)):
        cum.append(cum[-1] + haversine_m(track[i - 1], track[i]))
    start = dt.datetime(2027, 5, 9, 7, 0, 0)
    for d in cum:
        times.append(start + dt.timedelta(hours=d / 1000.0 / speed_kmh))

    lap = ET.SubElement(course, N + "Lap")
    ET.SubElement(lap, N + "TotalTimeSeconds").text = "%.0f" % (
        cum[-1] / 1000.0 / speed_kmh * 3600)
    ET.SubElement(lap, N + "DistanceMeters").text = "%.1f" % cum[-1]
    for tag, pt in (("BeginPosition", track[0]), ("EndPosition", track[-1])):
        pos = ET.SubElement(lap, N + tag)
        ET.SubElement(pos, N + "LatitudeDegrees").text = "%.7f" % pt[0]
        ET.SubElement(pos, N + "LongitudeDegrees").text = "%.7f" % pt[1]
    ET.SubElement(lap, N + "Intensity").text = "Active"

    trk = ET.SubElement(course, N + "Track")
    for i, (lat, lon, ele) in enumerate(track):
        tp = ET.SubElement(trk, N + "Trackpoint")
        ET.SubElement(tp, N + "Time").text = times[i].strftime("%Y-%m-%dT%H:%M:%SZ")
        pos = ET.SubElement(tp, N + "Position")
        ET.SubElement(pos, N + "LatitudeDegrees").text = "%.7f" % lat
        ET.SubElement(pos, N + "LongitudeDegrees").text = "%.7f" % lon
        ET.SubElement(tp, N + "AltitudeMeters").text = "%.1f" % ele
        ET.SubElement(tp, N + "DistanceMeters").text = "%.1f" % cum[i]

    # each course point must sit on the track, so snap it and reuse that time
    placed = []
    for p in points:
        best, bd = 0, float("inf")
        for i, t in enumerate(track):
            d = haversine_m((t[0], t[1]), (p["lat"], p["lon"]))
            if d < bd:
                best, bd = i, d
        placed.append((cum[best], best, p))
    placed.sort(key=lambda x: x[0])   # dicts are not orderable, sort on distance

    if len(placed) > max_points:
        # Truncating by distance would keep only the first hours of the day and
        # throw away the pass at km 60. Keep the landmarks first, then spread
        # the remaining slots evenly over the whole stage.
        key = lambda item: item[2].get("sym")
        landmarks = [x for x in placed if key(x) != SYM_LODGING]
        beds = [x for x in placed if key(x) == SYM_LODGING]

        if len(landmarks) >= max_points:
            step = len(landmarks) / float(max_points)
            chosen = [landmarks[int(i * step)] for i in range(max_points)]
        else:
            room = max_points - len(landmarks)
            if room and beds:
                step = len(beds) / float(room)
                chosen = landmarks + [beds[int(i * step)] for i in range(room)]
            else:
                chosen = landmarks
        placed = sorted(chosen, key=lambda x: x[0])

    for _, idx, p in placed:
        cp = ET.SubElement(course, N + "CoursePoint")
        # The Name is what the Edge shows in the alert banner, and it is capped
        # at 10 characters. Korean fits far more meaning into 10 characters
        # than English does -- but only if the unit's language is set to Korean,
        # otherwise the font has no Hangul and you get boxes.
        label = p["ko"] if (lang == "ko" and p["ko"]) else p["name"]
        ET.SubElement(cp, N + "Name").text = label[:10]
        ET.SubElement(cp, N + "Time").text = times[idx].strftime("%Y-%m-%dT%H:%M:%SZ")
        pos = ET.SubElement(cp, N + "Position")
        ET.SubElement(pos, N + "LatitudeDegrees").text = "%.7f" % track[idx][0]
        ET.SubElement(pos, N + "LongitudeDegrees").text = "%.7f" % track[idx][1]
        t = p["type"] if p["type"] in TCX_TYPES else "Generic"
        ET.SubElement(cp, N + "PointType").text = t
        note = "%s %s" % (p["name"], p["ko"]) if p["ko"] else p["name"]
        ET.SubElement(cp, N + "Notes").text = note[:60]

    ET.indent(root, space="  ")
    ET.ElementTree(root).write(path, encoding="utf-8", xml_declaration=True)
    kept_landmarks = sum(1 for _, _, p in placed if p.get("sym") != SYM_LODGING)
    return len(placed), kept_landmarks


def main():
    ap = argparse.ArgumentParser(description="Garmin icons and course points")
    ap.add_argument("--day", help="one GPX file")
    ap.add_argument("--all", action="store_true",
                    help="every file matching --pattern in --dir")
    ap.add_argument("--dir", default=".")
    ap.add_argument("--pattern", default="camino-day*.gpx",
                    help="glob for --all (default camino-day*.gpx; use "
                         "\"camino-2027-day*.gpx\" for the published files)")
    ap.add_argument("--suffix", default="-icons",
                    help="output suffix. Use --suffix= to overwrite in place")
    ap.add_argument("--tcx", action="store_true",
                    help="also write a TCX course with course points")
    ap.add_argument("--cp-lang", choices=["en", "ko"], default="en",
                    help="language of the TCX alert title. 'ko' only works if "
                         "the Edge menu language is Korean")
    ap.add_argument("--max-course-points", type=int, default=100,
                    help="Edge units get slow past ~100 (default 100)")
    args = ap.parse_args()

    if args.all:
        files = sorted(f for f in glob.glob(
            os.path.join(args.dir, args.pattern))
            if args.suffix == "" or args.suffix not in os.path.basename(f))
    elif args.day:
        files = [args.day]
    else:
        raise SystemExit("Give --day FILE or --all")
    if not files:
        raise SystemExit("No GPX found in %s" % args.dir)

    grand = {}
    for path in files:
        base, ext = os.path.splitext(path)
        out = base + args.suffix + ext if args.suffix else path
        counts, points, track = process_gpx(path, out)
        for k, v in counts.items():
            grand[k] = grand.get(k, 0) + v

        line = "%s: " % os.path.basename(out)
        line += ", ".join("%s %d" % (k, v) for k, v in sorted(counts.items()))
        if args.tcx and track:
            tcx = base + ".tcx"
            n = write_tcx(tcx, os.path.basename(base), track, points,
                          args.max_course_points, lang=args.cp_lang)
            line += "  -> %s (%d course points%s)" % (
                os.path.basename(tcx), n[0],
                ", %d landmarks kept" % n[1] if n[1] else "")
        print(line)

    print()
    print("Totals: " + ", ".join("%s %d" % (k, v) for k, v in sorted(grand.items())))
    print("Waypoint names stay English; Korean goes in <cmt> and <desc>.")


if __name__ == "__main__":
    main()
