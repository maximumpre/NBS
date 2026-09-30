#!/usr/bin/env python3
"""Build social preview PNG from a header/login logo (not favicon).

Two modes:
  - tight: trimmed native size when the source is already logo-dominant (PNG/JPG)
  - composite: 1200x630 white canvas with logo at 90% fill (SVG / padded sources)

Usage:
  pip install pillow
  python scripts/generate-og-image.py public/Header-Logo.svg
  python scripts/generate-og-image.py public/logo.png

Outputs public/og-image.png and public/og-image.meta.json.
See Referral-Provider-XO-XO-XD/BRAND_ICONS.md.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote

from PIL import Image

OG_WIDTH = 1200
OG_HEIGHT = 630
OG_BG = (255, 255, 255, 255)
COMPOSITE_FILL_RATIO = 0.90
TIGHT_MAX_TRIM_RATIO = 0.12
MIN_TIGHT_DIMENSION = 200
MIN_COMPOSITE_DIMENSION = 120
NEAR_WHITE_THRESHOLD = 250


def resolve_logo_path(raw: str) -> Path:
    path = Path(raw)
    if not path.is_absolute():
        path = Path.cwd() / path
    if path.exists():
        return path
    decoded = Path(unquote(str(path)))
    if not decoded.is_absolute():
        decoded = Path.cwd() / decoded
    if decoded.exists():
        return decoded
    raise SystemExit(f"Logo not found: {raw}")


def rasterize_svg(svg_path: Path, public_dir: Path) -> Path:
    out_png = public_dir / "logo-og-raster.png"
    try:
        subprocess.run(
            ["qlmanage", "-t", "-s", "1024", "-o", str(public_dir), str(svg_path)],
            check=True,
            capture_output=True,
        )
        generated = public_dir / f"{svg_path.name}.png"
        if generated.exists():
            generated.rename(out_png)
            return out_png
    except (FileNotFoundError, subprocess.CalledProcessError):
        pass
    raise SystemExit(
        f"Cannot rasterize SVG without qlmanage (macOS): {svg_path}\n"
        "Export a PNG/JPG logo or run on macOS."
    )


def prepare_logo(path: Path) -> Path:
    if path.suffix.lower() == ".svg":
        return rasterize_svg(path, path.parent)
    return path


def load_logo(path: Path) -> Image.Image:
    try:
        return Image.open(path).convert("RGBA")
    except OSError as exc:
        raise SystemExit(f"Cannot read logo: {path}\n{exc}") from exc


def _is_near_white(r: int, g: int, b: int, a: int) -> bool:
    if a < 8:
        return True
    return r >= NEAR_WHITE_THRESHOLD and g >= NEAR_WHITE_THRESHOLD and b >= NEAR_WHITE_THRESHOLD


def trim_logo(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    w, h = rgba.size
    pixels = rgba.load()
    min_x, min_y, max_x, max_y = w, h, -1, -1

    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if not _is_near_white(r, g, b, a):
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)

    if max_x < min_x or max_y < min_y:
        return rgba

    return rgba.crop((min_x, min_y, max_x + 1, max_y + 1))


def is_tight_source(source_path: Path, original: Image.Image, trimmed: Image.Image) -> bool:
    if source_path.suffix.lower() == ".svg":
        return False

    original_area = max(1, original.width * original.height)
    trimmed_area = max(1, trimmed.width * trimmed.height)
    trim_ratio = 1 - (trimmed_area / original_area)

    if trim_ratio > TIGHT_MAX_TRIM_RATIO:
        return False
    if max(trimmed.width, trimmed.height) < MIN_TIGHT_DIMENSION:
        return False
    if min(trimmed.width, trimmed.height) < MIN_COMPOSITE_DIMENSION:
        return False
    return True


def build_tight_image(trimmed: Image.Image) -> tuple[Image.Image, tuple[int, int]]:
    return trimmed.convert("RGBA"), (trimmed.width, trimmed.height)


def scale_logo_to_fill(trimmed: Image.Image, max_w: int, max_h: int) -> Image.Image:
    """Scale logo up or down to the largest size that fits in max_w × max_h (90% canvas fill)."""
    w, h = trimmed.size
    if w < 1 or h < 1:
        return trimmed.copy()
    scale = min(max_w / w, max_h / h)
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))
    if (new_w, new_h) == (w, h):
        return trimmed.copy()
    return trimmed.resize((new_w, new_h), Image.Resampling.LANCZOS)


def build_composite_image(trimmed: Image.Image) -> tuple[Image.Image, tuple[int, int]]:
    canvas = Image.new("RGBA", (OG_WIDTH, OG_HEIGHT), OG_BG)
    max_w = int(OG_WIDTH * COMPOSITE_FILL_RATIO)
    max_h = int(OG_HEIGHT * COMPOSITE_FILL_RATIO)
    mark = scale_logo_to_fill(trimmed, max_w, max_h)
    x = (OG_WIDTH - mark.width) // 2
    y = (OG_HEIGHT - mark.height) // 2
    canvas.paste(mark, (x, y), mark)
    return canvas.convert("RGB"), (mark.width, mark.height)


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python scripts/generate-og-image.py public/<logo-file>")

    logo_path = resolve_logo_path(sys.argv[1])
    source_is_svg = logo_path.suffix.lower() == ".svg"
    raster_path = prepare_logo(logo_path)
    original = load_logo(raster_path)
    trimmed = trim_logo(original)

    if min(trimmed.width, trimmed.height) < MIN_COMPOSITE_DIMENSION:
        print(
            f"WARN: source_under_{MIN_COMPOSITE_DIMENSION}px "
            f"({trimmed.width}x{trimmed.height}) — composite will upscale",
            file=sys.stderr,
        )

    if is_tight_source(logo_path, original, trimmed):
        mode = "tight"
        og_image, (logo_w, logo_h) = build_tight_image(trimmed)
        out_w, out_h = logo_w, logo_h
    else:
        mode = "composite"
        og_image, (logo_w, logo_h) = build_composite_image(trimmed)
        out_w, out_h = OG_WIDTH, OG_HEIGHT

    public = Path.cwd() / "public"
    public.mkdir(parents=True, exist_ok=True)
    out = public / "og-image.png"
    meta_path = public / "og-image.meta.json"

    if og_image.mode == "RGBA":
        og_image.save(out, format="PNG", optimize=True)
    else:
        og_image.save(out, format="PNG", optimize=True)

    meta = {
        "mode": mode,
        "width": out_w,
        "height": out_h,
        "source": logo_path.name,
        "sourceIsSvg": source_is_svg,
        "logoBox": {"width": logo_w, "height": logo_h},
    }
    meta_path.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")

    if raster_path != logo_path and raster_path.name == "logo-og-raster.png" and raster_path.exists():
        raster_path.unlink()

    kb = out.stat().st_size / 1024
    print(
        f"Generated public/og-image.png mode={mode} canvas={out_w}x{out_h} "
        f"({kb:.1f} KB) from {logo_path.name} — logo {logo_w}x{logo_h}px"
    )


if __name__ == "__main__":
    main()
