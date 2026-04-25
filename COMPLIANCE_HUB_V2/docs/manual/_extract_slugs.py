import re, json

with open('_sidebar_html.txt', 'r', encoding='utf-8') as f:
    html = f.read()

skip_slugs = {'boas-vindas', 'autenticação-e-segurança', 'códigos-e-descrições-de-status',
              'primeiros-passos', 'pré-requisitos', 'primeira-consulta', 'estrutura-da-consulta',
              'parametros-de-consulta', 'personalizar-retorno', 'recustos-adicionais',
              'guia-de-navegacao', 'dicas-e-boas-práticas'}

slugs = set()
for match in re.finditer(r'href="/plataforma/reference/([^"]+)"', html):
    slug = match.group(1)
    if slug not in skip_slugs:
        slugs.add(slug)

print(f"Extracted {len(slugs)} endpoint slugs from sidebar HTML")

with open('10-source-catalog.json', 'r', encoding='utf-8') as f:
    catalog = json.load(f)

catalog_slugs = {e['slug']: e for e in catalog['entries']}

found_with_diff_slug = []
missing_in_catalog = []

for slug in sorted(slugs):
    if slug in catalog_slugs:
        continue
    
    found = False
    for cat_slug, entry in catalog_slugs.items():
        norm_s = slug.replace('-de-', '-').replace('-dos-', '-').replace('-das-', '-').replace('-do-', '-').replace('-da-', '-')
        norm_c = cat_slug.replace('-de-', '-').replace('-dos-', '-').replace('-das-', '-').replace('-do-', '-').replace('-da-', '-')
        if norm_s == norm_c or norm_s in norm_c or norm_c in norm_s:
            found_with_diff_slug.append((slug, cat_slug, entry['title'], entry.get('status','')))
            found = True
            break
    
    if not found:
        missing_in_catalog.append(slug)

print(f"\nFound {len(found_with_diff_slug)} slugs with different format:")
for sidebar_slug, cat_slug, title, status in found_with_diff_slug[:40]:
    print(f"  {sidebar_slug:75s} -> {cat_slug} [{status}]")

print(f"\nMissing from catalog ({len(missing_in_catalog)}):")
for s in missing_in_catalog[:40]:
    print(f"  {s}")
