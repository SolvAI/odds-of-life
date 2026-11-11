# Compares the country table in src/data/world.ts with the latest World Bank values.
#   python3 scripts/check-data.py
# Prints the median gap per indicator and every country more than 25% off.
import json
import re
import statistics
import urllib.request
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / 'src' / 'data' / 'world.ts'
INDICATORS = {  # our column -> World Bank indicator
    'lifeExp': 'SP.DYN.LE00.IN',   # life expectancy at birth (UN WPP)
    'tfr': 'SP.DYN.TFRT.IN',       # births per woman (UN WPP)
    'homicide': 'VC.IHR.PSRC.P5',  # homicides per 100k (UNODC)
    'road': 'SH.STA.TRAF.P5',      # road deaths per 100k (WHO)
    'mmr': 'SH.STA.MMRT',          # maternal deaths per 100k births (WHO/UN MMEIG)
}

rows = {}
for m in re.finditer(r"\['(\w\w)', '([^']+)', \d+, '\w+', (\d+), '\w+', '[^']+', ([^\]]+)\]", SRC.read_text()):
    n = [float(x) for x in m.group(4).split(',')]
    rows[m.group(1)] = {'name': m.group(2), 'lifeExp': float(m.group(3)), 'homicide': n[0], 'road': n[1], 'tfr': n[8], 'mmr': n[9]}
by_name = {r['name']: code for code, r in rows.items()}

for key, indicator in INDICATORS.items():
    url = f"https://api.worldbank.org/v2/country/{';'.join(rows)}/indicator/{indicator}?format=json&mrv=1&per_page=200"
    data = json.load(urllib.request.urlopen(url, timeout=30))[1] or []
    gaps, far = [], []
    for d in data:
        code = d['country']['id'] if d['country']['id'] in rows else by_name.get(d['country']['value'])
        if not code or d['value'] is None:
            continue
        ours, theirs = rows[code][key], d['value']
        gap = abs(ours - theirs) / max(abs(theirs), 1e-9)
        gaps.append(gap)
        if gap > 0.25:
            far.append(f"{rows[code]['name']} {ours:g} vs {theirs:.3g} ({d['date']})")
    print(f"{key:9s} {len(gaps):2d} countries, median gap {statistics.median(gaps) * 100:4.1f}%. Over 25%: {'; '.join(far) or 'none'}")
