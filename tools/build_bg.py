#!/usr/bin/env python3
"""
Build a game-ready background from the hand-drawn sheet photo.

  assets/custom/img/bg.jpg  ->  rectified, white-balanced art at native aspect
                                plus a top-aligned 16:9 backdrop for the 1280x720 canvas

The source is a Galaxy S25+ photo of a crayon drawing on white paper, shot on a
wooden table. What makes it awkward as a game asset, in order of how much it hurts:

  1. wooden table + photo framing around the sheet   -> perspective-warp to the sheet
  2. warm indoor light (paper photographs cream)     -> per-channel white balance
  3. 4000x3000, 3.7 MB                               -> downscale + JPEG
  4. art aspect 1.28 vs the 1.78 game canvas         -> top-aligned 16:9 crop

Nothing is redrawn, retouched, sharpened, denoised or saturation-bumped. The one
per-pixel operation is a single global per-channel gain, estimated from the
unpainted paper itself, so paper lands on PAPER_LEVEL grey-white and every crayon
colour keeps its original hue relationship. Crayon strokes, paper grain and the
clouds (which *are* unpainted paper) survive untouched in shape and detail.

Two things this deliberately does NOT do:

  * No spatial/vignette correction. Fitting a per-pixel illumination field kept
    over-boosting the paper in stroke-dense areas — the local paper estimate is
    dragged down by surrounding crayon — which clipped red and turned the gaps
    pink. Measuring the sheet showed the falloff across it is only a few levels,
    so a global gain gets the same result without the damage.
  * No alpha cut-out. The clouds are unpainted paper, so knocking white out to
    transparent would delete the clouds and speckle the whole image.

Usage:  python3 tools/build_bg.py [--preview OUTDIR]
Needs:  opencv-python-headless, numpy, pillow
        uv pip install opencv-python-headless numpy pillow
"""
import argparse
import os
import sys

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets/custom/img/bg.jpg")
OUT = os.path.join(ROOT, "assets/custom/img")

PAPER_LEVEL = 228.0   # what unpainted paper is mapped to (0-255)
EDGE_TRIM = 8         # px of the sheet's own soft edge to shave off, at full res
CROP_TOP_ALIGNED = True  # 16:9 crop keeps the sky/clouds, trims the bottom of the grass


# --------------------------------------------------------------- geometry
def find_sheet(img):
    """Return the four corners of the paper (TL, TR, BR, BL) in full-res pixels."""
    H, W = img.shape[:2]
    s = 2000.0 / W
    small = cv2.resize(img, (2000, int(round(H * s))), interpolation=cv2.INTER_AREA)
    g = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    bright = cv2.morphologyEx((g > 130).astype(np.uint8) * 255, cv2.MORPH_CLOSE,
                              np.ones((11, 11), np.uint8))
    _, lab, stats, _ = cv2.connectedComponentsWithStats(bright, 8)
    i = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    mask = cv2.morphologyEx((lab == i).astype(np.uint8) * 255, cv2.MORPH_CLOSE,
                            np.ones((9, 9), np.uint8))
    c = max(cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0],
            key=cv2.contourArea)
    hull = cv2.convexHull(c)
    pts = cv2.approxPolyDP(hull, 0.02 * cv2.arcLength(hull, True), True).reshape(-1, 2).astype(np.float32)
    s1, d1 = pts[:, 0] + pts[:, 1], pts[:, 0] - pts[:, 1]
    quad = np.array([pts[np.argmin(s1)], pts[np.argmax(d1)],
                     pts[np.argmax(s1)], pts[np.argmin(d1)]], np.float32)
    return quad / s


def rectify(img, quad, inset=EDGE_TRIM):
    """Perspective-warp the sheet flat, shaving `inset` px of soft paper edge."""
    wA = np.linalg.norm(quad[1] - quad[0]); wB = np.linalg.norm(quad[2] - quad[3])
    hA = np.linalg.norm(quad[3] - quad[0]); hB = np.linalg.norm(quad[2] - quad[1])
    ow, oh = int(round(max(wA, wB))), int(round(max(hA, hB)))
    dst = np.array([[0, 0], [ow - 1, 0], [ow - 1, oh - 1], [0, oh - 1]], np.float32)
    out = cv2.warpPerspective(img, cv2.getPerspectiveTransform(quad, dst), (ow, oh),
                              flags=cv2.INTER_CUBIC)
    return out[inset:oh - inset, inset:ow - inset]


def trim_paper_rim(img, thr=0.50, cap=0.015):
    """Shave the white paper rim the crayon never reached, per edge.

    The sheet's own edge shows as rows/columns that are mostly bare paper. Left in,
    they read as "photo of a sheet" rather than a painted backdrop. Only the edges
    are touched, and only as far as the rim actually runs (capped, so a pale patch
    of sky can never trigger a deep cut).
    """
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    L = lab[:, :, 0].astype(np.float32)
    ch = np.hypot(lab[:, :, 1].astype(np.float32) - 128, lab[:, :, 2].astype(np.float32) - 128)
    paper = ((L > 200) & (ch < 25)).astype(np.float32)
    rows, cols = paper.mean(axis=1), paper.mean(axis=0)

    def run(p):
        n, lim = len(p), int(len(p) * cap)
        i = 0
        while i < lim and p[i] > thr:
            i += 1
        j = n - 1
        while j > n - 1 - lim and p[j] > thr:
            j -= 1
        return i, n - 1 - j

    top, bottom = run(rows)
    left, right = run(cols)
    if top + bottom >= img.shape[0] - 32 or left + right >= img.shape[1] - 32:
        return img, (0, 0, 0, 0)          # refuse a nonsense cut
    return img[top:img.shape[0] - bottom, left:img.shape[1] - right], (top, bottom, left, right)


