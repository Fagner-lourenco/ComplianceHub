import json

with open('_hydration_results.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("=== 404 / Page Not Found (70) ===")
for slug, filename in data['errors']['404'][:20]:
    print(f"  {slug}")
if len(data['errors']['404']) > 20:
    print(f"  ... and {len(data['errors']['404']) - 20} more")

print(f"\n=== Missing Dataset Name (22) ===")
for slug, filename in data['errors']['missing_dataset']:
    print(f"  {slug}")

print(f"\n=== Successfully Extracted (97) ===")
for slug in sorted(data['hydrated'].keys())[:20]:
    d = data['hydrated'][slug]
    print(f"  {slug}: dataset={d['datasetTechName']}, endpoint={d['endpoint']}, prices={len(d['priceTable']) if d['priceTable'] else 0}, filters={len(d['filters']) if d['filters'] else 0}")
if len(data['hydrated']) > 20:
    print(f"  ... and {len(data['hydrated']) - 20} more")
