# filepath: backend/scripts/fetch_partners_osm.py
"""Тянет точки брендов-партнёров МТБанка из OpenStreetMap через Overpass API
и складывает в backend/partners_osm.json.

Запуск:  python scripts/fetch_partners_osm.py
"""
import json
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen, Request

# Минск — bbox
BBOX = (53.83, 27.40, 53.98, 27.72)  # south, west, north, east

# brand -> (category, mcc, cashback_percent)
BRAND_MAP = {
    # grocery
    "Евроопт":       ("grocery", "5411", 2.0),
    "Eurospar":      ("grocery", "5411", 2.0),
    "Green":         ("grocery", "5411", 3.5),
    "Санта":         ("grocery", "5411", 2.5),
    "Соседи":        ("grocery", "5411", 3.0),
    "Корона":        ("grocery", "5411", 2.5),
    "Рублёвский":    ("grocery", "5411", 2.0),
    "Виталюр":       ("grocery", "5411", 3.0),
    "Алми":          ("grocery", "5411", 2.5),
    "Гиппо":         ("grocery", "5411", 2.0),
    "ProStore":      ("grocery", "5411", 2.0),
    "Bigzz":         ("grocery", "5411", 3.0),
    "Mart Inn":      ("grocery", "5411", 2.5),
    "e-doставка":    ("grocery", "5411", 3.0),
    "Hit!":          ("grocery", "5411", 2.0),
    "Доброном":      ("grocery", "5411", 2.0),
    # restaurants / cafes
    "McDonald's":    ("restaurant", "5812", 2.0),
    "KFC":           ("restaurant", "5812", 2.5),
    "Burger King":   ("restaurant", "5812", 2.5),
    "Domino's Pizza": ("restaurant", "5812", 3.0),
    "Папа Джонс":    ("restaurant", "5812", 3.0),
    "Васильки":      ("restaurant", "5812", 4.0),
    "Лидо":          ("restaurant", "5812", 3.5),
    "Планета Суши":  ("restaurant", "5812", 4.0),
    "Якитория":      ("restaurant", "5812", 4.0),
    "Coffee Like":   ("restaurant", "5812", 4.0),
    "Black Coffee":  ("restaurant", "5812", 4.0),
    "Stolle":        ("restaurant", "5812", 4.0),
    "News Cafe":     ("restaurant", "5812", 4.0),
    "Раковский Бровар": ("restaurant", "5812", 5.0),
    # fuel
    "А-100":         ("fuel", "5541", 4.0),
    "Газпромнефть":  ("fuel", "5541", 5.0),
    "Белоруснефть":  ("fuel", "5541", 5.0),
    "Лукойл":        ("fuel", "5541", 4.5),
    "BP":            ("fuel", "5541", 5.5),
    "Татнефть":      ("fuel", "5541", 4.0),
    # other
    "ZигZаг":        ("other", "5999", 4.0),
    "Электросила":   ("other", "5999", 3.5),
    "5 элемент":     ("other", "5999", 3.5),
    "OZ.by":         ("other", "5999", 3.0),
    "21 век":        ("other", "5999", 4.0),
    "Mila":          ("other", "5999", 3.5),
    "Apteka.by":     ("other", "5999", 3.5),
    "Marko":         ("other", "5999", 4.0),
    "H&M":           ("other", "5999", 4.5),
    "Zara":          ("other", "5999", 4.0),
    "Reserved":      ("other", "5999", 4.0),
    "Bershka":       ("other", "5999", 4.0),
    "Беларусбанк":   ("other", "6011", 0.0),
    "Белагропромбанк": ("other", "6011", 0.0),
    "МТБанк":        ("other", "6011", 0.0),
    "Белпочта":      ("other", "9402", 1.0),
    "Евросеть":      ("other", "5999", 3.0),
}

OVERPASS_URL = "https://overpass-api.de/api/interpreter"


def build_query(brand: str) -> str:
    s, w, n, e = BBOX
    return f"""
[out:json][timeout:30];
(
  node["brand"~"^{brand}$",i]({s},{w},{n},{e});
  way["brand"~"^{brand}$",i]({s},{w},{n},{e});
  node["name"~"^{brand}",i]({s},{w},{n},{e});
);
out center tags;
"""


def fetch(brand: str):
    q = build_query(brand)
    body = urlencode({"data": q}).encode("utf-8")
    req = Request(
        OVERPASS_URL,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "User-Agent": "fog-of-war-mtbank/1.0 (hackathon)",
        },
    )
    with urlopen(req, timeout=60) as r:
        data = json.load(r)
    out = []
    for el in data.get("elements", []):
        tags = el.get("tags", {}) or {}
        name = tags.get("name") or tags.get("brand") or brand
        if el["type"] == "node":
            lat, lon = el.get("lat"), el.get("lon")
        else:
            c = el.get("center") or {}
            lat, lon = c.get("lat"), c.get("lon")
        if lat is None or lon is None:
            continue
        out.append({"name": name, "lat": lat, "lng": lon})
    return out


def main():
    result = []
    seen = set()
    for brand, (cat, mcc, cb) in BRAND_MAP.items():
        print(f"→ {brand}...", flush=True)
        try:
            items = fetch(brand)
        except Exception as e:
            print(f"  ошибка: {e}")
            time.sleep(5)
            continue
        for it in items:
            key = (round(it["lat"], 5), round(it["lng"], 5), brand)
            if key in seen:
                continue
            seen.add(key)
            result.append({
                "name": it["name"],
                "brand": brand,
                "category": cat,
                "mcc_code": mcc,
                "cashback_percent": cb,
                "lat": it["lat"],
                "lng": it["lng"],
            })
        print(f"  +{len(items)}")
        time.sleep(1.2)  # вежливо к Overpass

    out_path = Path(__file__).resolve().parent.parent / "partners_osm.json"
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Сохранено {len(result)} точек → {out_path}")


if __name__ == "__main__":
    main()
