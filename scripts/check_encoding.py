import sys

with open('functions/index.js', 'rb') as f:
    content = f.read()

# Procurar por bytes nao-ASCII
non_ascii = set()
for byte in content:
    if byte > 0x7F:
        non_ascii.add(byte)

print('Bytes nao-ASCII encontrados:', len(non_ascii))
print('Hex:', ' '.join(hex(b) for b in sorted(non_ascii)))

# Procurar por padroes comuns
patterns_found = []
if b'\xc3\xa2' in content:
    patterns_found.append('C3 A2 - possivel mojibake')
if b'\xe2\x80\x99' in content:
    patterns_found.append('E2 80 99 - right single quote')
if b'\xe2\x80\x9c' in content:
    patterns_found.append('E2 80 9C - left double quote')
if b'\xe2\x80\x9d' in content:
    patterns_found.append('E2 80 9D - right double quote')
if b'\xe2\x80\x94' in content:
    patterns_found.append('E2 80 94 - em-dash')
if b'\xc2\xa7' in content:
    patterns_found.append('C2 A7 - section sign')

print('\nPadroes encontrados:')
for p in patterns_found:
    print('  ', p)

# Contar ocorrencias de em-dash (correto UTF-8)
count_emdash = content.count(b'\xe2\x80\x94')
print(f'\nEm-dashes corretos (UTF-8): {count_emdash}')

# Verificar se ha caracteres de substituicao (replacement character)
count_replacement = content.count(b'\xef\xbf\xbd')
print(f'Caracteres de substituicao (\\uFFFD): {count_replacement}')
