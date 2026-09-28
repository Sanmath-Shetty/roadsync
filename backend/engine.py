"""Conflict engine: does a proposed trench hit any existing asset?

Why project? Lng/lat are degrees, and a degree is not a fixed number of metres.
So we convert to UTM (a flat, metre-based grid), do the geometry there,
then convert the crossing points back to lng/lat.
"""
from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform

# Mangalore (74.8 E) sits in UTM zone 43N = EPSG:32643.
# always_xy=True keeps the order as (lng, lat), matching GeoJSON.
_TO_UTM = Transformer.from_crs("EPSG:4326", "EPSG:32643", always_xy=True).transform
_TO_LNGLAT = Transformer.from_crs("EPSG:32643", "EPSG:4326", always_xy=True).transform


def check_conflicts(proposed_line, assets, buffer_m=2):
    """Find assets that the proposed trench touches.

    proposed_line: GeoJSON LineString dict, coordinates are [lng, lat]
    assets: list of GeoJSON Features (properties: id, type)
            or a FeatureCollection dict
    buffer_m: safety margin around the trench, in metres

    Returns: [{"asset_id": ..., "type": ..., "point": [lng, lat]}, ...]
    """
    features = assets["features"] if isinstance(assets, dict) else assets

    # 1. Project the trench to metres and give it a width (the buffer).
    line_m = transform(_TO_UTM, shape(proposed_line))
    zone = line_m.buffer(buffer_m)

    conflicts = []
    for f in features:
        asset_m = transform(_TO_UTM, shape(f["geometry"]))

        # 2. Intersect the buffered trench with the asset.
        hit = zone.intersection(asset_m)
        if hit.is_empty:
            continue

        # 3. Pick ONE point to show on the map. A crossing gives a short
        #    segment; its centre is the crossing. If there are several
        #    pieces, use the one closest to the start of the trench.
        parts = list(hit.geoms) if hasattr(hit, "geoms") else [hit]
        parts.sort(key=lambda p: line_m.project(p.centroid))
        centre = parts[0].centroid

        # 4. Back to lng/lat.
        lng, lat = _TO_LNGLAT(centre.x, centre.y)
        conflicts.append(
            {
                "asset_id": f["properties"]["id"],
                "type": f["properties"]["type"],
                "point": [round(lng, 6), round(lat, 6)],
            }
        )
    return conflicts


# ---------------------------------------------------------------------------
# Reroute suggestion
# ---------------------------------------------------------------------------
def _to_lnglat_geojson(line_m):
    """UTM LineString -> GeoJSON LineString in [lng, lat]."""
    line = transform(_TO_LNGLAT, line_m)
    return {
        "type": "LineString",
        "coordinates": [[round(x, 6), round(y, 6)] for x, y in line.coords],
    }


def suggest_route(proposed_line, assets, buffer_m=2, step_m=5, max_offset_m=100):
    """Try parallel copies of the trench, shifted sideways a bit more each time.

    Checks 5 m left, 5 m right, 10 m left, 10 m right, ... up to max_offset_m.
    Returns the FIRST (smallest) shift with zero conflicts, or None.
    Result: {"geometry": GeoJSON LineString, "offset_m": int}
    """
    line_m = transform(_TO_UTM, shape(proposed_line))

    for dist in range(step_m, max_offset_m + 1, step_m):
        for side in (1, -1):  # 1 = left of travel direction, -1 = right
            candidate_m = line_m.offset_curve(side * dist)
            candidate = _to_lnglat_geojson(candidate_m)
            if not check_conflicts(candidate, assets, buffer_m):
                return {"geometry": candidate, "offset_m": dist}
    return None


# ---------------------------------------------------------------------------
# Coordination with other organizations' planned work
# ---------------------------------------------------------------------------
from datetime import date, timedelta


def find_coordination(proposed_line, start, end, org, work_orders, near_m=15, gap_days=7):
    """Find other orgs digging near the same place around the same time.

    A match needs BOTH:
      - their trench is within near_m metres of ours
      - their dates overlap ours, or are at most gap_days apart
    suggested_window = their window: dig once while the road is already open.
    """
    line_m = transform(_TO_UTM, shape(proposed_line))
    my_start, my_end = date.fromisoformat(start), date.fromisoformat(end)

    matches = []
    for wo in work_orders:
        if wo["org"] == org:
            continue  # don't coordinate with yourself

        # Space: how close are the two trenches (metres)?
        other_m = transform(_TO_UTM, shape(wo["geometry"]))
        if line_m.distance(other_m) > near_m:
            continue

        # Time: overlap, or a small gap either side.
        o_start, o_end = date.fromisoformat(wo["start"]), date.fromisoformat(wo["end"])
        gap = timedelta(days=gap_days)
        if my_start > o_end + gap or my_end < o_start - gap:
            continue

        matches.append(
            {
                "order_id": wo["id"],
                "org": wo["org"],
                "start": wo["start"],
                "end": wo["end"],
                "suggested_window": {"start": wo["start"], "end": wo["end"]},
            }
        )
    return matches
