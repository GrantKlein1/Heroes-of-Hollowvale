"""Bake terrain, props, hero frames, enemies, and interiors from the Zelda-like pack.

Tile indices are the contract in client/src/game/world/tileCatalog.js.
Object rectangles come from atlas.json (already alpha-trimmed). New art is
drawn here and saved under authored/ as PNG plus a one-frame .aseprite.

Nothing in this file guesses a source rectangle: atlas entries are copied
by name, character frames are the 16×32 grid the sheet is laid out on.
"""

import json
import struct
import zlib
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
GFX = ROOT / 'gfx'
AUTHORED = ROOT / 'authored'
SPRITES = ROOT / 'sprites'
ENEMIES = ROOT / 'enemies'
MAPS = ROOT.parent
ATLAS = json.loads((ROOT / 'atlas.json').read_text())

# Keep in lockstep with tileCatalog.js TERRAIN / PIECES.
PIECES = ['nw', 'n', 'ne', 'w', 'c', 'e', 'sw', 's', 'se', 'inw', 'ine', 'isw', 'ise']
SAND = {
    'nw': 'sand_nw', 'n': 'sand_n', 'ne': 'sand_ne', 'w': 'sand_w', 'c': 'sand_c',
    'e': 'sand_e', 'sw': 'sand_sw', 's': 'sand_s', 'se': 'sand_se',
    'inw': 'sand_inner_nw', 'ine': 'sand_inner_ne', 'isw': 'sand_inner_sw', 'ise': 'sand_inner_se',
}
WATER = {
    'nw': 'water_nw', 'n': 'water_n', 'ne': 'water_ne', 'w': 'water_w', 'c': 'water_c',
    'e': 'water_e', 'sw': 'water_sw', 's': 'water_s', 'se': 'water_se',
    'inw': 'water_inner_nw', 'ine': 'water_inner_ne', 'isw': 'water_inner_sw', 'ise': 'water_inner_se',
}
COLS = 16
ROWS = 3


def load_sheets():
    sheets = {}
    for name in ('Overworld.png', 'Inner.png', 'character.png', 'objects.png', 'cave.png', 'log.png'):
        sheets[name] = Image.open(GFX / name).convert('RGBA')
    return sheets


def crop_named(sheets, name):
    spec = ATLAS[name]
    x, y, w, h = spec['rect']
    return sheets[spec['sheet']].crop((x, y, x + w, y + h)).convert('RGBA')


def is_grass(r, g, b, a):
    # Pack grass is a low-red green. Sand is a bright yellow-green (r around 160)
    # and must stay eligible for the dirt and cobble recolors.
    return a > 200 and r < 110 and g > 140 and g > r + 30 and g > b


def recolor_dirt(im, ruts=False):
    out = im.copy()
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 16 or is_grass(r, g, b, a):
                continue
            nr = min(255, int(r * 0.42 + 62))
            ng = min(255, int(g * 0.22 + 36))
            nb = min(255, int(b * 0.18 + 12))
            # Wheel ruts run along a north-south track, and only on the center
            # piece, so tile edges do not pick up a shared horizontal stripe.
            if ruts and x in (6, 7, 8):
                nr = max(0, nr - 36)
                ng = max(0, ng - 26)
                nb = max(0, nb - 14)
            px[x, y] = (nr, ng, nb, a)
    return out


def recolor_cobble(im):
    out = im.copy()
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 16 or is_grass(r, g, b, a):
                continue
            lum = (r * 3 + g * 5 + b * 2) // 10
            stone = 108 + lum // 5
            px[x, y] = (stone, stone - 4, stone - 8, a)
    return out


def speckle_deep(im):
    out = im.copy()
    px = out.load()
    r, g, b, a = px[4, 4]
    px[3, 5] = (max(0, r - 18), max(0, g - 14), min(255, b + 8), a)
    px[11, 10] = (max(0, r - 24), max(0, g - 16), b, a)
    px[7, 12] = (min(255, r + 10), min(255, g + 12), min(255, b + 16), a)
    return out


