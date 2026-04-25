import json
from collections import Counter

with open('10-source-catalog.json', 'r', encoding='utf-8') as f:
    catalog = json.load(f)

stubs = [e for e in catalog['entries'] if e.get('status') == 'stub']
print(f'Total stubs to hydrate: {len(stubs)}')

by_mode = Counter(e['deliveryMode'] for e in stubs)
print('By delivery mode:')
for k, v in by_mode.most_common():
    print(f'  {k}: {v}')

by_macro = Counter(e['macroarea'] for e in stubs)
print('By macroarea:')
for k, v in by_macro.most_common():
    print(f'  {k}: {v}')

print('')
print('First 20 stubs:')
for e in stubs[:20]:
    print(f"#{e['num']:3d} | {e['deliveryMode']:12s} | {e['macroarea']:25s} | {e['title'][:45]}")
