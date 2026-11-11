"""Sprite pipeline: cut a 3-figure strip into cells, drop the flat grey
background, and (for previews) recolor skin + apply health tints.

Usage:
  python3 scripts/sprites/process.py cut STRIP.png OUT_PREFIX
      -> OUT_PREFIX_0.png OUT_PREFIX_1.png OUT_PREFIX_2.png (transparent, 512px tall)
  python3 scripts/sprites/process.py preview STRIP.png OUT.png
      -> grid: rows = skin tones, columns = healthy / normal / sick
"""
import colorsys
import sys

import numpy as np
from PIL import Image, ImageDraw

CELL_H = 400
BG_THRESH = 22  # max RGB distance from the sampled background colour

# Base skin in every generation is medium tan (#C68642); these are targets.
SKIN_TONES = {
    "pale": (232, 196, 170),
    "light": (224, 172, 138),
    "medium": (198, 134, 66),
    "brown": (141, 85, 36),
    "dark": (82, 52, 32),
}


def remove_background(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    w, h = img.size
    bg = np.array(img)[5:15, 5:15, :3].reshape(-1, 3).mean(axis=0)
    # Flood from the border, then clear leftover enclosed pockets of pure background.
    for x, y in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1)]:
        ImageDraw.floodfill(img, (x, y), (0, 0, 0, 0), thresh=BG_THRESH)
    a = np.array(img)
    dist = np.abs(a[:, :, :3].astype(int) - bg).sum(axis=2)
    a[(dist < 9) & (a[:, :, 3] > 0)] = (0, 0, 0, 0)
    # Peel the light anti-aliased fringe left around the outline.
    for _ in range(3):
        clear = a[:, :, 3] == 0
        edge = np.zeros_like(clear)
        edge[1:, :] |= clear[:-1, :]
        edge[:-1, :] |= clear[1:, :]
        edge[:, 1:] |= clear[:, :-1]
        edge[:, :-1] |= clear[:, 1:]
        dist = np.abs(a[:, :, :3].astype(int) - bg).sum(axis=2)
        a[edge & ~clear & (dist < 70)] = (0, 0, 0, 0)
    return Image.fromarray(a)


def cut_strip(path: str) -> list[Image.Image]:
    img = remove_background(Image.open(path))
    w, h = img.size
    cells = []
    for i in range(3):
        cell = img.crop((i * w // 3, 0, (i + 1) * w // 3, h))
        box = cell.getbbox()
        cells.append(cell.crop(box) if box else cell)
    # Same scale for all three so bodies stay comparable; feet on one baseline.
    tallest = max(c.height for c in cells)
    scale = (CELL_H - 16) / tallest
    out = []
    for c in cells:
        c = c.resize((max(1, round(c.width * scale)), max(1, round(c.height * scale))), Image.LANCZOS)
        canvas = Image.new("RGBA", (CELL_H * 3 // 4, CELL_H), (0, 0, 0, 0))
        canvas.paste(c, ((canvas.width - c.width) // 2, CELL_H - 8 - c.height), c)
        out.append(canvas)
    return out


def skin_mask(a: np.ndarray) -> np.ndarray:
    """Orange-tan pixels. Outfits are prompted to avoid this hue band."""
    rgb = a[:, :, :3].astype(float) / 255
    mx, mn = rgb.max(axis=2), rgb.min(axis=2)
    d = mx - mn
    with np.errstate(divide="ignore", invalid="ignore"):
        r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
        hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
        sat = np.where(mx > 0, d / mx, 0)
    return (a[:, :, 3] > 0) & (hue >= 12) & (hue <= 40) & (sat >= 0.22) & (mx >= 0.2)


def recolor(cell: Image.Image, tone: tuple[int, int, int], health: str) -> Image.Image:
    a = np.array(cell).astype(float)
    m = skin_mask(a.astype(np.uint8))
    base_l = colorsys.rgb_to_hls(198 / 255, 134 / 255, 66 / 255)[1]
    th, tl, ts = colorsys.rgb_to_hls(*(c / 255 for c in tone))
    if health == "sick":
        ts *= 0.55
        tl = min(1, tl + 0.04)
    elif health == "healthy":
        ts = min(1, ts * 1.15)
        tl = min(1, tl + 0.03)
    ys, xs = np.nonzero(m)
    for y, x in zip(ys, xs):
        _, l, _ = colorsys.rgb_to_hls(*(a[y, x, :3] / 255))
        nl = max(0, min(1, tl + (l - base_l) * (0.9 if tl > 0.35 else 0.6)))
        a[y, x, :3] = np.array(colorsys.hls_to_rgb(th, nl, ts)) * 255
    if health == "sick":  # faint green-grey cast on the whole figure
        body = a[:, :, 3] > 0
        a[body, :3] = a[body, :3] * 0.88 + np.array([150, 165, 140]) * 0.12
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


def preview(path: str, out: str) -> None:
    cells = cut_strip(path)
    healths = ["healthy", "normal", "sick"]
    cw, ch = cells[0].width // 2, cells[0].height // 2
    sheet = Image.new("RGBA", (cw * 3, ch * len(SKIN_TONES)), (13, 34, 25, 255))
    for row, tone in enumerate(SKIN_TONES.values()):
        for col, cell in enumerate(cells):
            img = recolor(cell, tone, healths[col]).resize((cw, ch), Image.LANCZOS)
            sheet.paste(img, (col * cw, row * ch), img)
    sheet.save(out)


if __name__ == "__main__":
    cmd, src, dst = sys.argv[1:4]
    if cmd == "cut-all":
        pass
    if cmd == "cut":
        for i, c in enumerate(cut_strip(src)):
            c.save(f"{dst}_{i}.png")
    elif cmd == "preview":
        preview(src, dst)


def cut_all(raw_dir: str, out_dir: str) -> None:
    """Every <stage>_<sex>_<wealth>.png strip -> three cells named by health state."""
    import pathlib
    out = pathlib.Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    for strip in sorted(pathlib.Path(raw_dir).glob("*_*_*.png")):
        if strip.stem.count("_") != 2 or strip.stem.startswith("contact"):
            continue
        for health, cell in zip(("healthy", "normal", "sick"), cut_strip(str(strip))):
            cell.save(out / f"{strip.stem}_{health}.png", optimize=True)
        print(strip.stem)


if __name__ == "__main__" and sys.argv[1] == "cut-all":
    cut_all(sys.argv[2], sys.argv[3])
