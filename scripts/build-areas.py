"""Build lib/areas-data.json (district slug, 행정동 list, neighbours).

Inputs (not committed, download first):
  seoul.json  https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_municipalities_geo_simple.json
  dong.geojson https://raw.githubusercontent.com/vuski/admdongkor/master/ver20230701/HangJeongDong_ver20230701.geojson
  sub2013.json https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_submunicipalities_geo_simple.json
               (official KOSTAT English dong names, 2013)
Usage: python3 scripts/build-areas.py seoul.json dong.geojson sub2013.json
"""
import json, re, sys
from collections import defaultdict
from shapely.geometry import Polygon

seoul = json.load(open(sys.argv[1], encoding='utf-8'))['features']
dong = json.load(open(sys.argv[2], encoding='utf-8'))['features']
sub = json.load(open(sys.argv[3], encoding='utf-8'))['features']

gu_by_code = {f['properties']['code']: f['properties']['name'] for f in seoul}
en13 = {(gu_by_code[f['properties']['code'][:5]], f['properties']['name']): f['properties']['name_eng'] for f in sub}
# dongs created or renamed after 2013
OVERRIDES = {
    ('강남구', '개포3동'): 'Gaepo 3(sam)-dong',
    ('강동구', '상일제1동'): 'Sangil 1(il)-dong',
    ('강동구', '상일제2동'): 'Sangil 2(i)-dong',
    ('구로구', '항동'): 'Hang-dong',
    ('송파구', '위례동'): 'Wirye-dong',
}


def english_dong(gu_name, dong_name):
    raw = OVERRIDES.get((gu_name, dong_name)) or en13[(gu_name, dong_name)]
    name = re.sub(r'\([a-z]+\)', '', raw)          # "Cheonho 2(i)-dong" -> "Cheonho 2-dong"
    name = re.sub(r'(?<=\d)Ga-?dong$', '-ga', name)  # "Jongno1·2·3·4Gadong" -> "Jongno1·2·3·4-ga"
    name = re.sub(r'(?<=[a-z])dong$', '-dong', name)   # "Pildong" -> "Pil-dong"
    name = re.sub(r'(?<=[A-Za-z])(?=\d)', ' ', name)  # "Dangsan1-dong" -> "Dangsan 1-dong"
    return name

dongs = defaultdict(list)
for f in dong:
    p = f['properties']
    if str(p.get('sidonm', '')).startswith('서울'):
        dongs[p['sggnm']].append((p['adm_cd2'], p['adm_nm'].split()[-1]))

polys = {f['properties']['name']: Polygon(f['geometry']['coordinates'][0]).buffer(0) for f in seoul}

out = []
for f in seoul:
    name = f['properties']['name']
    slug = f['properties']['name_eng'].lower().replace('-gu', '').replace(' ', '')
    names = [n for _, n in sorted(dongs[name])]
    nb = sorted(n for n, pg in polys.items() if n != name and polys[name].buffer(1e-6).intersects(pg))
    out.append({'name': name, 'nameEn': f['properties']['name_eng'], 'slug': slug, 'dongs': names,
                'dongsEn': [english_dong(name, d) for d in names], 'neighbors': nb})

out.sort(key=lambda g: g['name'])
json.dump(out, open('lib/areas-data.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(out), 'districts;', sum(len(g['dongs']) for g in out), 'dongs')
for g in out:
    print(g['name'], g['slug'], len(g['dongs']), g['neighbors'])
