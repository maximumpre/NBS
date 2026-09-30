#!/usr/bin/env python3
"""Regenerate SERP favicons from a favicon or header/logo fallback.

Social previews (Open Graph / Twitter) must use the site's real header logo or
a dedicated og.png — NOT a favicon composite. See BRAND_ICONS.md.

Usage:
  pip install pillow
  python scripts/generate-brand-assets.py
  python scripts/generate-brand-assets.py public/my-brand-favicon.ico
  python scripts/generate-brand-assets.py --from-logo public/PeakOne-Logo.jpg

Source priority:
  1. CLI path (or --from-logo path)
  2. public/favicon-source.{ico,png,jpg}
  3. public/favicon.ico, favicon.png, favicon-32x32.png, favicon wealthcare.ico
  4. public/images/favicon.ico / favicon.png
  5. public/logo-source.{png,jpg,svg} (last resort)

Outputs into public/ — commit the generated files.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / "public"

GENERATED = [
    ROOT / "favicon.ico",
    ROOT / "favicon.png",
    ROOT / "favicon-32x32.png",
    ROOT / "icon-32x32.png",
    ROOT / "icon-48x48.png",
    ROOT / "apple-touch-icon.png",
]

FAVICON_SOURCE_NAMES = ("favicon-source.ico", "favicon-source.png", "favicon-source.jpg")
FAVICON_FALLBACK_NAMES = (
    "favicon.ico",
    "favicon.png",
    "favicon-32x32.png",
    "favicon wealthcare.ico",
    "images/favicon.ico",
    "images/favicon.png",
)
LOGO_SOURCE_NAMES = ("logo-source.png", "logo-source.jpg", "logo-source.svg")
NEAR_WHITE_THRESHOLD = 250


def _is_near_white(r: int, g: int, b: int, a: int) -> bool:
    if a < 8:
        return True
    return r >= NEAR_WHITE_THRESHOLD and g >= NEAR_WHITE_THRESHOLD and b >= NEAR_WHITE_THRESHOLD


def trim_icon_bbox(img: Image.Image) -> Image.Image:
    """Trim transparent/near-white padding so favicons don't show excess whitespace."""
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


def parse_args(argv: list[str]) -> tuple[str | None, bool]:
    """Return (source_path, force_logo_kind)."""
    path: str | None = None
    force_logo = False
    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg == "--from-logo":
            force_logo = True
            if i + 1 < len(argv):
                path = argv[i + 1]
                i += 2
                continue
            raise SystemExit("--from-logo requires a path argument")
        if arg.startswith("-"):
            raise SystemExit(f"Unknown option: {arg}")
        path = arg
        i += 1
    return path, force_logo


def rasterize_svg(svg_path: Path) -> Path:
    """Rasterize SVG to a temporary PNG (macOS qlmanage, else fail)."""
    out_png = ROOT / "logo-source-raster.png"
    try:
        subprocess.run(
            ["qlmanage", "-t", "-s", "512", "-o", str(ROOT), str(svg_path)],
            check=True,
            capture_output=True,
        )
        generated = ROOT / f"{svg_path.name}.png"
        if generated.exists():
            generated.rename(out_png)
            return out_png
    except (FileNotFoundError, subprocess.CalledProcessError):
        pass
    raise SystemExit(
        f"Cannot rasterize SVG without qlmanage (macOS): {svg_path}\n"
        "Export logo-source.png manually or pass a .png/.jpg path."
    )


def prepare_source(path: Path) -> Path:
    if path.suffix.lower() == ".svg":
        return rasterize_svg(path)
    return path


def is_readable_image(path: Path) -> bool:
    try:
        with Image.open(path) as img:
            img.verify()
        return True
    except OSError:
        return False


def _glob_favicon_candidates() -> list[Path]:
    found: list[Path] = []
    for pattern in ("*favicon*.ico", "*favicon*.png"):
        for p in sorted(ROOT.glob(pattern)):
            if p.name in FAVICON_SOURCE_NAMES or not p.is_file():
                continue
            if is_readable_image(p):
                found.append(p)
    return found


