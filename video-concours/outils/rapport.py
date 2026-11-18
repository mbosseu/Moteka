import json, sys
from collections import Counter
raw = open('check.json', encoding='utf-8', errors='replace').read()
d, _ = json.JSONDecoder().raw_decode(raw[raw.index('{'):])
vus = []
def parcourt(o):
    if isinstance(o, dict):
        if 'severity' in o and ('code' in o or 'rule' in o):
            vus.append(o); return
        for v in o.values(): parcourt(v)
    elif isinstance(o, list):
        for v in o: parcourt(v)
parcourt(d)
print(Counter((o['severity'], o.get('code')) for o in vus))
for o in vus:
    c = o.get('code')
    if o['severity'] == 'error' or c in ('line_unread', 'first_frame_empty', 'text_below_floor', 'duplicate_audio_track', 'gsap_repeated_fromto_without_baseline') \
       or (c == 'outside_safe_zone' and 'Instagram' in str(o.get('message'))):
        print(o['severity'], c, '|', str(o.get('message'))[:200], '|', o.get('selector', ''), o.get('time', ''))
