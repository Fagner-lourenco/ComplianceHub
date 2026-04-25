import json, requests, sys, time, re
from collections import Counter

with open('10-source-catalog.json', 'r', encoding='utf-8') as f:
    catalog = json.load(f)

# Get first 5 standard stubs (skip meta)
stubs = [e for e in catalog['entries'] if e.get('status') == 'stub' and e.get('deliveryMode') != 'meta']

print(f"Total non-meta stubs: {len(stubs)}")
print("")

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

for e in stubs[:5]:
    num = e['num']
    slug = e['slug']
    title = e['title']
    url = f"https://docs.bigdatacorp.com.br/plataforma/reference/{slug}"
    
    print(f"#{num} | {title}")
    print(f"  URL: {url}")
    
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        print(f"  Status: {resp.status_code}")
        if resp.status_code == 200:
            # Check if page has actual content or is a redirect/placeholder
            content_len = len(resp.text)
            print(f"  Content length: {content_len}")
            if 'dataset' in resp.text.lower() or 'preço' in resp.text.lower() or 'tabela' in resp.text.lower():
                print(f"  -> HAS PRICING DATA")
            else:
                print(f"  -> No pricing data found")
        else:
            print(f"  -> FAILED")
    except Exception as ex:
        print(f"  ERROR: {ex}")
    
    print("")
    time.sleep(1)
