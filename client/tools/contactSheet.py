"""Draw every mapped atlas rect with its name. Used by npm run tileset."""

import json
import sys
from PIL import Image, ImageDraw

frames_path, out_path, sheet_path = sys.argv[1], sys.argv[2], sys.argv[3]
frames = json.loads(open(frames_path).read())
sheet = Image.open(sheet_path).convert('RGBA')
cell = 96
cols = 8
rows = (len(frames) + cols - 1) // cols
img = Image.new('RGB', (cols * cell, rows * cell), (28, 24, 32))
draw = ImageDraw.Draw(img)
for i, frame in enumerate(frames):
    cx = (i % cols) * cell
    cy = (i // cols) * cell
    draw.rectangle([cx, cy, cx + cell - 1, cy + cell - 1], outline=(80, 70, 60))
    crop = sheet.crop((frame['x'], frame['y'], frame['x'] + frame['w'], frame['y'] + frame['h']))
    fit = min(72 / max(crop.width, 1), 64 / max(crop.height, 1), 4)
    sized = crop.resize((max(1, int(crop.width * fit)), max(1, int(crop.height * fit))), Image.NEAREST)
    img.paste(sized, (cx + 4, cy + 4), sized)
    draw.text((cx + 4, cy + cell - 14), frame['name'][:16], fill=(255, 230, 160))
img.save(out_path)
print('wrote', out_path, len(frames), 'frames')
