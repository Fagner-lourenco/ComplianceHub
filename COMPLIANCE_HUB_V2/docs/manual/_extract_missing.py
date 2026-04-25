import json, os, re

with open('_hydration_results.json', 'r', encoding='utf-8') as f:
    results = json.load(f)

with open('10-source-catalog.json', 'r', encoding='utf-8') as f:
    catalog = json.load(f)

catalog_map = {e['slug']: e for e in catalog['entries']}

# Check missing_dataset entries - some might have content but we missed the dataset name pattern
RE_DATASET_NAME = re.compile(r'Technical name of the dataset:\s*\*?\s*([\w_]+)', re.IGNORECASE)
RE_DATASET_NAME_PT = re.compile(r'Nome t[ée]cnico do dataset:\s*\*?\s*([\w_]+)', re.IGNORECASE)
RE_ENDPOINT = re.compile(r'https://plataforma\.bigdatacorp\.com\.br/([\w/]+)')

def extract_dataset_name(text):
    m = RE_DATASET_NAME.search(text)
    if m: return m.group(1)
    m = RE_DATASET_NAME_PT.search(text)
    if m: return m.group(1)
    return None

def extract_endpoint(text):
    m = RE_ENDPOINT.search(text)
    if m: return '/' + m.group(1).split('/')[-1]
    return None

def extract_description(text):
    m = re.search(r'Description\s*\n\s*\n(.*?)(?:\n\nTechnical name|\n\nNome t[ée]cnico|\n\nPrice list|\n\nTabela de pre[çc]os)', text, re.IGNORECASE | re.DOTALL)
    if m:
        desc = m.group(1).strip()
        desc = re.sub(r'\n+', ' ', desc)
        return desc
    return None

def extract_price_table(text):
    m = re.search(r'(?:Price list|Tabela de pre[çc]os)\s*\n', text, re.IGNORECASE)
    if not m: return None
    start = m.end()
    end_match = re.search(r'\n\n(?:Filters|Filtros|Complementary keys|Chaves complementares|Body params|BODY PARAMS|Observations|Observa[çc][õo]es)\s*\n', text[start:], re.IGNORECASE)
    if end_match:
        table_text = text[start:start + end_match.start()]
    else:
        table_text = text[start:start + 800]
    
    lines = [l.strip() for l in table_text.strip().split('\n') if l.strip()]
    rows = []
    for line in lines:
        if 'queries' in line.lower() or 'consultas' in line.lower():
            continue
        parts = re.split(r'\t+|\s{2,}', line)
        if len(parts) >= 2:
            rows.append((parts[0].strip(), parts[1].strip()))
    return rows if rows else None

def extract_filters(text):
    m = re.search(r'(?:Filters|Filtros)\s*\n', text, re.IGNORECASE)
    if not m: return None
    start = m.end()
    end_match = re.search(r'\n\n(?:Complementary keys|Chaves complementares|Body params|BODY PARAMS|Observations|Observa[çc][õo]es|To understand|Para entender|Ranges of returned values)\s*\n', text[start:], re.IGNORECASE)
    if end_match:
        filter_text = text[start:start + end_match.start()]
    else:
        filter_text = text[start:start + 1200]
    
    lines = [l.strip() for l in filter_text.strip().split('\n') if l.strip()]
    if lines and ('field' in lines[0].lower() or 'campo' in lines[0].lower()):
        lines = lines[1:]
    
    filters = []
    for line in lines:
        parts = re.split(r'\t+|\s{2,}', line)
        if len(parts) >= 3:
            filters.append({
                'field': parts[0].strip(),
                'description': parts[1].strip() if len(parts) > 1 else '',
                'type': parts[2].strip() if len(parts) > 2 else '',
                'values': parts[3].strip() if len(parts) > 3 else ''
            })
    return filters if filters else None

# Process missing_dataset entries
found = []
for slug, filename in results['errors']['missing_dataset']:
    filepath = os.path.join('bdg_scraped', filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()
    
    ds = extract_dataset_name(text)
    if ds:
        desc = extract_description(text)
        endpoint = extract_endpoint(text)
        prices = extract_price_table(text)
        filters = extract_filters(text)
        found.append((slug, ds, endpoint, desc, prices, filters))
        print(f"FOUND: {slug} -> dataset={ds}, endpoint={endpoint}, prices={len(prices) if prices else 0}")

print(f"\nTotal recovered from missing_dataset: {len(found)}")

# Add to results
for slug, ds, endpoint, desc, prices, filters in found:
    results['hydrated'][slug] = {
        'datasetTechName': ds,
        'endpoint': endpoint,
        'description': desc,
        'priceTable': prices,
        'filters': filters,
        'bodyParams': None
    }

# Save updated results
with open('_hydration_results.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print("Saved updated _hydration_results.json")
