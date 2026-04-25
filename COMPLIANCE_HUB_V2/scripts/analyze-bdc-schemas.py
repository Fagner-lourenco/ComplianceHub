#!/usr/bin/env python3
"""
Analise profunda dos schemas reais retornados pela BDC.
Gera bdc_api_results/_FIELD_ANALYSIS.md
"""
import json, os, glob

ROOT = os.path.join(os.path.dirname(__file__), '..', 'bdc_api_results')
OUT = os.path.join(ROOT, '_FIELD_ANALYSIS.md')

def summarize_value(v):
    if isinstance(v, str):
        return (v[:60] + '...') if len(v) > 60 else v
    if isinstance(v, (int, float, bool)):
        return str(v)
    if isinstance(v, list):
        return f'[array len={len(v)}]'
    if isinstance(v, dict):
        return f'{{obj keys={len(v)}}}'
    return str(v)

def analyze_dataset(dataset_name, entity_type):
    pattern = os.path.join(ROOT, '*', f'{dataset_name}.json')
    files = sorted(glob.glob(pattern))
    if not files:
        pattern2 = os.path.join(ROOT, '*', f'{dataset_name.replace(".", "_")}.json')
        files = sorted(glob.glob(pattern2))
    
    results = []
    all_keys = set()
    key_types = {}
    
    for fpath in files:
        entity = os.path.basename(os.path.dirname(fpath))
        try:
            with open(fpath, encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            results.append({'entity': entity, 'error': str(e)})
            continue
        
        result = data.get('Result', [{}])[0] if isinstance(data.get('Result'), list) else {}
        main_key = [k for k in result.keys() if k != 'MatchKeys']
        
        entry = {
            'entity': entity,
            'main_keys': main_key,
            'size_kb': round(os.path.getsize(fpath)/1024, 1),
            'status_code': data.get('Status', {}).get('Code', 0),
            'sample': {},
        }
        
        for mk in main_key:
            val = result.get(mk)
            all_keys.add(mk)
            
            if isinstance(val, dict):
                for subk, subv in val.items():
                    full_key = f'{mk}.{subk}'
                    all_keys.add(full_key)
                    t = type(subv).__name__
                    if full_key not in key_types:
                        key_types[full_key] = set()
                    key_types[full_key].add(t)
                    if len(entry['sample']) < 5:
                        entry['sample'][full_key] = summarize_value(subv)
            elif isinstance(val, list) and val and isinstance(val[0], dict):
                for subk in val[0].keys():
                    all_keys.add(f'{mk}[].{subk}')
                if len(entry['sample']) < 5:
                    entry['sample'][f'{mk}[]'] = f'array[{len(val)}] first keys={list(val[0].keys())[:5]}'
            else:
                if mk not in key_types:
                    key_types[mk] = set()
                key_types[mk].add(type(val).__name__)
                if len(entry['sample']) < 5:
                    entry['sample'][mk] = summarize_value(val)
        
        results.append(entry)
    
    return results, all_keys, key_types

DATASETS_PF = [
    ('basic_data', 'PF'),
    ('kyc', 'PF'),
    ('processes_limit_100_', 'PF'),
    ('occupation_data', 'PF'),
    ('phones_extended', 'PF'),
    ('addresses_extended', 'PF'),
    ('emails_extended', 'PF'),
    ('online_presence', 'PF'),
    ('financial_data', 'PF'),
    ('class_organization', 'PF'),
]

DATASETS_PJ = [
    ('basic_data', 'PJ'),
    ('kyc', 'PJ'),
    ('relationships', 'PJ'),
    ('processes_limit_100_', 'PJ'),
    ('activity_indicators', 'PJ'),
    ('company_evolution', 'PJ'),
    ('owners_kyc', 'PJ'),
]

lines = []
lines.append('# Analise Profunda -- Schemas Reais BDC')
lines.append('')
lines.append('> Gerado automaticamente a partir dos JSONs de resposta reais.')
lines.append('> CPFs: 48052053854, 10794180329, 11819916766, 05023290336, 46247243804')
lines.append('> CNPJs: 42975374000172, 13783221000478')
lines.append('')

for dataset, etype in DATASETS_PF + DATASETS_PJ:
    label = f'{etype} -- `{dataset}`'
    lines.append(f'## {label}')
    lines.append('')
    
    results, all_keys, key_types = analyze_dataset(dataset, etype)
    
    lines.append('### Resumo por entidade')
    lines.append('')
    lines.append('| Entidade | Main Keys | Tamanho | Status |')
    lines.append('|---|---|---|---|')
    for r in results:
        if 'error' in r:
            lines.append(f'| {r["entity"]} | ERRO | -- | -- |')
        else:
            status = 'OK' if r['status_code'] == 0 else f'WARN {r["status_code"]}'
            lines.append(f'| {r["entity"]} | {", ".join(r["main_keys"])} | {r["size_kb"]} KB | {status} |')
    lines.append('')
    
    lines.append('### Campos retornados')
    lines.append('')
    lines.append('| Campo | Tipo | Exemplo |')
    lines.append('|---|---|---|')
    
    sample = next((r['sample'] for r in results if 'sample' in r), {})
    for key in sorted(all_keys):
        if '.' in key or '[]' in key:
            continue
        types = ', '.join(key_types.get(key, {'unknown'}))
        ex = sample.get(key, '')
        if isinstance(ex, str) and len(ex) > 50:
            ex = ex[:47] + '...'
        lines.append(f'| `{key}` | {types} | {ex} |')
    lines.append('')
    
    sub_keys = [k for k in sorted(all_keys) if '.' in k]
    if sub_keys:
        lines.append('### Sub-campos (dentro de objetos)')
        lines.append('')
        lines.append('| Campo | Tipo |')
        lines.append('|---|---|')
        for key in sub_keys[:40]:
            types = ', '.join(key_types.get(key, {'unknown'}))
            lines.append(f'| `{key}` | {types} |')
        if len(sub_keys) > 40:
            lines.append(f'| ... | ... |')
            lines.append(f'| *+{len(sub_keys)-40} campos* | |')
        lines.append('')

with open(OUT, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print(f'Analise salva em: {OUT}')
print(f'Total de datasets analisados: {len(DATASETS_PF) + len(DATASETS_PJ)}')
