"""Regenerate this model's first-party analytic image maps; requires Pillow.
Run with an isolated Python/venv that already has Pillow installed:
python -I model-source/generate-materials.py
No original images, network or private capture input is used.
"""
import hashlib
import io
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw

def sha(data):
    return hashlib.sha256(data).hexdigest()

def procedural_image(name, size=(256, 256)):
    """Original analytic patterns, independent of photographs, logos or private data."""
    w, h = size
    seed = int(sha(name.encode())[:8], 16)
    normal = '_nor.' in name or '-nor.' in name
    rough = '_rough.' in name or '-bump.' in name
    pixels = bytearray()
    fabric = any(word in name for word in ['weave', 'linen', 'wool', 'carpet', 'throw', 'lace'])
    wood = any(word in name for word in ['wood', 'oak', 'laminate', 'drawer', 'inlay'])
    marble = 'marble' in name
    tuft = 'tuft' in name
    base = (174, 146, 114) if wood else (222, 216, 202) if tuft else (210, 207, 198) if fabric else (228, 225, 215) if marble else (205, 196, 174)
    for y in range(h):
        for x in range(w):
            noise = (((x * 73856093) ^ (y * 19349663) ^ seed) & 255) / 255 - 0.5
            wave = math.sin(x / 9 + math.sin(y / 27)) * 2 if wood else math.sin(x / 22 + y / 39) * 2 if marble else 0
            weave = (2 if (x // 2 + y // 2) % 2 else -2) if fabric else 0
            quilt = (math.cos(x * math.pi / 32) * math.cos(y * math.pi / 32)) if tuft else 0
            if normal:
                value = (int(128 + (math.sin(x / 4) if fabric else quilt) * 4), int(128 + (math.sin(y / 4) if fabric else quilt) * 4), 254)
            elif rough:
                v = max(0, min(255, int((205 if fabric else 170) + noise * 8 + quilt * 20)))
                value = (v, v, v)
            else:
                variation = noise * 5 + wave + weave + quilt * 8
                value = tuple(max(0, min(255, int(channel + variation))) for channel in base)
            pixels.extend(value)
    image = Image.frombytes('RGB', size, bytes(pixels))
    draw = ImageDraw.Draw(image)
    if name == 'lounge-whiteboard.jpg':
        image.paste((242, 241, 235), (0, 0, w, h))
        draw.rectangle((8, 8, w - 9, h - 9), outline=(140, 145, 140), width=3)
        draw.text((22, 22), 'PUBLIC DEMO', fill=(80, 90, 90))
        for line in range(4):
            draw.line((24, 70 + line * 27, w - 30, 70 + line * 27), fill=(193, 199, 194), width=2)
    elif name == 'public-notebook.png':
        image.paste((246, 244, 235), (0, 0, w, h))
        for y in range(45, h, 24):
            draw.line((20, y, w - 15, y), fill=(187, 203, 216), width=1)
        draw.line((45, 0, 45, h), fill=(213, 165, 156), width=2)
        draw.text((65, 22), 'PUBLIC DEMO', fill=(100, 105, 110))
    elif name in {'public-label.png', 'public-box.png'}:
        image.paste((224, 218, 199), (0, 0, w, h))
        for y in range(0, h, 32):
            for x in range(0, w, 32):
                if (x // 32 + y // 32) % 2:
                    draw.rectangle((x + 7, y + 7, x + 23, y + 23), outline=(156, 161, 146), width=2)
        draw.rectangle((15, h // 3, w - 15, h // 3 + 42), fill=(243, 240, 226))
        draw.text((24, h // 3 + 15), 'PUBLIC DEMO', fill=(89, 96, 91))
    elif 'register' in name:
        image.paste((44, 47, 45), (0, 0, w, h))
        for x in range(12, w, 20):
            draw.line((x, 12, x, h - 12), fill=(183, 164, 109), width=5)
    elif 'crest' in name:
        image.paste((112, 90, 65), (0, 0, w, h))
        for offset in range(15, min(w, h) // 2, 16):
            draw.arc((offset, offset, w - offset, h - offset), 180, 360, fill=(192, 177, 134), width=3)
    elif name == 'prayer-rug.jpg':
        image.paste((77, 92, 74), (0, 0, w, h))
        for inset in [9, 18, 27]:
            draw.rectangle((inset, inset, w - inset, h - inset), outline=(184, 174, 134), width=3)
        for y in range(55, h - 40, 35):
            for x in range(55, w - 40, 35):
                draw.polygon([(x, y - 8), (x + 8, y), (x, y + 8), (x - 8, y)], outline=(161, 167, 132))
    elif name == 'hall-far.jpg':
        image.paste((217, 214, 203), (0, 0, w, h))
        draw.rectangle((w // 4, h // 5, w * 3 // 4, h * 4 // 5), outline=(185, 181, 167), width=4)
        draw.text((w // 4 + 12, h // 2), 'PUBLIC DEMO', fill=(100, 105, 100))
    return image


if __name__ == '__main__':
    root = Path(__file__).resolve().parent
    report = json.loads((root / 'PUBLIC-MODEL-PROVENANCE.json').read_bytes())
    sizes = {'public-notebook.png': (384, 512), 'public-label.png': (192, 256), 'public-box.png': (256, 256)}
    for asset in report['proceduralAssets']:
        target = (root / asset['path']).resolve()
        if root not in target.parents or target.suffix not in {'.jpg', '.png'}:
            raise ValueError('Invalid model image destination')
        buffer = io.BytesIO()
        image = procedural_image(target.name, sizes.get(target.name, (256, 256)))
        if target.suffix == '.png':
            image.save(buffer, format='PNG', optimize=False)
        else:
            image.save(buffer, format='JPEG', quality=92, subsampling=0, optimize=False)
        data = buffer.getvalue()
        if sha(data) != asset['sha256']:
            raise ValueError('Image encoder version differs from the reviewed asset bytes')
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    print('Reviewed procedural image bytes regenerated without original image input.')
