"""
process_ba_soils.py
Convierte el shapefile de suelos de Buenos Aires (1:50.000) a tiles GeoJSON
compatibles con el formato IDECOR usado por la app Evalua tu Campo.

Salida: data/sheets-ba/<lat>_<lon>.json  (tiles 1x1 grado)
        data/sheets-ba-index.json         (indice de tiles)

Columnas BA -> IDECOR:
  SIMBC     -> TEXTUSERID
  CAP_USO   -> CU  (parsea romano I=1..VIII=8)
  Nombre_UC -> COMPOSIC
  TIPO      -> TIPO_UNID
  SERIE1-6  -> SERIE_1..SERIE_6
  PORC1-6   -> PORC_1..PORC_6
  IP        -> null (no disponible en BA)
"""

import geopandas as gpd
import json
import os
import re
import math

SHP = r"C:\Users\daperez\Desktop\Evalua tu campo\1_Mapa_de_Suelos_BA_50000_V1\Suelos_BA_50mil_V1.shp"
OUT_DIR = r"C:\Users\daperez\Desktop\Evalua tu campo\data\sheets-ba"
INDEX_PATH = r"C:\Users\daperez\Desktop\Evalua tu campo\data\sheets-ba-index.json"
# Tolerancia muy baja para conservar curvas organicas del 1:50000
# 0.0005 deg ~ 55m: preserva inflexiones naturales de limites de suelo
SIMPLIFY_TOL = 0.0005
# Precision de coordenadas: 4 decimales = ~11m
COORD_PRECISION = 4


def parse_cu(cap_uso):
    """Parsea CAP_USO (ej: 'III-2w', 'IV', 'II-2') -> entero 1-8 o None."""
    if not cap_uso or str(cap_uso).strip() in ('', 'nan', 'None'):
        return None
    s = str(cap_uso).strip().upper()
    # Take first token if multiple (e.g. "II-2, III-2")
    s = re.split(r'[,;/]', s)[0].strip()
    # Extract roman numeral prefix
    roman_map = {'VIII': 8, 'VII': 7, 'VI': 6, 'IV': 4,
                 'III': 3, 'II': 2, 'I': 1, 'V': 5}
    for rom, val in sorted(roman_map.items(), key=lambda x: -len(x[0])):
        if s.startswith(rom):
            return val
    return None


def tile_key(lat_floor, lon_floor):
    return f"{lat_floor:+04d}_{lon_floor:+04d}".replace('+', 'p').replace('-', 'n')


print("Leyendo shapefile BA...")
gdf = gpd.read_file(SHP)
print(f"  {len(gdf)} features, CRS: {gdf.crs}")

# Ensure WGS84
if gdf.crs and gdf.crs.to_epsg() != 4326:
    print("  Reproyectando a WGS84...")
    gdf = gdf.to_crs(epsg=4326)

# Simplify geometry (omitir si SIMPLIFY_TOL=0)
if SIMPLIFY_TOL > 0:
    print(f"  Simplificando geometria (tolerancia={SIMPLIFY_TOL} deg)...")
    gdf['geometry'] = gdf['geometry'].simplify(SIMPLIFY_TOL, preserve_topology=True)
else:
    print("  Sin simplificacion: se conservan curvas originales del shapefile.")

# Map BA columns to IDECOR format
def get_val(row, col):
    v = row.get(col, None)
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    return str(v).strip() if isinstance(v, str) else v

def get_int(row, col):
    v = row.get(col, None)
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    try:
        return int(v)
    except:
        return None

