import json, os

# The 7 standard stubs with 404
standard_404 = [
    ('pessoas-kyc-e-compliance-dos-familiares', [
        'pessoas-kyc-e-compliance-dos-familiares-de-primeiro-nivel',
        'pessoas-kyc-e-compliance-familiares',
    ]),
    ('pessoas-compliance-de-casas-de-apostas', [
        'pessoas-compliance-casas-de-apostas',
        'pessoas-casas-de-apostas',
    ]),
    ('pessoas-propensao-a-aposta-online', [
        'pessoas-propensoes-a-aposta-online',
        'pessoas-propensao-aposta-online',
    ]),
    ('pessoas-programas-de-beneficios', [
        'pessoas-programas-de-beneficios-e-assistencia-social',
        'pessoas-beneficios-e-assistencia-social',
    ]),
    ('pessoas-programas-de-beneficios-de-familiares', [
        'pessoas-programas-de-beneficios-e-assistencia-social-de-familiares',
        'pessoas-beneficios-de-familiares',
    ]),
    ('pessoas-processos-judiciais-familiares', [
        'pessoas-processos-judiciais-e-administrativos-de-familiares',
        'pessoas-processos-judiciais-de-familiares',
    ]),
    ('pessoas-informacoes-socio-demograficas', [
        'pessoas-informacoes-socio-demograficas',
    ]),
]

scraped_dir = 'bdg_scraped'
scraped_files = set(os.listdir(scraped_dir))

print("Trying slug variants for 404 standard endpoints:")
print("")

for original, variants in standard_404:
    print(f"Original: {original}")
    found = False
    for v in variants:
        fname = v + '.md'
        if fname in scraped_files:
            # Check if it's a real page (not 404)
            filepath = os.path.join(scraped_dir, fname)
            with open(filepath, 'r', encoding='utf-8') as f:
                text = f.read()
            if 'Page Not Found' not in text and len(text) > 500:
                print(f"  -> FOUND: {v} ({len(text)} bytes)")
                found = True
                break
            else:
                print(f"  -> {v} is also 404")
    if not found:
        print(f"  -> NO VARIANT FOUND")
    print("")