def ensure_variation(im):
    """A mapped frame must not be a single flat color."""
    px = im.load()
    colors = set()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            p = px[x, y]
            if p[3] > 20:
                colors.add(p[:3])
    if len(colors) >= 2:
        return im
    out = im.copy()
    op = out.load()
    r, g, b, a = op[0, 0]
    op[2, 3] = (max(0, r - 18), max(0, g - 14), min(255, b + 12), 255)
    op[12, 11] = (min(255, r + 14), min(255, g + 10), min(255, b + 8), 255)
    return out


def paste_tile(sheet, tile, index):
    tile = tile.resize((16, 16), Image.NEAREST) if tile.size != (16, 16) else tile
    tile = ensure_variation(tile)
    col = index % COLS
    row = index // COLS
    sheet.alpha_composite(tile, (col * 16, row * 16))


def sample_palette(im):
    colors = []
    px = im.load()
    w, h = im.size
    for y in range(0, h, 3):
        for x in range(0, w, 3):
            p = px[x, y]
            if p[3] > 200:
                colors.append(p[:3])
    return colors or [(90, 70, 40)]


def nearest(colors, target):
    tr, tg, tb = target
    best = colors[0]
    bestd = 1e9
    for r, g, b in colors:
        d = (r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2
        if d < bestd:
            bestd = d
            best = (r, g, b)
    return best


def build_terrain(sheets):
    grass = crop_named(sheets, 'grass')
    sheet = Image.new('RGBA', (COLS * 16, ROWS * 16), (0, 0, 0, 0))
    paste_tile(sheet, grass, 0)
    paste_tile(sheet, crop_named(sheets, 'grass_detail1'), 1)
    paste_tile(sheet, crop_named(sheets, 'grass_detail2'), 2)
    for i, name in enumerate(PIECES):
        sand = crop_named(sheets, SAND[name])
        paste_tile(sheet, recolor_dirt(sand, name == 'c'), 3 + i)
        paste_tile(sheet, recolor_cobble(sand), 16 + i)
        paste_tile(sheet, crop_named(sheets, WATER[name]), 29 + i)
    paste_tile(sheet, speckle_deep(crop_named(sheets, 'water_deep')), 42)
    wood = sample_palette(crop_named(sheets, 'house'))
    bush = sample_palette(crop_named(sheets, 'bush'))
    paste_tile(sheet, draw_wall(wood), 43)
    paste_tile(sheet, draw_thicket(bush), 44)
    ford = crop_named(sheets, 'water_c').copy()
    plank = nearest(wood, (140, 90, 40))
    fp = ford.load()
    for x in range(2, 14):
        fp[x, 7] = plank + (255,)
        fp[x, 8] = tuple(max(0, c - 30) for c in plank) + (255,)
    paste_tile(sheet, ford, 45)
    paste_tile(sheet, grass, 46)
    paste_tile(sheet, grass, 47)
    return sheet


def draw_wall(wood):
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    px = im.load()
    dark = nearest(wood, (60, 36, 18))
    mid = nearest(wood, (120, 74, 36))
    lite = nearest(wood, (168, 116, 62))
    for x in range(16):
        col = dark if x % 4 == 0 else mid if x % 4 == 1 else lite if x % 4 == 2 else mid
        shade = dark if x % 4 == 3 else col
        for y in range(16):
            c = shade if y % 5 == 4 else col
            px[x, y] = c + (255,)
    return im


def draw_thicket(greens):
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    px = im.load()
    a = nearest(greens, (40, 110, 36))
    b = nearest(greens, (24, 78, 28))
    c = nearest(greens, (70, 150, 48))
    for y in range(16):
        for x in range(16):
            n = (x * 13 + y * 7) % 5
            col = c if n == 0 else a if n < 3 else b
            px[x, y] = col + (255,)
    return im


def cottage_from(house):
    im = house.copy()
    px = im.load()
    w, h = im.size
    roof_cut = int(h * 0.46)
    plaster = (214, 196, 168, 255)
    timber = (92, 56, 32, 255)
    timber_dk = (54, 32, 18, 255)
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 20 or y < roof_cut:
                continue
            if r + g + b < 150:
                continue
            if g > r + 10 and g > 80:
                continue
            beam = (x % 16 < 2) or (x > w - 3) or (x < 2) or ((y - roof_cut) % 14 < 2)
            px[x, y] = timber_dk if beam and (x + y) % 2 == 0 else timber if beam else plaster
    return im


def draw_well(rock_colors, wood):
    im = Image.new('RGBA', (16, 18), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    stone = nearest(rock_colors, (140, 140, 132))
    dark = nearest(rock_colors, (70, 68, 64))
    woodc = nearest(wood, (120, 78, 40))
    d.ellipse((2, 6, 13, 16), fill=stone + (255,))
    d.ellipse((4, 8, 11, 14), fill=(24, 26, 34, 255))
    d.rectangle((3, 4, 12, 6), fill=woodc + (255,))
    d.line((3, 2, 8, 5), fill=woodc + (255,))
    d.line((12, 2, 8, 5), fill=dark + (255,))
    d.point((5, 11), fill=(180, 190, 200, 255))
    return im


def draw_log(wood):
    im = Image.new('RGBA', (16, 10), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    mid = nearest(wood, (130, 84, 42))
    dark = nearest(wood, (70, 42, 22))
    d.rounded_rectangle((0, 2, 15, 8), radius=2, fill=mid + (255,))
    d.line((2, 4, 13, 4), fill=dark + (255,))
    d.point((1, 5), fill=dark + (255,))
    return im


def draw_cart(wood):
    im = Image.new('RGBA', (16, 14), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    bed = nearest(wood, (150, 96, 48))
    dark = nearest(wood, (60, 36, 18))
    d.rectangle((1, 3, 14, 8), fill=bed + (255,))
    d.rectangle((2, 4, 13, 7), fill=tuple(min(255, c + 24) for c in bed) + (255,))
    d.ellipse((2, 8, 6, 12), fill=dark + (255,))
    d.ellipse((9, 8, 13, 12), fill=dark + (255,))
    return im


def draw_hay():
    im = Image.new('RGBA', (14, 10), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((1, 3, 12, 9), fill=(196, 164, 54, 255))
    d.line((3, 5, 10, 6), fill=(150, 110, 30, 255))
    d.line((4, 7, 11, 6), fill=(220, 190, 80, 255))
    return im


def draw_lamp(wood):
    im = Image.new('RGBA', (8, 14), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    post = nearest(wood, (90, 58, 30))
    d.rectangle((3, 4, 4, 13), fill=post + (255,))
    d.rectangle((1, 1, 6, 5), fill=(230, 186, 70, 255))
    d.point((3, 3), fill=(255, 240, 180, 255))
    return im


def draw_sign(wood):
    im = Image.new('RGBA', (14, 14), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    post = nearest(wood, (100, 64, 32))
    board = nearest(wood, (168, 124, 70))
    d.rectangle((6, 6, 7, 13), fill=post + (255,))
    d.rectangle((1, 1, 12, 7), fill=board + (255,))
    d.line((3, 3, 10, 3), fill=post + (255,))
    d.line((3, 5, 9, 5), fill=post + (255,))
    return im


def draw_board(wood):
    im = Image.new('RGBA', (16, 14), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    post = nearest(wood, (80, 50, 26))
    board = nearest(wood, (150, 110, 64))
    d.rectangle((1, 12, 3, 13), fill=post + (255,))
    d.rectangle((12, 12, 14, 13), fill=post + (255,))
    d.rectangle((0, 1, 15, 11), fill=board + (255,))
    d.line((2, 4, 13, 4), fill=post + (255,))
    d.line((2, 7, 12, 7), fill=post + (255,))
    return im


def draw_milestone(rock):
    im = Image.new('RGBA', (12, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    stone = nearest(rock, (150, 148, 140))
    dark = nearest(rock, (70, 68, 64))
    d.polygon([(6, 0), (11, 4), (10, 15), (2, 15), (1, 4)], fill=stone + (255,))
    d.line((4, 6, 8, 7), fill=dark + (255,))
    d.line((4, 9, 8, 9), fill=dark + (255,))
    return im


def draw_campfire():
    im = Image.new('RGBA', (14, 14), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((1, 8, 12, 13), fill=(90, 70, 50, 255))
    d.polygon([(7, 1), (10, 8), (4, 8)], fill=(230, 120, 30, 255))
    d.polygon([(7, 3), (9, 8), (5, 8)], fill=(255, 210, 80, 255))
    d.point((3, 11), fill=(120, 120, 116, 255))
    d.point((10, 10), fill=(100, 100, 96, 255))
    return im


def draw_tent():
    im = Image.new('RGBA', (32, 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cloth = (142, 92, 58, 255)
    dark = (78, 46, 28, 255)
    d.polygon([(1, 22), (16, 2), (31, 22)], fill=cloth)
    d.polygon([(16, 6), (22, 22), (10, 22)], fill=(40, 28, 22, 255))
    d.line((16, 2, 16, 22), fill=dark)
    d.line((4, 18, 28, 18), fill=dark)
    return im


def draw_ring(rock):
    im = Image.new('RGBA', (48, 28), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    stone = nearest(rock, (130, 128, 120))
    dark = nearest(rock, (60, 58, 54))
    for i, x in enumerate(range(4, 44, 8)):
        h = 8 + (i % 3)
        d.ellipse((x, 16 - h, x + 7, 24), fill=stone + (255,))
        d.arc((x, 16 - h, x + 7, 24), 200, 20, fill=dark + (255,))
    return im


def draw_satchel():
    im = Image.new('RGBA', (12, 12), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((2, 3, 10, 11), radius=2, fill=(120, 72, 36, 255))
    d.arc((3, 1, 9, 6), 200, 340, fill=(70, 42, 22, 255))
    return im


def draw_herb():
    im = Image.new('RGBA', (12, 12), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.line((6, 11, 6, 4), fill=(40, 110, 40, 255))
    d.ellipse((2, 2, 7, 7), fill=(70, 160, 60, 255))
    d.ellipse((6, 3, 11, 8), fill=(90, 170, 50, 255))
    return im


def draw_cache(wood):
    im = Image.new('RGBA', (14, 12), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    bed = nearest(wood, (140, 90, 46))
    d.rectangle((1, 3, 12, 11), fill=bed + (255,))
    d.rectangle((1, 3, 12, 6), fill=tuple(min(255, c + 30) for c in bed) + (255,))
    d.point((6, 8), fill=(40, 28, 16, 255))
    return im


def draw_offering():
    im = Image.new('RGBA', (12, 12), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((2, 4, 10, 11), fill=(150, 148, 140, 255))
    d.polygon([(6, 1), (8, 5), (4, 5)], fill=(40, 160, 70, 255))
    return im


def draw_mushroom():
    im = Image.new('RGBA', (10, 10), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((4, 5, 6, 9), fill=(230, 220, 200, 255))
    d.ellipse((1, 2, 8, 7), fill=(180, 48, 40, 255))
    d.point((3, 4), fill=(240, 220, 180, 255))
    return im


def humanoid(kind, frame, facing):
    """16×16 walk frame. facing: 0 down, 1 left, 2 up, 3 right. frame 0 or 1."""
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    px = im.load()
    bob = 1 if frame else 0
    step = frame

    def dot(x, y, c):
        if facing == 1:
            x = 15 - x
        elif facing == 3:
            x = x
        y += bob
        if 0 <= x < 16 and 0 <= y < 16:
            px[x, y] = c

    def fill(x0, y0, x1, y1, c):
        for y in range(y0, y1):
            for x in range(x0, x1):
                dot(x, y, c)

    if kind == 'bandit':
        cloth = (150, 48, 42, 255)
        hood = (72, 48, 40, 255)
        skin = (214, 164, 122, 255)
        fill(5, 2, 11, 6, hood)
        fill(6, 6, 10, 8, skin)
        if facing != 2:
            dot(7, 6, (30, 24, 28, 255))
            dot(9, 6, (30, 24, 28, 255))
        fill(5, 8, 11, 13, cloth)
        fill(6, 13, 8, 15, (40, 28, 24, 255))
        fill(9, 13, 11, 15, (40, 28, 24, 255))
        if step:
            fill(6, 13, 8, 14, (40, 28, 24, 255))
            fill(9, 14, 11, 16, (40, 28, 24, 255))
    else:
        skin = (168, 196, 86, 255) if kind != 'brute' else (96, 130, 48, 255)
        dark = (40, 70, 24, 255)
        cloth = (120, 72, 36, 255)
        wide = 1 if kind == 'brute' else 0
        fill(5 - wide, 2, 11 + wide, 7, skin)
        if facing != 2:
            dot(6, 4, dark)
            dot(9, 4, dark)
        if kind == 'archer' and facing != 2:
            fill(11, 6, 14, 7, (90, 60, 30, 255))
        fill(5 - wide, 7, 11 + wide, 12, cloth if kind != 'brute' else (70, 48, 28, 255))
        fill(6, 12, 8, 15, dark)
        fill(9, 12, 11, 15, dark)
        if kind == 'brute':
            fill(3, 8, 5, 12, skin)
            fill(11, 8, 13, 12, skin)
        if step:
            fill(6, 12, 8, 14, dark)
            fill(9, 13, 11, 16, dark)
    return im


def enemy_sheet(kind):
    sheet = Image.new('RGBA', (32, 64), (0, 0, 0, 0))
    for facing in range(4):
        for frame in range(2):
            sheet.alpha_composite(humanoid(kind, frame, facing), (frame * 16, facing * 16))
    return sheet


def hero_sheet(sheets):
    src = sheets['character.png']
    # Walk rows are the first four 32px bands, columns 0-3 (measured grid).
    # Attack poses are band 4, one column per facing, same order.
    sheet = Image.new('RGBA', (16 * 4, 32 * 5), (0, 0, 0, 0))
    for row in range(4):
        for col in range(4):
            frame = src.crop((col * 16, row * 32, col * 16 + 16, row * 32 + 32))
            sheet.alpha_composite(frame, (col * 16, row * 32))
    for col in range(4):
        frame = src.crop((col * 16, 4 * 32, col * 16 + 16, 5 * 32))
        sheet.alpha_composite(frame, (col * 16, 4 * 32))
    return sheet


def widen_bridge(bridge, width):
    w, h = bridge.size
    if width <= w:
        return bridge
    left_w = 8
    right_w = 8
    mid = bridge.crop((left_w, 0, w - right_w, h))
    out = Image.new('RGBA', (width, h), (0, 0, 0, 0))
    out.alpha_composite(bridge.crop((0, 0, left_w, h)), (0, 0))
    x = left_w
    while x < width - right_w:
        out.alpha_composite(mid, (x, 0))
        x += mid.size[0]
    out.alpha_composite(bridge.crop((w - right_w, 0, w, h)), (width - right_w, 0))
    return out


def interior(sheets, kind):
    inner = sheets['Inner.png']
    # One plank column from Inner.png, repeated, so the floor has no seam line.
    column = [inner.getpixel((116, 204 + y)) for y in range(16)]
    floor = Image.new('RGBA', (16, 16), (0, 0, 0, 255))
    fp = floor.load()
    for y in range(16):
        for x in range(16):
            fp[x, y] = column[y]
    wall = inner.crop((8 * 16, 2 * 16, 9 * 16, 3 * 16))
    im = Image.new('RGBA', (320, 192), (0, 0, 0, 255))
    for ty in range(12):
        for tx in range(20):
            im.alpha_composite(floor, (tx * 16, ty * 16))
    for tx in range(20):
        im.alpha_composite(wall, (tx * 16, 0))
        im.alpha_composite(wall, (tx * 16, 16))
        if tx not in (9, 10):
            im.alpha_composite(wall, (tx * 16, 11 * 16))
    for ty in range(2, 11):
        im.alpha_composite(wall, (0, ty * 16))
        im.alpha_composite(wall, (19 * 16, ty * 16))
    # Counter and hearth are grid-aligned crops from Inner.png (rows measured
    # by the opaque-cell map, not guessed offsets).
    # Shelves and the hearth are grid crops from Inner.png. The bar is the
    # same plank column, darkened, so it stays in the pack palette.
    shelves = inner.crop((2 * 16, 12 * 16, 6 * 16, 15 * 16))
    hearth = inner.crop((160, 184, 200, 216))
    bar = floor.copy()
    bp = bar.load()
    for y in range(16):
        for x in range(16):
            r, g, b, a = bp[x, y]
            bp[x, y] = (max(0, r - 40), max(0, g - 36), max(0, b - 28), a)
    if kind == 'tavern':
        for tx in range(4, 15):
            im.alpha_composite(bar, (tx * 16, 4 * 16))
        im.alpha_composite(hearth, (24, 128))
        barrel = crop_named(sheets, 'barrel')
        im.alpha_composite(barrel, (250, 130))
        im.alpha_composite(barrel, (270, 136))
    else:
        im.alpha_composite(shelves, (32, 32))
        im.alpha_composite(shelves, (224, 32))
        for tx in range(6, 14):
            im.alpha_composite(bar, (tx * 16, 5 * 16))
        crate = crop_named(sheets, 'crate')
        im.alpha_composite(crate, (40, 120))
        im.alpha_composite(crate, (250, 120))
    return im


def opaque_box(im, x0, y0, x1, y1):
    px = im.load()
    minx, miny, maxx, maxy = im.size[0], im.size[1], -1, -1
    for y in range(max(0, y0), min(im.size[1], y1)):
        for x in range(max(0, x0), min(im.size[0], x1)):
            if px[x, y][3] < 24:
                continue
            minx = min(minx, x)
            miny = min(miny, y)
            maxx = max(maxx, x)
            maxy = max(maxy, y)
    if maxx < 0:
        return None
    return (minx, miny, maxx - minx + 1, maxy - miny + 1)


def tile_local(im, mode):
    w, h = im.size
    if mode == 'none':
        return None
    if mode == 'trunk':
        box = opaque_box(im, w // 2 - 5, h - 10, w // 2 + 5, h)
    elif mode == 'base':
        box = opaque_box(im, 0, int(h * 0.55), w, h)
    else:
        box = opaque_box(im, 0, 0, w, h)
    if not box:
        return None
    return {
        'x': int(8 - w / 2 + box[0]),
        'y': int(16 - h + box[1]),
        'w': int(box[2]),
        'h': int(box[3]),
    }


def write_ase(path, im):
    """One-frame RGBA Aseprite file (spec 1.3) so the authored sprite stays editable."""
    im = im.convert('RGBA')
    w, h = im.size
    raw = im.tobytes()
    # Cel: layer, x, y, opacity, type 0 (raw), 7 reserved bytes, then pixels.
    cel_data = struct.pack('<HhhBH', 0, 0, 0, 255, 0) + b'\x00' * 7 + raw
    cel = struct.pack('<IH', 6 + len(cel_data), 0x2005) + cel_data
    name = b'authored'
    layer_data = struct.pack('<HHHHHHB', 0, 0, 0, 0, 0, 0, 255) + b'\x00' * 3
    layer_data += struct.pack('<H', len(name)) + name
    layer = struct.pack('<IH', 6 + len(layer_data), 0x2004) + layer_data
    chunks = layer + cel
    # Frame header is 16 bytes: size, magic, old chunk count, duration, reserved, new chunk count.
    frame = struct.pack('<IHHHBBI', 16 + len(chunks), 0xF1FA, 2, 100, 0, 0, 2) + chunks
    header = bytearray(128)
    struct.pack_into('<IHHHHI', header, 0, 128 + len(frame), 0xA5E0, 1, w, h, 32)
    struct.pack_into('<I', header, 14, 1)  # flags: use the new chunk count
    struct.pack_into('<H', header, 18, 100)
    struct.pack_into('<BB', header, 34, 1, 1)
    struct.pack_into('<HH', header, 40, 16, 16)
    path.write_bytes(bytes(header) + frame)
    zlib.crc32(raw[:1])


def contact(terrain, sprites):
    labels = []
    sheet = Image.new('RGBA', (1400, 1600), (48, 48, 56, 255))
    draw = ImageDraw.Draw(sheet)
    x, y, rowh = 8, 8, 0
    names = [
        'grass', 'grass_detail1', 'grass_detail2',
    ] + [f'dirt_{n}' for n in PIECES] + [f'cobble_{n}' for n in PIECES] + [f'water_{n}' for n in PIECES] + [
        'water_deep', 'wall', 'thicket', 'ford',
    ]
    for i, name in enumerate(names):
        tile = terrain.crop(((i % COLS) * 16, (i // COLS) * 16, (i % COLS) * 16 + 16, (i // COLS) * 16 + 16))
        big = tile.resize((64, 64), Image.NEAREST)
        if x + 80 > 1380:
            x = 8
            y += rowh + 22
            rowh = 0
        sheet.alpha_composite(big, (x, y))
        draw.rectangle((x - 1, y - 1, x + 64, y + 64), outline=(255, 220, 0, 255))
        draw.text((x, y + 66), name, fill=(255, 255, 255, 255))
        x += 88
        rowh = max(rowh, 64)
        labels.append(name)
    y += rowh + 28
    x, rowh = 8, 0
    for name, im in sprites:
        big = im.resize((im.size[0] * 3, im.size[1] * 3), Image.NEAREST)
        if x + big.size[0] + 16 > 1380:
            x = 8
            y += rowh + 22
            rowh = 0
        sheet.alpha_composite(big, (x, y))
        draw.rectangle((x - 1, y - 1, x + big.size[0], y + big.size[1]), outline=(255, 220, 0, 255))
        draw.text((x, y + big.size[1] + 2), name, fill=(255, 255, 255, 255))
        x += big.size[0] + 16
        rowh = max(rowh, big.size[1])
    out = sheet.crop((0, 0, 1400, min(sheet.size[1], y + rowh + 28)))
    return out


def main():
    AUTHORED.mkdir(exist_ok=True)
    SPRITES.mkdir(exist_ok=True)
    ENEMIES.mkdir(exist_ok=True)
    sheets = load_sheets()
    terrain = build_terrain(sheets)
    terrain_path = MAPS / 'hollowvale.png'
    terrain.save(terrain_path)

    house = crop_named(sheets, 'house')
    cottage = cottage_from(house)
    rock_colors = sample_palette(crop_named(sheets, 'rock'))
    wood = sample_palette(house)
    bridge = crop_named(sheets, 'bridge_v')

    drawn = {
        'house': house,
        'cottage': cottage,
        'tree': crop_named(sheets, 'tree'),
        'bush': crop_named(sheets, 'bush'),
        'rock': crop_named(sheets, 'rock'),
        'flowers': crop_named(sheets, 'flowers'),
        'flowers_scatter': crop_named(sheets, 'flowers_scatter'),
        'crate': crop_named(sheets, 'crate'),
        'barrel': crop_named(sheets, 'barrel'),
        'fence_h': crop_named(sheets, 'fence_h'),
        'fence_post': crop_named(sheets, 'fence_post_v'),
        'well': draw_well(rock_colors, wood),
        'log': draw_log(wood),
        'cart': draw_cart(wood),
        'hay': draw_hay(),
        'lamp': draw_lamp(wood),
        'sign': draw_sign(wood),
        'board': draw_board(wood),
        'milestone': draw_milestone(rock_colors),
        'campfire': draw_campfire(),
        'tent': draw_tent(),
        'stone_ring': draw_ring(rock_colors),
        'satchel': draw_satchel(),
        'herb': draw_herb(),
        'cache': draw_cache(wood),
        'offering': draw_offering(),
        'mushroom': draw_mushroom(),
        'bridge1': bridge,
        'bridge2': widen_bridge(bridge, 32),
        'bridge3': widen_bridge(bridge, 48),
        'bridge4': widen_bridge(bridge, 64),
    }
    for name in ('cottage', 'well', 'log', 'cart', 'hay', 'lamp', 'sign', 'board', 'milestone',
                 'campfire', 'tent', 'stone_ring', 'satchel', 'herb', 'cache', 'offering', 'mushroom',
                 'bridge4', 'wall', 'thicket'):
        pass
    # Save editable sources for everything we authored (not straight atlas crops).
    authored_names = [
        'cottage', 'well', 'log', 'cart', 'hay', 'lamp', 'sign', 'board', 'milestone',
        'campfire', 'tent', 'stone_ring', 'satchel', 'herb', 'cache', 'offering', 'mushroom',
        'bridge2', 'bridge3', 'bridge4',
    ]
    wall = draw_wall(wood)
    thicket = draw_thicket(sample_palette(crop_named(sheets, 'bush')))
    extra = {'wall': wall, 'thicket': thicket, 'dirt_c': recolor_dirt(crop_named(sheets, 'sand_c')),
             'cobble_c': recolor_cobble(crop_named(sheets, 'sand_c'))}
    for name in authored_names:
        drawn[name].save(AUTHORED / f'{name}.png')
        write_ase(AUTHORED / f'{name}.aseprite', drawn[name])
    for name, im in extra.items():
        im.save(AUTHORED / f'{name}.png')
        write_ase(AUTHORED / f'{name}.aseprite', im)

    modes = {
        'tree': 'trunk', 'bush': 'base', 'rock': 'full', 'crate': 'full', 'barrel': 'base',
        'fence_h': 'full', 'fence': 'full', 'fence_post': 'full', 'well': 'full', 'log': 'full', 'cart': 'full',
        'hay': 'base', 'milestone': 'full', 'lamp': 'none', 'sign': 'none', 'board': 'none',
        'flower': 'none', 'mushroom': 'none', 'satchel': 'none', 'herb': 'none',
        'cache': 'none', 'offering': 'none', 'campfire': 'none',
    }
    # flower uses the flowers sprite
    file_for = {
        'tree': 'tree', 'bush': 'bush', 'rock': 'rock', 'flower': 'flowers', 'mushroom': 'mushroom',
        'crate': 'crate', 'barrel': 'barrel', 'fence': 'fence_h', 'fence_post': 'fence_post',
        'well': 'well', 'log': 'log', 'cart': 'cart', 'hay': 'hay', 'lamp': 'lamp',
        'sign': 'sign', 'board': 'board', 'milestone': 'milestone', 'campfire': 'campfire',
        'satchel': 'satchel', 'herb': 'herb', 'cache': 'cache', 'offering': 'offering',
        'tent': 'tent', 'stone_ring': 'stone_ring', 'house': 'house', 'cottage': 'cottage',
        'bridge1': 'bridge1', 'bridge2': 'bridge2', 'bridge3': 'bridge3', 'bridge4': 'bridge4',
    }
    manifest = {}
    for key, src_name in file_for.items():
        im = drawn[src_name]
        im.save(SPRITES / f'{key}.png')
        mode = modes.get(key, 'none')
        blocks = mode not in ('none',)
        manifest[key] = {
            'src': f'/maps/zelda-like/sprites/{key}.png',
            'w': im.size[0],
            'h': im.size[1],
            'blocks': blocks and key not in ('flower', 'mushroom'),
            'tall': key == 'tree',
            'collision': tile_local(im, mode) if key in modes else None,
            'prop': key in modes,
        }
    # flower/mushroom collision already none; blocks false
    manifest['flower']['blocks'] = False
    manifest['mushroom']['blocks'] = False
    # Stem measured on tree.png: dark pixels sit at the bottom center of the
    # 32px sprite (sprite x 13-18, y 24-31). Mapped into the anchor tile this
    # is a partial footprint that still covers the cell center so nothing
    # spawns in the trunk. The canopy above the cell has no collider.
    manifest['tree']['collision'] = {'x': 5, 'y': 8, 'w': 6, 'h': 8}
    tree_hit = manifest['tree']['collision']
    if not tree_hit or not (tree_hit['x'] <= 8 < tree_hit['x'] + tree_hit['w'] and tree_hit['y'] <= 8 < tree_hit['y'] + tree_hit['h']):
        raise SystemExit(f'tree trunk does not cover the cell center: {tree_hit}')

    text = '/** Generated by client/public/maps/zelda-like/bake.py. Do not edit by hand. */\n'
    text += 'export const SPRITES = ' + json.dumps(manifest, indent=2) + '\n'
    (ROOT.parents[2] / 'src/game/world/spriteManifest.js').write_text(text)

    hero = hero_sheet(sheets)
    hero.save(ROOT / 'hero.png')
    for kind in ('bandit', 'goblin', 'archer', 'brute'):
        sheet = enemy_sheet(kind)
        sheet.save(ENEMIES / f'{kind}.png')
        sheet.save(AUTHORED / f'{kind}.png')
        write_ase(AUTHORED / f'{kind}.aseprite', sheet)

    interior(sheets, 'tavern').save(MAPS / 'tavern-interior.png')
    interior(sheets, 'market').save(MAPS / 'market-interior.png')

    labeled = [(name, Image.open(SPRITES / f'{name}.png')) for name in file_for]
    labeled += [(f'enemy-{k}', Image.open(ENEMIES / f'{k}.png')) for k in ('bandit', 'goblin', 'archer', 'brute')]
    labeled.append(('hero', hero))
    contact(terrain, labeled).save(MAPS / 'atlas-contact.png')
    print('baked', terrain_path, 'sprites', len(manifest))


if __name__ == '__main__':
    main()
