"""Strip the solid / near-solid background from Nano Banana-generated
position illustrations.

Nano Banana (Gemini 2.5 Flash Image) sometimes renders its transparency
checkerboard as actual opaque pixels instead of writing alpha=0. This
script detects the background by sampling corner pixels, then flood-fills
from the 4 corners — any pixel close enough to a corner color becomes
transparent.

Usage:
    python scripts/strip_bg.py                       # processes all PNGs
    python scripts/strip_bg.py tt-pro.png            # single file
    python scripts/strip_bg.py --tolerance 45        # relax color match

The tolerance is the max per-channel RGB distance for a pixel to be
considered "background". Default 40 works for the dark-grey / dark-navy
backgrounds we've seen; bump it up if the fill leaves halo pixels,
bump it down if it eats into the subject.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

POSITIONS_DIR = Path(__file__).resolve().parents[1] / "frontend" / "public" / "positions"


def _corner_palette(arr: np.ndarray, border: int = 4) -> list[tuple[int, int, int]]:
    """Sample a few pixels in each corner region and return unique-ish
    anchor colors the flood fill should start from."""
    h, w = arr.shape[:2]
    samples = []
    for y0, x0 in [(0, 0), (0, w - border), (h - border, 0), (h - border, w - border)]:
        patch = arr[y0:y0 + border, x0:x0 + border, :3].reshape(-1, 3)
        median = tuple(int(v) for v in np.median(patch, axis=0))
        samples.append(median)
    # De-duplicate near-identical corners so we don't run 4 identical fills.
    dedup: list[tuple[int, int, int]] = []
    for s in samples:
        if all(sum(abs(a - b) for a, b in zip(s, d)) > 10 for d in dedup):
            dedup.append(s)
    return dedup


def _flood_transparent(arr: np.ndarray, seed_color: tuple[int, int, int],
                       tolerance: int) -> np.ndarray:
    """Scanline flood-fill starting from every edge pixel that matches
    ``seed_color`` within ``tolerance``. Returns a boolean mask of pixels
    classified as background."""
    h, w = arr.shape[:2]
    rgb = arr[..., :3].astype(np.int16)
    seed = np.array(seed_color, dtype=np.int16)
    near = np.max(np.abs(rgb - seed), axis=2) <= tolerance

    # BFS from the image border — anything reachable through near-seed
    # pixels is background. This avoids eating interior cavities of the
    # bike that happen to share the background color.
    mask = np.zeros((h, w), dtype=bool)
    stack = []
    for x in range(w):
        if near[0, x]:
            stack.append((0, x))
        if near[h - 1, x]:
            stack.append((h - 1, x))
    for y in range(h):
        if near[y, 0]:
            stack.append((y, 0))
        if near[y, w - 1]:
            stack.append((y, w - 1))

    while stack:
        y, x = stack.pop()
        if mask[y, x] or not near[y, x]:
            continue
        # Expand scanline horizontally
        x0 = x
        while x0 > 0 and near[y, x0 - 1] and not mask[y, x0 - 1]:
            x0 -= 1
        x1 = x
        while x1 < w - 1 and near[y, x1 + 1] and not mask[y, x1 + 1]:
            x1 += 1
        mask[y, x0:x1 + 1] = True
        # Queue neighbour scanlines
        for ny in (y - 1, y + 1):
            if 0 <= ny < h:
                for nx in range(x0, x1 + 1):
                    if near[ny, nx] and not mask[ny, nx]:
                        stack.append((ny, nx))
    return mask


def _feather_edges(alpha: np.ndarray, radius: int = 1) -> np.ndarray:
    """Soften the 1-pixel hard edge between transparent and opaque by
    averaging the alpha with a 3×3 neighbourhood, only on border pixels.
    Avoids jaggies without blurring the whole image."""
    if radius < 1:
        return alpha
    from scipy.ndimage import uniform_filter
    smoothed = uniform_filter(alpha.astype(np.float32), size=1 + 2 * radius)
    # Keep fully-opaque interior crisp; only replace alpha near the edge.
    edge = (alpha > 0) & (alpha < 255)
    expanded = uniform_filter(edge.astype(np.float32), size=1 + 2 * radius) > 0
    out = alpha.copy()
    out[expanded] = np.clip(smoothed[expanded], 0, 255).astype(np.uint8)
    return out


def _remove_sparkle_watermark(arr: np.ndarray) -> int:
    """Erase Nano Banana's 4-point sparkle watermark that sits in the
    bottom-right corner of generated images.

    Strategy: any connected component of opaque pixels that (a) is small
    enough to not be part of the subject (< 15k px on a 2048² canvas) AND
    (b) is entirely contained in the bottom-right quadrant, with its
    bounding box anchored at least 1.8× image-width away from top-left,
    is considered the watermark and erased. The main subject component
    is always ≥ 1M pixels so the threshold is safe.

    Returns the number of pixels erased.
    """
    from scipy import ndimage
    h, w = arr.shape[:2]
    alpha = arr[..., 3] > 128
    lab, n = ndimage.label(alpha)
    if n == 0:
        return 0
    sizes = ndimage.sum(alpha, lab, range(1, n + 1))
    size_threshold = 15000  # px; typical sparkle ~3300, subject ~1.2M
    erased = 0
    # Only consider small components anchored in the bottom-right quadrant.
    # The sparkle sits around (y, x) ≈ (0.92·h, 0.92·w).
    br_y_min = int(h * 0.85)
    br_x_min = int(w * 0.85)
    for i, s in enumerate(sizes, start=1):
        if s >= size_threshold:
            continue
        ys, xs = np.where(lab == i)
        if ys.min() >= br_y_min and xs.min() >= br_x_min:
            arr[lab == i, 3] = 0
            erased += int(s)
    return erased


def _global_color_mask(arr: np.ndarray, seeds: list[tuple[int, int, int]],
                       tolerance: int) -> np.ndarray:
    """Mark every pixel whose RGB is within ``tolerance`` of ANY seed color
    as background — not just pixels reachable from the image border.

    This is what cleans the interior cavities (gaps between wheel spokes,
    between legs and frame, inside the helmet strap, etc.) that a pure
    border-seeded flood fill leaves opaque because they are topologically
    surrounded by the subject.

    Safe for these illustrations because the subject palette (cream
    #E8E6F0 + teal #1D9E75) is far from the background palette
    (dark navy / charcoal / light grey) — they don't share near-enough
    colors to confuse the classifier.
    """
    rgb = arr[..., :3].astype(np.int16)
    mask = np.zeros(arr.shape[:2], dtype=bool)
    for seed in seeds:
        s = np.array(seed, dtype=np.int16)
        near = np.max(np.abs(rgb - s), axis=2) <= tolerance
        mask |= near
    return mask


def strip(path: Path, tolerance: int, feather: int, dry_run: bool) -> None:
    im = Image.open(path).convert("RGBA")
    arr = np.array(im)
    seeds = _corner_palette(arr)
    print(f"{path.name}: corner seeds = {seeds}")

    # Pass 1: border-seeded flood fill catches the outer frame.
    bg_mask = np.zeros(arr.shape[:2], dtype=bool)
    for seed in seeds:
        bg_mask |= _flood_transparent(arr, seed, tolerance)

    # Pass 2: global color match catches interior cavities (wheel gaps,
    # between-legs, helmet interior) that flood fill can't reach.
    bg_mask |= _global_color_mask(arr, seeds, tolerance)

    kept_frac = 1.0 - float(bg_mask.mean())
    print(f"  tolerance={tolerance}  kept {kept_frac * 100:.1f}% of pixels (subject)")

    arr[bg_mask, 3] = 0

    # Strip Gemini sparkle watermark in bottom-right corner
    erased = _remove_sparkle_watermark(arr)
    if erased > 0:
        print(f"  removed sparkle watermark: {erased} px")

    arr[..., 3] = _feather_edges(arr[..., 3], radius=feather)

    if dry_run:
        print("  [dry-run] not writing")
        return
    out = Image.fromarray(arr, mode="RGBA")
    out.save(path, optimize=True)
    print(f"  -> wrote {path} ({path.stat().st_size / 1024:.0f} KiB)")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="*", help="PNG filenames (no path) under frontend/public/positions/")
    parser.add_argument("--tolerance", type=int, default=40,
                        help="Max per-channel RGB distance to background seeds (default 40)")
    parser.add_argument("--feather", type=int, default=1,
                        help="Edge feather radius in pixels (0 = hard edge)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.files:
        targets = [POSITIONS_DIR / f for f in args.files]
    else:
        targets = sorted(POSITIONS_DIR.glob("*.png"))

    if not targets:
        print(f"No PNGs found in {POSITIONS_DIR}", file=sys.stderr)
        return 1
    for t in targets:
        if not t.is_file():
            print(f"Skipping missing: {t}")
            continue
        strip(t, args.tolerance, args.feather, args.dry_run)
    return 0


if __name__ == "__main__":
    sys.exit(main())
