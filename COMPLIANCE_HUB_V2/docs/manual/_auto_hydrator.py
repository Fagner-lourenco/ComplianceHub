import json, os, re
from collections import defaultdict

# Load source catalog
with open('10-source-catalog.json', 'r', encoding='utf-8') as f:
    catalog = json.load(f)

catalog_map = {e['slug']: e for e in catalog['entries']}

SCRAPED_DIR = 'bdg_scraped'

# Regex patterns
RE_DATASET_NAME = re.compile(r'Technical name of the dataset:\s*([\w_]+)', re.IGNORECASE)
RE_DATASET_NAME_PT = re.compile(r'Nome t[ée]cnico do dataset:\s*([\w_]+)', re.IGNORECASE)
RE_ENDPOINT = re.compile(r'https://plataforma\.bigdatacorp\.com\.br/([\w/]+)')
RE_DESCRIPTION = re.compile(r'Description\s*\n\s*\n(.*?)(?:\n\nTechnical name|\n\nNome t[ée]cnico|\n\nPrice list|\n\nTabela de pre[çc]os)', re.IGNORECASE | re.DOTALL)
RE_PRICE_HEADER = re.compile(r'(?:Price list|Tabela de pre[çc]os)\s*\n')
RE_FILTER_HEADER = re.compile(r'(?:Filters|Filtros)\s*\n')
RE_BODY_PARAMS = re.compile(r'(?:BODY PARAMS|Body Params)\s*\n', re.IGNORECASE)

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
    m = RE_DESCRIPTION.search(text)
    if m:
        desc = m.group(1).strip()
        # Clean up
        desc = re.sub(r'\n+', ' ', desc)
        return desc
    return None

def extract_price_table(text):
    m = RE_PRICE_HEADER.search(text)
    if not m: return None
    start = m.end()
    # Find end: next section header
    end_match = re.search(r'\n\n(?:Filters|Filtros|Complementary keys|Chaves complementares|Body params|BODY PARAMS|Observations|Observa[çc][õo]es)\s*\n', text[start:], re.IGNORECASE)
    if end_match:
        table_text = text[start:start + end_match.start()]
    else:
        table_text = text[start:start + 800]
    
    lines = [l.strip() for l in table_text.strip().split('\n') if l.strip() and 'queries' not in l.lower() and 'consultas' not in l.lower()]
    if len(lines) < 2:
        return None
    
    # Parse table lines
    rows = []
    for line in lines:
        # Match patterns like "1 - 10.000\tBRL 0.050" or "1 – 10.000    BRL 0.050"
        parts = re.split(r'\t+|\s{2,}', line)
        if len(parts) >= 2:
            rows.append((parts[0].strip(), parts[1].strip()))
        elif '\t' in line:
            parts = line.split('\t')
            rows.append((parts[0].strip(), parts[1].strip() if len(parts) > 1 else ''))
    
    return rows if rows else None

def extract_filters(text):
    m = RE_FILTER_HEADER.search(text)
    if not m: return None
    start = m.end()
    end_match = re.search(r'\n\n(?:Complementary keys|Chaves complementares|Body params|BODY PARAMS|Observations|Observa[çc][õo]es|To understand|Para entender)\s*\n', text[start:], re.IGNORECASE)
    if end_match:
        filter_text = text[start:start + end_match.start()]
    else:
        filter_text = text[start:start + 1200]
    
    lines = [l.strip() for l in filter_text.strip().split('\n') if l.strip()]
    # Skip header line if present
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

def extract_body_params(text):
    m = RE_BODY_PARAMS.search(text)
    if not m: return None
    start = m.end()
    # Capture until Response section or end
    end_match = re.search(r'\n\n(?:RESPONSE|Response|Response Body|Response body)\s*\n', text[start:], re.IGNORECASE)
    if end_match:
        params_text = text[start:start + end_match.start()]
    else:
        params_text = text[start:start + 1000]
    
    # Extract param blocks: name, type, required, description
    params = []
    lines = params_text.strip().split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if line and line.lower() in ['q', 'datasets', 'limit']:
            param = {'name': line}
            if i + 1 < len(lines):
                param['type'] = lines[i+1].strip()
            if i + 2 < len(lines):
                param['required'] = lines[i+2].strip().lower() == 'required'
            # Description is the next non-empty line after type/required
            j = i + 3
            desc_lines = []
            while j < len(lines) and lines[j].strip() and lines[j].strip().lower() not in ['q', 'datasets', 'limit']:
                desc_lines.append(lines[j].strip())
                j += 1
            param['description'] = ' '.join(desc_lines)
            params.append(param)
            i = j
        else:
            i += 1
    
    return params if params else None

def process_file(filepath, slug):
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()
    
    # Check if 404
    if 'Page Not Found' in text or len(text) < 500:
        return None, '404'
    
    result = {}
    result['datasetTechName'] = extract_dataset_name(text)
    result['endpoint'] = extract_endpoint(text)
    result['description'] = extract_description(text)
    result['priceTable'] = extract_price_table(text)
    result['filters'] = extract_filters(text)
    result['bodyParams'] = extract_body_params(text)
    
    return result, 'ok'

# Process all scraped files
results = {}
errors = defaultdict(list)

print(f"Processing files in {SCRAPED_DIR}/...")
for filename in sorted(os.listdir(SCRAPED_DIR)):
    if not filename.endswith('.md'):
        continue
    
    slug = filename[:-3]  # Remove .md
    filepath = os.path.join(SCRAPED_DIR, filename)
    
    result, status = process_file(filepath, slug)
    
    if status == '404':
        errors['404'].append((slug, filename))
    elif result:
        # Check if we got the key fields
        if result['datasetTechName'] and result['priceTable']:
            results[slug] = result
        elif result['datasetTechName']:
            results[slug] = result
            errors['missing_price'].append((slug, filename))
        else:
            errors['missing_dataset'].append((slug, filename))
    else:
        errors['empty'].append((slug, filename))

print(f"\nResults:")
print(f"  Successfully extracted: {len(results)}")
print(f"  404 / Page Not Found: {len(errors['404'])}")
print(f"  Missing price table: {len(errors['missing_price'])}")
print(f"  Missing dataset name: {len(errors['missing_dataset'])}")
print(f"  Empty/unknown: {len(errors['empty'])}")

print(f"\nSample extraction:")
for slug, data in list(results.items())[:3]:
    print(f"\n  {slug}:")
    print(f"    dataset: {data['datasetTechName']}")
    print(f"    endpoint: {data['endpoint']}")
    print(f"    description: {data['description'][:80] if data['description'] else 'N/A'}...")
    print(f"    prices: {len(data['priceTable']) if data['priceTable'] else 0} rows")
    print(f"    filters: {len(data['filters']) if data['filters'] else 0} entries")

# Save results
with open('_hydration_results.json', 'w', encoding='utf-8') as f:
    json.dump({
        'hydrated': results,
        'errors': {k: v for k, v in errors.items()}
    }, f, ensure_ascii=False, indent=2)

print(f"\nSaved to _hydration_results.json")
