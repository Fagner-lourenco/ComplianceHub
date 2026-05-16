# Teste de normalizacao Unicode (Python)

def normalizeUnicodeToAscii(text):
    if not text or not isinstance(text, str):
        return text
    # smart single quotes
    text = text.replace('\u2018', "'").replace('\u2019', "'")
    # smart double quotes  
    text = text.replace('\u201C', '"').replace('\u201D', '"')
    text = text.replace('\u2014', '--')  # em-dash
    text = text.replace('\u2013', '-')   # en-dash
    text = text.replace('\u2026', '...') # ellipsis
    text = text.replace('\u00A0', ' ')   # non-breaking space
    return text

# Testes
tests = [
    ("Teste com em-dash: \u2014 aqui", "Teste com em-dash: -- aqui"),
    ("Aspas curvas: \u201cteste\u201d", 'Aspas curvas: \"teste\"'),
    ("Apostrofo: it\u2019s", "Apostrofo: it's"),
    ("Elipse: \u2026", "Elipse: ..."),
    ("NBSP: a\u00A0b", "NBSP: a b"),
]

print("Testes de normalizacao:")
all_passed = True
for input_text, expected in tests:
    result = normalizeUnicodeToAscii(input_text)
    status = "OK" if result == expected else "FALHA"
    if status == "FALHA":
        all_passed = False
    print(f"{status}: input -> {result!r}")
    if result != expected:
        print(f"  Esperado: {expected!r}")

print(f"\nResultado geral: {'TODOS PASSARAM' if all_passed else 'HOUVE FALHAS'}")
