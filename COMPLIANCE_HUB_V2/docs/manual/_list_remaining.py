import json
from collections import Counter

with open('10-source-catalog.json', 'r', encoding='utf-8') as f:
    catalog = json.load(f)

stubs = [e for e in catalog['entries'] if e.get('status') == 'stub']
print(f'Remaining stubs: {len(stubs)}')

by_mode = Counter(e['deliveryMode'] for e in stubs)
print('By delivery mode:')
for k, v in by_mode.most_common():
    print(f'  {k}: {v}')

print('')
print('All remaining stubs:')
for e in stubs:
    print(f"#{e['num']:3d} | {e['deliveryMode']:12s} | {e['macroarea']:25s} | {e['title'][:45]} | slug={e['slug']}")
