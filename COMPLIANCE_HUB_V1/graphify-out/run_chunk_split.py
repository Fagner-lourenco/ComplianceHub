from pathlib import Path
import json

detect = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding='utf-8-sig'))
uncached = [f for files in detect['files'].values() for f in files]

# Separate images (each gets own chunk)
images = [f for f in uncached if Path(f).suffix.lower() in {'.png','.jpg','.jpeg','.webp','.gif','.svg'}]
non_images = [f for f in uncached if f not in images]

# Group non-images by directory
groups = {}
for f in non_images:
    d = str(Path(f).parent)
    groups.setdefault(d, []).append(f)

# Flatten into chunks of ~22, keeping groups together as much as possible
chunks = []
current = []
for d, files in sorted(groups.items()):
    for f in files:
        current.append(f)
        if len(current) >= 22:
            chunks.append(current)
            current = []
if current:
    chunks.append(current)

# Add image chunks
for img in images:
    chunks.append([img])

# Save chunk manifests
for i, chunk in enumerate(chunks):
    Path(f'graphify-out/.graphify_chunk_{i+1:02d}_files.txt').write_text('\n'.join(chunk))

print(f'Total uncached: {len(uncached)}')
print(f'Images: {len(images)}')
print(f'Chunks: {len(chunks)}')
for i, c in enumerate(chunks):
    print(f'Chunk {i+1}: {len(c)} files')
