import json

with open('_hydration_results.json', 'r', encoding='utf-8') as f:
    results = json.load(f)

with open('10-source-catalog.json', 'r', encoding='utf-8') as f:
    catalog = json.load(f)

catalog_map = {e['slug']: e for e in catalog['entries']}

# Add recovered entries to catalog and 05b
recovered = []
for slug, data in results['hydrated'].items():
    entry = catalog_map.get(slug)
    if entry and entry.get('status') == 'stub':
        entry['status'] = 'hydrated'
        entry['datasetTechName'] = data['datasetTechName']
        if data['priceTable']:
            entry['priceByTier'] = {
                'tier1': data['priceTable'][0][1] if len(data['priceTable']) > 0 else None,
                'tier2': data['priceTable'][1][1] if len(data['priceTable']) > 1 else None,
                'tier3': data['priceTable'][2][1] if len(data['priceTable']) > 2 else None,
            }
        if data['filters']:
            entry['filters'] = data['filters']
        entry['v2Status'] = 'hydrated'
        recovered.append(slug)

with open('10-source-catalog.json', 'w', encoding='utf-8') as f:
    json.dump(catalog, f, ensure_ascii=False, indent=2)

hydrated_now = len([e for e in catalog['entries'] if e.get('status') == 'hydrated'])
stub_now = len([e for e in catalog['entries'] if e.get('status') == 'stub'])

print(f"Recovered and updated: {len(recovered)} entries")
print(f"Catalog status: {hydrated_now} hydrated, {stub_now} stubs")
for s in recovered:
    print(f"  - {s}")