def resolve_source(cli_path: str | None, force_logo: bool) -> tuple[Path, str]:
    if force_logo:
        for name in FAVICON_SOURCE_NAMES:
            if (ROOT / name).exists():
                print(
                    "WARNING: --from-logo used but public/favicon-source.* exists. "
                    "Prefer generating SERP icons from the favicon, not the header logo. "
                    "See BRAND_ICONS.md.",
                    file=sys.stderr,
                )
                break

    if cli_path:
        path = Path(cli_path)
        if not path.is_absolute():
            path = Path.cwd() / path
        if not path.exists():
            raise SystemExit(f"Source not found: {path}")
        kind = "logo fallback" if force_logo else _classify_kind(path)
        return prepare_source(path), kind

    for name in FAVICON_SOURCE_NAMES:
        candidate = ROOT / name
        if candidate.exists():
            return prepare_source(candidate), "favicon"

    for name in FAVICON_FALLBACK_NAMES:
        candidate = ROOT / name
        if candidate.exists() and is_readable_image(candidate):
            return prepare_source(candidate), "favicon"

    for candidate in _glob_favicon_candidates():
        return prepare_source(candidate), "favicon"

    for name in LOGO_SOURCE_NAMES:
        candidate = ROOT / name
        if candidate.exists():
            return prepare_source(candidate), "logo fallback"

    raise SystemExit(
        "Missing source icon. Add one of:\n"
        "  public/favicon-source.ico\n"
        "  public/favicon-source.png\n"
        "  public/favicon.ico\n"
        "  public/logo-source.png (header logo when no favicon)\n"
        "Or pass a path:\n"
        "  python scripts/generate-brand-assets.py path/to/favicon.ico\n"
        "  python scripts/generate-brand-assets.py --from-logo path/to/logo.jpg\n\n"
        "Tip: download the employer CDN favicon, e.g.\n"
        "  curl -o public/favicon-source.ico https://example.com/favicon.ico"
    )


def _classify_kind(path: Path) -> str:
    name = path.name.lower()
    if "favicon" in name or name in FAVICON_SOURCE_NAMES:
        return "favicon"
    if "logo" in name or name in LOGO_SOURCE_NAMES:
        return "logo fallback"
    return "favicon"


def load_source(path: Path) -> Image.Image:
    try:
        return Image.open(path).convert("RGBA")
    except OSError as exc:
        raise SystemExit(f"Cannot read image source: {path}\n{exc}") from exc


def resize_icon(icon: Image.Image, size: int) -> Image.Image:
    """Scale favicon to size×size — same image, no white matting."""
    return icon.convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    cli_path, force_logo = parse_args(sys.argv[1:])
    source, kind = resolve_source(cli_path, force_logo)
    icon = trim_icon_bbox(load_source(source))

    for path in GENERATED:
        if path.exists():
            path.unlink()

    resize_icon(icon, 32).save(ROOT / "icon-32x32.png")
    resize_icon(icon, 32).save(ROOT / "favicon-32x32.png")
    resize_icon(icon, 48).save(ROOT / "icon-48x48.png")
    resize_icon(icon, 32).save(ROOT / "favicon.png")
    resize_icon(icon, 180).save(ROOT / "apple-touch-icon.png")

    ico_images = [resize_icon(icon, s) for s in (16, 32, 48)]
    ico_images[0].save(
        ROOT / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=ico_images[1:],
    )

    print(f"Generated favicons from {source.name} ({kind}):\n")
    for name in (
        "favicon.ico",
        "favicon.png",
        "favicon-32x32.png",
        "icon-32x32.png",
        "icon-48x48.png",
        "apple-touch-icon.png",
    ):
        path = ROOT / name
        kb = path.stat().st_size / 1024
        print(f"  public/{name} ({kb:.1f} KB)")
    print(
        "\nSocial preview: point openGraph.images at your header logo "
        "(see BRAND_ICONS.md). Do not generate og-image.png from the favicon."
    )


if __name__ == "__main__":
    main()