print("  Mapeando columnas...")
features_mapped = []
for _, row in gdf.iterrows():
    if row.geometry is None or row.geometry.is_empty:
        continue
    props = {
        "TEXTUSERID": get_val(row, 'SIMBC') or get_val(row, 'Nombre_UC'),
        "CU":         parse_cu(get_val(row, 'CAP_USO')),
        "SCU":        None,
        "IP":         None,   # No disponible en datos BA
        "COMPOSIC":   get_val(row, 'Nombre_UC'),
        "TIPO_UNID":  get_val(row, 'TIPO'),
        "FUENTE":     "BA_50mil",
        "SERIE_1":    get_val(row, 'SERIE1'),
        "PORC_1":     get_int(row, 'PORC1'),
        "SERIE_2":    get_val(row, 'SERIE2'),
        "PORC_2":     get_int(row, 'PORC2'),
        "SERIE_3":    get_val(row, 'SERIE3'),
        "PORC_3":     get_int(row, 'PORC3'),
        "SERIE_4":    get_val(row, 'SERIE4'),
        "PORC_4":     get_int(row, 'PORC4'),
        "SERIE_5":    get_val(row, 'SERIE5'),
        "PORC_5":     get_int(row, 'PORC5'),
        "SERIE_6":    get_val(row, 'SERIE6'),
        "PORC_6":     get_int(row, 'PORC6'),
    }
    # Round coordinates to reduce file size
    def round_geom(g):
        if g['type'] == 'Polygon':
            return {'type': 'Polygon', 'coordinates': [
                [[round(x, COORD_PRECISION), round(y, COORD_PRECISION)] for x, y in ring]
                for ring in g['coordinates']
            ]}
        elif g['type'] == 'MultiPolygon':
            return {'type': 'MultiPolygon', 'coordinates': [
                [[[round(x, COORD_PRECISION), round(y, COORD_PRECISION)] for x, y in ring]
                 for ring in poly]
                for poly in g['coordinates']
            ]}
        return g

    feature = {
        "type": "Feature",
        "properties": props,
        "geometry": round_geom(row.geometry.__geo_interface__)
    }
    features_mapped.append(feature)

print(f"  {len(features_mapped)} features validas")

# Tile by 1x1 degree grid
print("  Tileando por cuadriculas 1x1 grado...")
tiles = {}  # key -> list of features

for feat in features_mapped:
    geom = feat['geometry']
    # Get centroid-ish: use geometry bounds midpoint for tile assignment
    coords = []
    def collect_coords(g):
        if g['type'] == 'Polygon':
            coords.extend(g['coordinates'][0])
        elif g['type'] == 'MultiPolygon':
            for poly in g['coordinates']:
                coords.extend(poly[0])
    collect_coords(geom)
    if not coords:
        continue
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    # Find all tiles this feature touches
    min_lon, max_lon = min(lons), max(lons)
    min_lat, max_lat = min(lats), max(lats)
    for lat_f in range(int(math.floor(min_lat)), int(math.floor(max_lat)) + 1):
        for lon_f in range(int(math.floor(min_lon)), int(math.floor(max_lon)) + 1):
            k = (lat_f, lon_f)
            if k not in tiles:
                tiles[k] = []
            tiles[k].append(feat)

# Write tile files
os.makedirs(OUT_DIR, exist_ok=True)
index = []

for (lat_f, lon_f), feats in tiles.items():
    fname = f"{lat_f}_{lon_f}.json"
    fpath = os.path.join(OUT_DIR, fname)
    tile_data = {
        "type": "FeatureCollection",
        "name": f"SuelosBA_{lat_f}_{lon_f}",
        "features": feats
    }
    with open(fpath, 'w', encoding='utf-8') as f:
        json.dump(tile_data, f, ensure_ascii=False, separators=(',', ':'))
    size_kb = os.path.getsize(fpath) / 1024
    print(f"    Tile ({lat_f},{lon_f}): {len(feats)} features, {size_kb:.0f} KB -> {fname}")
    index.append({
        "file": fname,
        "bbox": [lon_f, lat_f, lon_f + 1, lat_f + 1]
    })

# Write index
with open(INDEX_PATH, 'w', encoding='utf-8') as f:
    json.dump(index, f, ensure_ascii=False, indent=2)

print(f"\nListo! {len(tiles)} tiles generados en {OUT_DIR}")
print(f"Indice: {INDEX_PATH}")