# --------------------------------------------------------------- colour
def paper_pixels(img):
    """Unpainted paper: bright and fairly neutral. ~18% of this sheet."""
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    L = lab[:, :, 0]
    a = lab[:, :, 1].astype(np.float32) - 128
    b = lab[:, :, 2].astype(np.float32) - 128
    chroma = np.sqrt(a * a + b * b)
    m = ((L > np.percentile(L, 80)) & (chroma < 30)).astype(np.uint8)
    return cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))


def white_balance(img, mask, target=PAPER_LEVEL):
    """One global gain per channel so the paper median becomes neutral `target`."""
    med = np.array([np.median(img[:, :, c][mask > 0]) for c in range(3)], np.float64)
    gains = target / np.maximum(med, 1)
    return np.clip(img.astype(np.float32) * gains, 0, 255), med, gains


# --------------------------------------------------------------- output
def save_jpeg(path, img, quality):
    ok = cv2.imwrite(path, img.astype(np.uint8),
                     [cv2.IMWRITE_JPEG_QUALITY, quality, cv2.IMWRITE_JPEG_OPTIMIZE, 1])
    if not ok:
        sys.exit("failed to write " + path)
    print("  %-38s %5dx%-5d %6.0f KB" % (os.path.basename(path), img.shape[1],
                                         img.shape[0], os.path.getsize(path) / 1024))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", metavar="OUTDIR", help="write diagnostic images here")
    args = ap.parse_args()

    from PIL import Image
    # PIL on purpose: cv2.imread() honours this file's EXIF orientation tag (6) and
    # would rotate it a quarter turn. The stored pixels are already upright.
    img = cv2.cvtColor(np.asarray(Image.open(SRC).convert("RGB")), cv2.COLOR_RGB2BGR)
    print("source %dx%d" % (img.shape[1], img.shape[0]))

    quad = find_sheet(img)
    print("sheet corners %s" % np.round(quad, 0).astype(int).tolist())
    art = rectify(img, quad)
    print("rectified %dx%d (aspect %.3f), %d px of soft edge trimmed"
          % (art.shape[1], art.shape[0], art.shape[1] / art.shape[0], EDGE_TRIM))

    mask = paper_pixels(art)
    clean_f, med, gains = white_balance(art, mask)
    clean = clean_f.astype(np.uint8)
    print("paper pixels %.1f%%  median BGR %s -> %s"
          % (100 * mask.mean(), med.astype(int).tolist(),
             np.median(clean[mask > 0], axis=0).astype(int).tolist()))
    print("white balance gains BGR %s" % np.round(gains, 3).tolist())

    clean, rim = trim_paper_rim(clean)
    print("paper rim trimmed T%d B%d L%d R%d -> %dx%d (aspect %.3f)"
          % (*rim, clean.shape[1], clean.shape[0], clean.shape[1] / clean.shape[0]))


    lab = cv2.cvtColor(art, cv2.COLOR_BGR2LAB)
    chroma = np.hypot(lab[:, :, 1].astype(np.float32) - 128, lab[:, :, 2].astype(np.float32) - 128)
    clip = clean_f.max(axis=2) >= 254.9
    print("clipped %.2f%% of image (%.2f%% of crayon pixels)"
          % (100 * clip.mean(), 100 * clip[chroma >= 30].mean() if (chroma >= 30).any() else 0))

    # ---- outputs
    save_jpeg(os.path.join(OUT, "bg_art.jpg"), clean, 92)

    t, b, l, r = rim
    art_cropped = art[t:art.shape[0] - b, l:art.shape[1] - r]
    h16 = int(round(clean.shape[1] / (16 / 9)))
    y0 = 0 if CROP_TOP_ALIGNED else (clean.shape[0] - h16) // 2
    cover = clean[y0:y0 + h16]
    save_jpeg(os.path.join(OUT, "bg_art_16x9.jpg"),
              cv2.resize(cover, (1920, 1080), interpolation=cv2.INTER_AREA), 90)

    alt = os.path.join(OUT, "alt")
    os.makedirs(alt, exist_ok=True)
    save_jpeg(os.path.join(alt, "bg_art_16x9_photo-colours.jpg"),
              cv2.resize(art_cropped[y0:y0 + h16], (1920, 1080),
                         interpolation=cv2.INTER_AREA), 90)

    if args.preview:
        os.makedirs(args.preview, exist_ok=True)
        def wr(name, im, w=1000):
            cv2.imwrite(os.path.join(args.preview, name),
                        cv2.resize(im, (w, int(w * im.shape[0] / im.shape[1])),
                                   interpolation=cv2.INTER_AREA))
        wr("01_rectified.png", art)
        wr("02_clean.png", clean)
        wr("03_paper-mask.png", mask * 255)
        wr("04_16x9.jpg", cover, 1280)
        print("previews ->", args.preview)


if __name__ == "__main__":
    main()
