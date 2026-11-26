#!/usr/bin/env python3
"""
Split the hand-drawn pokeball sheet into three game sprites.

  assets/custom/img/pokeballs.jpg  ->  assets/balls/{orange,purple,blue}.png

The sheet is a photo of three crayon pokeballs on cream paper. Each ball is drawn
as a black outline on the left (with the white half and the button ring) and a
crayon colour block on the right. Three awkward things, in the order they hurt:

  1. cream paper under warm indoor light -> one global per-channel gain so paper
     lands on PAPER_TARGET neutral grey-white, same treatment as build_bg.py
  2. the uncoloured half of the ball IS paper -> a simple "knock out the white"
     alpha would delete it and leave a hollow outline. Instead the alpha is the
     drawing's own silhouette: ink+pigment mask, close the gaps, then fill the
     enclosed holes (flood fill from the border). The white half, the button hole
     and the crayon's paper speckles all survive as opaque pixels.
  3. three drawings at three different sizes -> normalise so every sprite has the
     same visual weight (equal bounding-box area) on a 320x320 canvas.

Nothing is redrawn or traced: silhouette, crayon strokes and paper grain are the
photo's own pixels. No sharpening, no denoise, no saturation bump.

Usage:  python3 tools/build_balls.py [--preview OUTDIR]
Needs:  opencv-python-headless, numpy, pillow   (uv pip install ...)
"""
import argparse
import os
import sys

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets/custom/img/pokeballs.jpg")
OUT = os.path.join(ROOT, "assets/balls")

PAPER_TARGET = 236.0     # what unpainted paper is mapped to (0-255), neutral
CANVAS = 320             # sprite canvas, same as the Pokemon sprites
MARGIN = 12              # px of air around the ball inside the canvas
TARGET_BOX = 0.62        # bbox area as a fraction of the canvas area (equal weight)
CROP_PAD = 50            # px of context kept around each detected drawing


# --------------------------------------------------------------- detection
def marks(img):
    """Pixels that are ink or pigment rather than paper."""
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    L = lab[:, :, 0].astype(np.float32)
    chroma = np.hypot(lab[:, :, 1].astype(np.float32) - 128,
                      lab[:, :, 2].astype(np.float32) - 128)
    return (L < 110) | (chroma > 40)


def find_balls(img):
    """Bounding boxes of the three drawings, sorted top to bottom."""
    m = marks(img).astype(np.uint8)
    m[:, int(img.shape[1] * 0.83):] = 0        # wooden table on the right edge
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((35, 35), np.uint8))
    n, lab, stats, cent = cv2.connectedComponentsWithStats(m, 8)
    keep = sorted(list(np.argsort(-stats[1:, cv2.CC_STAT_AREA])[:3] + 1),
                  key=lambda i: cent[i][1])
    if len(keep) != 3:
        sys.exit("expected 3 drawings on the sheet, found %d" % len(keep))
    return [tuple(int(v) for v in stats[i, :4]) for i in keep]


def colour_name(crop):
    """Name a crop by the mean hue of its pigment (majority colour)."""
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    pigment = (hsv[:, :, 1].astype(np.float32) > 90) & (hsv[:, :, 2] > 60)
    if pigment.mean() < 0.02:
        return None
    vals = hsv[:, :, 0][pigment].astype(np.float32) * 2.0   # OpenCV hue is 0-180
    ang = np.radians(vals)
    hue = np.degrees(np.arctan2(np.sin(ang).mean(), np.cos(ang).mean())) % 360
    for lo, hi, name in [(0, 45, "orange"), (45, 170, "green"),
                         (170, 260, "blue"), (260, 330, "purple"),
                         (330, 360, "pink")]:
        if lo <= hue < hi:
            return name
    return "hue%d" % round(hue)


# --------------------------------------------------------------- processing
def balance(crop):
    """One global per-channel gain, estimated from the paper border ring."""
    H, W = crop.shape[:2]
    lab = cv2.cvtColor(crop, cv2.COLOR_BGR2LAB)
    L, chroma = lab[:, :, 0], np.hypot(lab[:, :, 1].astype(np.float32) - 128,
                                       lab[:, :, 2].astype(np.float32) - 128)
    ring = np.zeros((H, W), bool)
    t = max(4, int(0.03 * min(H, W)))
    ring[:t], ring[-t:], ring[:, :t], ring[:, -t:] = True, True, True, True
    pm = ring & (L > np.percentile(L, 55)) & (chroma < 22)
    med = np.median(crop[pm], axis=0)
    gains = PAPER_TARGET / np.maximum(med, 1)
    return np.clip(crop.astype(np.float32) * gains, 0, 255), med, gains


