import json, os

summary = {}
for root, dirs, files in os.walk('bdc_api_results'):
    for f in sorted(files):
        if not f.endswith('.json') or f.startswith('_'):
            continue
        path = os.path.join(root, f)
        rel = os.path.relpath(path, 'bdc_api_results')
        try:
            with open(path, encoding='utf-8') as fp:
                data = json.load(fp)
            result = data.get('Result', [{}])[0] if isinstance(data.get('Result'), list) else {}
            keys = [k for k in result.keys() if k != 'MatchKeys']
            size_kb = round(os.path.getsize(path)/1024, 1)
            summary[rel] = {'keys': keys, 'size_kb': size_kb, 'status': data.get('Status', {}).get('Code', 0)}
        except Exception as e:
            summary[rel] = {'error': str(e)}

for entity in ['pessoa_1', 'pessoa_2', 'pessoa_3', 'pessoa_4', 'pessoa_5', 'empresa_1', 'empresa_2']:
    print(f'\n=== {entity.upper()} ===')
    for k, v in sorted(summary.items()):
        if k.startswith(entity + '\\'):
            fname = k.split('\\')[1]
            if 'error' in v:
                print(f'  {fname}: ERRO - {v["error"]}')
            else:
                status_flag = 'WARN' if v['status'] != 0 else 'OK'
                print(f'  [{status_flag}] {fname} ({v["size_kb"]} KB) -> {", ".join(v["keys"])}')
