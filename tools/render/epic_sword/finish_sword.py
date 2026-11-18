"""Pixel-finish the sword renders into the title-screen frames. Does not touch the knight."""

import os
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "out")
MENU_DIR = os.path.normpath(os.path.join(ROOT, "..", "..", "..", "client", "public", "images", "animatedSword"))
OUTLINE = (19, 22, 38, 255)
CANVAS = (1536, 1024)
MENU_CENTER = (768, 500)
PIXEL = 4


def outline(image):
    width, height = image.size
    src = image.load()
    out = image.copy()
    dst = out.load()
    for y in range(height):
        for x in range(width):
            if src[x, y][3] > 40:
                continue
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < width and 0 <= yy < height and src[xx, yy][3] > 110:
                        dst[x, y] = OUTLINE
                        break
    return out


def pixelate(path):
    image = Image.open(path).convert("RGBA")
    small = image.resize((image.width // PIXEL, image.height // PIXEL), Image.BOX)
    return outline(small)


def place_locked(frames):
    """One crop window for every frame, so the blade stays on the same pixels."""
    union = None
    for frame in frames:
        box = frame.getbbox()
        if box is None:
            continue
        union = box if union is None else (
            min(union[0], box[0]),
            min(union[1], box[1]),
            max(union[2], box[2]),
            max(union[3], box[3]),
        )
    pad = 4
    left = max(0, union[0] - pad)
    top = max(0, union[1] - pad)
    right = min(frames[0].width, union[2] + pad)
    bottom = min(frames[0].height, union[3] + pad)
    crop = (left, top, right, bottom)
    placed = []
    for frame in frames:
        sprite = frame.crop(crop)
        scale = 6
        big = sprite.resize((sprite.width * scale, sprite.height * scale), Image.NEAREST)
        fit_w, fit_h = 1100, 980
        ratio = min(fit_w / big.width, fit_h / big.height, 1.0)
        if ratio < 1.0:
            big = big.resize((max(1, int(big.width * ratio)), max(1, int(big.height * ratio))), Image.NEAREST)
        canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
        x = MENU_CENTER[0] - big.width // 2
        y = MENU_CENTER[1] - big.height // 2
        canvas.paste(big, (x, y), big)
        placed.append(canvas)
    return placed


def main():
    paths = [os.path.join(OUT, f"raw_{i:02d}.png") for i in range(12)]
    missing = [path for path in paths if not os.path.exists(path)]
    if missing:
        raise SystemExit("missing renders: " + ", ".join(os.path.basename(p) for p in missing))
    frames = place_locked([pixelate(path) for path in paths])
    order = list(range(len(frames))) + list(range(len(frames) - 2, 0, -1))
    os.makedirs(MENU_DIR, exist_ok=True)
    for index, frame_index in enumerate(order, start=1):
        frames[frame_index].save(os.path.join(MENU_DIR, f"animatedSword{index}.png"))
    print("wrote", len(order), "frames to", MENU_DIR)


if __name__ == "__main__":
    main()
