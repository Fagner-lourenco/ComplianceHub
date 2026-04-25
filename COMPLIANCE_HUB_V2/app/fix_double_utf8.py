import os

fixes = [
    (b'\xc3\x83\xc2\xa1', b'\xc3\xa1'),
    (b'\xc3\x83\xc2\xa0', b'\xc3\xa0'),
    (b'\xc3\x83\xc2\xa2', b'\xc3\xa2'),
    (b'\xc3\x83\xc2\xa3', b'\xc3\xa3'),
    (b'\xc3\x83\xc2\xa7', b'\xc3\xa7'),
    (b'\xc3\x83\xc2\xa9', b'\xc3\xa9'),
    (b'\xc3\x83\xc2\xa8', b'\xc3\xa8'),
    (b'\xc3\x83\xc2\xaa', b'\xc3\xaa'),
    (b'\xc3\x83\xc2\xab', b'\xc3\xab'),
    (b'\xc3\x83\xc2\xad', b'\xc3\xad'),
    (b'\xc3\x83\xc2\xac', b'\xc3\xac'),
    (b'\xc3\x83\xc2\xaf', b'\xc3\xaf'),
    (b'\xc3\x83\xc2\xb3', b'\xc3\xb3'),
    (b'\xc3\x83\xc2\xb2', b'\xc3\xb2'),
    (b'\xc3\x83\xc2\xb4', b'\xc3\xb4'),
    (b'\xc3\x83\xc2\xb5', b'\xc3\xb5'),
    (b'\xc3\x83\xc2\xba', b'\xc3\xba'),
    (b'\xc3\x83\xc2\xb9', b'\xc3\xb9'),
    (b'\xc3\x83\xc2\xbc', b'\xc3\xbc'),
    (b'\xc3\x82\xc2\xba', b'\xc2\xba'),
    (b'\xc3\x82\xc2\xaa', b'\xc2\xaa'),
]

count = 0
for dirpath, _, filenames in os.walk('.'):
    for fn in filenames:
        if not (fn.endswith('.jsx') or fn.endswith('.js')):
            continue
        path = os.path.join(dirpath, fn)
        with open(path, 'rb') as f:
            data = f.read()
        original = data
        for bad, good in fixes:
            data = data.replace(bad, good)
        if data != original:
            with open(path, 'wb') as f:
                f.write(data)
            count += 1
            print(f'Fixed: {path}')
print(f'Total fixed: {count}')
