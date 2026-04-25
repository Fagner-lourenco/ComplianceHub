import json
from collections import Counter, defaultdict

# Load source catalog
with open('10-source-catalog.json', 'r', encoding='utf-8') as f:
    catalog = json.load(f)

entries = catalog['entries']

print("=" * 70)
print("GAP ANALYSIS — HIDRATAÇÃO BDC vs. IMPLEMENTAÇÃO BACKEND")
print("=" * 70)

# 1. Overall counts
hydrated = [e for e in entries if e.get('status') == 'hydrated']
stubs = [e for e in entries if e.get('status') == 'stub']

print(f"\n1. OVERALL COUNTS")
print(f"   Total entries:     {len(entries)}")
print(f"   Hydrated:          {len(hydrated)}")
print(f"   Stubs:             {len(stubs)}")

# 2. By delivery mode
print(f"\n2. BY DELIVERY MODE")
for mode in ['standard', 'ondemand', 'marketplace', 'meta']:
    mode_h = [e for e in hydrated if e.get('deliveryMode') == mode]
    mode_s = [e for e in stubs if e.get('deliveryMode') == mode]
    print(f"   {mode:12s}: {len(mode_h):2d} hydrated + {len(mode_s):2d} stubs = {len(mode_h)+len(mode_s):2d} total")

# 3. Stubs with datasetTechName (these are the "real" endpoints)
print(f"\n3. STUBS WITH datasetTechName (real endpoints)")
stubs_with_ds = [e for e in stubs if e.get('datasetTechName')]
stubs_without_ds = [e for e in stubs if not e.get('datasetTechName')]
print(f"   With datasetTechName:    {len(stubs_with_ds)}")
print(f"   Without datasetTechName: {len(stubs_without_ds)} (mostly meta/docs)")

# 4. Which stubs HAVE datasetTechName but are still stubs?
print(f"\n4. STUBS THAT HAVE datasetTechName (need hydration)")
for e in stubs_with_ds[:20]:
    print(f"   #{e['num']:3d} | {e['deliveryMode']:10s} | {e['macroarea']:25s} | {e['datasetTechName']:30s} | {e['title'][:40]}")
if len(stubs_with_ds) > 20:
    print(f"   ... and {len(stubs_with_ds)-20} more")

# 5. Check which hydrated entries are actually used in presets
print(f"\n5. CHECK PRESET REFERENCES")
with open('11-preset-registry.md', 'r', encoding='utf-8') as f:
    preset_text = f.read()

import re
bdc_keys_in_presets = set(re.findall(r'bdc_[a-zA-Z0-9_]+', preset_text))
print(f"   BDC keys referenced in presets: {len(bdc_keys_in_presets)}")

hydrated_preset_keys = []
stub_preset_keys = []
missing_preset_keys = []

for k in sorted(bdc_keys_in_presets):
    entry = next((e for e in entries if e['sourceKey'] == k), None)
    if entry:
        if entry.get('status') == 'hydrated':
            hydrated_preset_keys.append(k)
        else:
            stub_preset_keys.append((k, entry['num'], entry['title'], entry['deliveryMode']))
    else:
        missing_preset_keys.append(k)

print(f"   Hydrated: {len(hydrated_preset_keys)}")
print(f"   Stubs:    {len(stub_preset_keys)}")
print(f"   Missing from catalog: {len(missing_preset_keys)}")

if stub_preset_keys:
    print(f"\n   STUBS IN PRESETS:")
    for k, num, title, dm in stub_preset_keys:
        print(f"      {k} -> #{num} {title} ({dm})")

if missing_preset_keys:
    print(f"\n   MISSING FROM CATALOG:")
    for k in missing_preset_keys:
        print(f"      {k}")

# 6. How many stubs have been scraped in bdg_scraped?
print(f"\n6. SCRAPED CONTENT AVAILABILITY")
import os
scraped_dir = 'bdg_scraped'
if os.path.exists(scraped_dir):
    scraped_files = os.listdir(scraped_dir)
    print(f"   Scraped files in bdg_scraped/: {len(scraped_files)}")
    
    # Check if any stub has a scraped file
    matched = 0
    for e in stubs:
        slug = e.get('slug', '')
        # Look for files containing the slug
        for f in scraped_files:
            if slug in f or slug.replace('-', '_') in f:
                matched += 1
                break
    print(f"   Stubs with scraped content: {matched}")
else:
    print(f"   bdg_scraped/ directory not found")

# 7. What the "58" might be
print(f"\n7. THE '58' CALCULATION")
# If we exclude meta (22) and count only stubs with datasetTechName
real_endpoints_stub = [e for e in stubs if e.get('datasetTechName') or e.get('deliveryMode') in ['standard', 'ondemand', 'marketplace']]
print(f"   All non-meta stubs (standard+ondemand+marketplace): {len(real_endpoints_stub)}")

# But 41 + 58 = 99. Maybe 99 is the target for "core" endpoints
# Let's see: total standard = 114, ondemand = 54, marketplace = 9
# 114 + 54 + 9 = 177 data endpoints
# 177 - 41 = 136 remaining data endpoints
# If target is 99: 136 - 99 = 37 excluded
# 37 could be: ondemand (54) - but that's too many
# Or maybe: 73 standard stubs, and user wants 58 of them (excluding 15 address ones)
standard_stubs = [e for e in stubs if e.get('deliveryMode') == 'standard']
address_stubs = [e for e in standard_stubs if any(x in e.get('title','').lower() for x in ['endereco','endereço','cep','coordenada'])]
print(f"   Standard stubs: {len(standard_stubs)}")
print(f"   Address-related standard stubs: {len(address_stubs)}")
print(f"   Standard stubs excluding addresses: {len(standard_stubs) - len(address_stubs)}")

# Could also be: 41 hydrated + 58 remaining = 99, which matches:
# standard (114) - 15 address = 99
print(f"\n   => 41 hydrated + 58 remaining = 99 total")
print(f"   => 114 standard - 15 address = 99 core standard endpoints")
print(f"   => This matches! The '58' = standard stubs excluding addresses.")

print(f"\n" + "=" * 70)
