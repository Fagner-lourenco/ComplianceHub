import re, json, os

# Read the sidebar HTML from a file (save the user's HTML first)
html_path = '_sidebar_html.txt'

# For now, I'll extract from the message directly by saving it
with open(html_path, 'w', encoding='utf-8') as f:
    # The HTML was provided in the user's message
    pass

# Extract all href slugs
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Find all /plataforma/reference/XXX patterns
slugs = set()
for match in re.finditer(r'href="/plataforma/reference/([^"]+)"', html):
    slug = match.group(1)
    # Skip non-endpoint pages
    if slug in ['boas-vindas', 'autenticação-e-segurança', 'códigos-e-descrições-de-status',
                'primeiros-passos', 'pré-requisitos', 'primeira-consulta', 'estrutura-da-consulta',
                'parametros-de-consulta', 'personalizar-retorno', 'recustos-adicionais',
                'guia-de-navegacao', 'dicas-e-boas-práticas']:
        continue
    slugs.add(slug)

print(f"Extracted {len(slugs)} endpoint slugs from sidebar HTML")

# Load catalog
with open('10-source-catalog.json', 'r', encoding='utf-8') as f:
    catalog = json.load(f)

catalog_slugs = {e['slug']: e for e in catalog['entries']}

# Find missing slugs (in sidebar but not in catalog)
missing_in_catalog = []
found_with_diff_slug = []

for slug in sorted(slugs):
    if slug in catalog_slugs:
        continue
    
    # Try to find a similar slug in catalog
    found = False
    for cat_slug, entry in catalog_slugs.items():
        # Normalize both for comparison
        norm_slug = slug.replace('-de-', '-').replace('-dos-', '-').replace('-das-', '-')
        norm_cat = cat_slug.replace('-de-', '-').replace('-dos-', '-').replace('-das-', '-')
        if norm_slug == norm_cat or norm_slug in norm_cat or norm_cat in norm_slug:
            found_with_diff_slug.append((slug, cat_slug, entry['title']))
            found = True
            break
    
    if not found:
        missing_in_catalog.append(slug)

print(f"\nFound {len(found_with_diff_slug)} slugs with different format:")
for sidebar_slug, cat_slug, title in found_with_diff_slug[:20]:
    print(f"  Sidebar: {sidebar_slug}")
    print(f"  Catalog: {cat_slug} ({title})")
    print()

print(f"\nMissing from catalog ({len(missing_in_catalog)}):")
for s in missing_in_catalog[:30]:
    print(f"  {s}")
