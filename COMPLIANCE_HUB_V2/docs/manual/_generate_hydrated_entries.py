import json, os

with open('_hydration_results.json', 'r', encoding='utf-8') as f:
    results = json.load(f)

with open('10-source-catalog.json', 'r', encoding='utf-8') as f:
    catalog = json.load(f)

catalog_map = {e['slug']: e for e in catalog['entries']}

# Load existing hydrated entries to avoid duplicates
existing_slugs = set()
with open('05b-bigdatacorp-hydrated.md', 'r', encoding='utf-8') as f:
    content = f.read()
    for match in __import__('re').finditer(r'slug:\s*([^\s|]+)', content):
        existing_slugs.add(match.group(1).strip())

print(f"Existing hydrated slugs in 05b: {len(existing_slugs)}")

new_entries = []
for slug, data in results['hydrated'].items():
    if slug in existing_slugs:
        continue
    
    entry = catalog_map.get(slug)
    if not entry:
        print(f"Warning: {slug} not found in catalog")
        continue
    
    num = entry['num']
    title = entry['title']
    dataset = data['datasetTechName'] or '_[a coletar]_'
    endpoint = data['endpoint'] or '_[a coletar]_'
    description = data['description'] or '_[a coletar]_'
    
    # Build price table markdown
    price_md = ""
    if data['priceTable']:
        price_md = "**Tabela de preços**\n\n| Consultas Realizadas no Mês | Valor por consulta |\n|---|---|\n"
        for row in data['priceTable']:
            price_md += f"| {row[0]} | {row[1]} |\n"
    else:
        price_md = "**Tabela de preços:** _[não encontrada]_\n"
    
    # Build filters markdown
    filters_md = ""
    if data['filters']:
        filters_md = "**Filtros**\n\n| Campo | Descrição | Tipo | Valores |\n|---|---|---|---|\n"
        for f in data['filters']:
            filters_md += f"| {f['field']} | {f['description']} | {f['type']} | {f['values']} |\n"
    else:
        filters_md = "**Filtros:** _[não encontrados]_\n"
    
    # Build body params
    body_md = "**Body Params**\n\n| Campo | Tipo | Obrigatório | Descrição |\n|---|---|---|---|\n"
    if data['bodyParams']:
        for p in data['bodyParams']:
            req = 'sim' if p.get('required') else 'não'
            body_md += f"| {p['name']} | {p.get('type', 'string')} | {req} | {p.get('description', '')[:60]} |\n"
    else:
        body_md += "| q | string | sim | Identificadores e filtros |\n| Datasets | string | sim | Nome técnico do dataset |\n| Limit | number | não | Máx 80 |\n"
    
    # Determine v2 status
    v2_status = "GAP"
    if entry.get('sourceKey') in ['bdc_pessoas_dados_cadastrais_basicos', 'bdc_pessoas_processos_judiciais_e_administrativos', 
                                    'bdc_pessoas_kyc_e_compliance', 'bdc_pessoas_informacoes_financeiras',
                                    'bdc_empresas_dados_cadastrais_basicos']:
        v2_status = "✓ consumed"
    
    # Build entry
    entry_md = f"""### {num}. {title}
<!-- slug: {slug} | dataset: {dataset} | endpoint: POST {endpoint} -->
<!-- V2: {v2_status} -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/{slug}
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br{endpoint}`
**Dataset técnico:** `{dataset}`

**Descrição:** {description}

{price_md}
**Chaves complementares:** _[não encontradas]_

{filters_md}
{body_md}
**Observações:** _[não encontradas]_

---

"""
    new_entries.append((num, entry_md))

# Sort by num and write
new_entries.sort(key=lambda x: x[0])

print(f"New entries to append: {len(new_entries)}")

with open('05b-bigdatacorp-hydrated.md', 'a', encoding='utf-8') as f:
    f.write("\n")
    for num, entry_md in new_entries:
        f.write(entry_md)

print(f"Appended {len(new_entries)} entries to 05b-bigdatacorp-hydrated.md")

# Update source-catalog.json
updated_count = 0
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
        updated_count += 1

with open('10-source-catalog.json', 'w', encoding='utf-8') as f:
    json.dump(catalog, f, ensure_ascii=False, indent=2)

print(f"Updated {updated_count} entries in 10-source-catalog.json")

# Summary
hydrated_now = len([e for e in catalog['entries'] if e.get('status') == 'hydrated'])
stub_now = len([e for e in catalog['entries'] if e.get('status') == 'stub'])
print(f"\nCatalog status: {hydrated_now} hydrated, {stub_now} stubs")