def silhouette(crop):
    """Opaque = ink+pigment plus every enclosed hole (the ball's white half)."""
    H, W = crop.shape[:2]
    m = marks(crop).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    j = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    m = (lab == j).astype(np.uint8)

    flood = m.copy()
    pad = np.zeros((H + 2, W + 2), np.uint8)
    cv2.floodFill(flood, pad, (0, 0), 1)
    holes = (flood == 0).astype(np.uint8)      # paper the border cannot reach
    filled = (m | holes).astype(np.uint8)
    a = cv2.GaussianBlur(filled * 255, (0, 0), 1.0)
    return a, filled


def make_sprite(crop):
    bal, med, gains = balance(crop)
    a, filled = silhouette(crop)
    img8 = bal.astype(np.uint8)

    ys, xs = np.where(a > 8)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    img8, a = img8[y0:y1 + 1, x0:x1 + 1], a[y0:y1 + 1, x0:x1 + 1]

    # equal visual weight: same bounding-box area, never bigger than the canvas
    h, w = img8.shape[:2]
    target_area = TARGET_BOX * (CANVAS - 2 * MARGIN) ** 2
    s = min(np.sqrt(target_area / (w * h)),
            (CANVAS - 2 * MARGIN) / max(w, h))
    nw, nh = max(1, int(round(w * s))), max(1, int(round(h * s)))
    col = cv2.resize(img8, (nw, nh), interpolation=cv2.INTER_AREA)
    alp = cv2.resize(a, (nw, nh), interpolation=cv2.INTER_AREA)

    canvas = np.zeros((CANVAS, CANVAS, 4), np.uint8)
    ox, oy = (CANVAS - nw) // 2, (CANVAS - nh) // 2
    canvas[oy:oy + nh, ox:ox + nw, :3] = col
    canvas[oy:oy + nh, ox:ox + nw, 3] = alp

    pig = marks(crop)[y0:y1 + 1, x0:x1 + 1]
    clip = (img8.max(axis=2) >= 254)
    stats = dict(paper=med.tolist(), gains=gains.tolist(),
                 src=(w, h), out=(nw, nh),
                 clip_all=100 * clip.mean(),
                 clip_pigment=100 * clip[pig].mean() if pig.any() else 0.0)
    return canvas, stats


# --------------------------------------------------------------- output
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", metavar="OUTDIR", help="write diagnostics here")
    args = ap.parse_args()

    from PIL import Image
    # PIL on purpose: cv2.imread() honours the EXIF orientation tag.
    img = cv2.cvtColor(np.asarray(Image.open(SRC).convert("RGB")), cv2.COLOR_RGB2BGR)
    print("source %dx%d" % (img.shape[1], img.shape[0]))

    os.makedirs(OUT, exist_ok=True)
    boxes = find_balls(img)
    print("drawings at %s" % boxes)

    names = []
    for (x, y, w, h) in boxes:
        x0, y0 = max(0, x - CROP_PAD), max(0, y - CROP_PAD)
        x1 = min(img.shape[1], x + w + CROP_PAD)
        y1 = min(img.shape[0], y + h + CROP_PAD)
        crop = img[y0:y1, x0:x1].copy()

        name = colour_name(crop)
        if name is None or name in names:
            name = "ball%d" % (len(names) + 1)
        names.append(name)

        canvas, st = make_sprite(crop)
        path = os.path.join(OUT, name + ".png")
        Image.fromarray(canvas[:, :, [2, 1, 0, 3]], "RGBA").save(path, optimize=True)
        print("  %-8s %5dx%-5d -> %3dx%-3d on %d canvas  paper BGR %s  "
              "clip %.2f%% (pigment %.2f%%)  %5.1f KB"
              % (name, st["src"][0], st["src"][1], st["out"][0], st["out"][1],
                 CANVAS, [int(v) for v in st["paper"]], st["clip_all"],
                 st["clip_pigment"], os.path.getsize(path) / 1024))

        if args.preview:
            os.makedirs(args.preview, exist_ok=True)
            check = np.zeros((CANVAS, CANVAS, 3), np.uint8)
            s = 16
            for yy in range(0, CANVAS, s):
                for xx in range(0, CANVAS, s):
                    check[yy:yy + s, xx:xx + s] = 235 if (xx // s + yy // s) % 2 else 195
            af = (canvas[:, :, 3:4].astype(np.float32) / 255)
            comp = canvas[:, :, :3].astype(np.float32) * af + check * (1 - af)
            cv2.imwrite(os.path.join(args.preview, "%s_checker.png" % name),
                        comp.astype(np.uint8))

    if args.preview:
        print("previews ->", args.preview)


if __name__ == "__main__":
    main()
