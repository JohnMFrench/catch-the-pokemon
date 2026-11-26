#!/usr/bin/env python3
"""
Build the player sprite (Janbob) from the photo of the crayon drawing.

  assets/custom/img/player.jpg  ->  assets/player.png      (RGBA, cut out)
                                    assets/janbob_name.png (handwritten name)

The source is a 3000x4000 phone photo with the drawing lying on its side, so:

  1. the sheet was photographed in portrait       -> rotate 90 deg CCW
  2. warm indoor light makes paper cream          -> one global per-channel gain
  3. paper white *is* the face and the gaps       -> alpha = the drawing's own
                                                     silhouette (ink + pigment,
                                                     holes filled), same trick as
                                                     tools/build_balls.py
  4. the name is written next to the figure       -> second sprite, its own cut

Nothing is redrawn, traced or smoothed: the crayon strokes and paper grain are
the photo's own pixels.

The sprite is cut so the character's raised right hand (screen left - the one he
throws with) is a known point on the canvas; the game prints/holds everything
from there. build_player.py prints that point as a fraction of the canvas:

    hand  x=0.247 y=0.218

Keep JANBOB_HAND in src/game.js in step with it if you ever re-cut the art.

Usage:  python3 tools/build_player.py [--preview OUTDIR]
Needs:  opencv-python-headless, numpy, pillow
"""
import argparse
import os
import sys

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets/custom/img/player.jpg")
OUT = os.path.join(ROOT, "assets")

PAPER_TARGET = 236.0    # unpainted paper -> neutral grey-white, same as the balls
CANVAS_H = 520          # sprite height in px (drawn ~200px tall in game: 2.6x)
MARGIN = 12             # px of air around the drawing
CROP_PAD = 40           # px of paper kept around the figure before the cut
NAME_PAD = 22
NAME_W = 700            # the handwritten name is drawn ~200px wide in game
# This photo has a desk along the top and right edges, and the desk is pale
# enough to pass for paper in a brightness mask. The drawing sits in the left
# two-thirds, so the figure is looked for only there: x0, y0, x1, y1 as
# fractions of the rotated frame.
FIGURE_ROI = (0.00, 0.20, 0.62, 0.95)


def read_upright(path):
    """Photo is portrait, drawing is landscape: rotate so the figure stands up."""
    from PIL import Image
    # PIL on purpose: cv2.imread() honours the EXIF tag and would rotate again.
    img = cv2.cvtColor(np.asarray(Image.open(path).convert("RGB")), cv2.COLOR_RGB2BGR)
    return np.ascontiguousarray(np.rot90(img, 1))


def marks(img):
    """Pixels that are ink or pigment rather than paper."""
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    L = lab[:, :, 0].astype(np.float32)
    chroma = np.hypot(lab[:, :, 1].astype(np.float32) - 128,
                      lab[:, :, 2].astype(np.float32) - 128)
    return (L < 110) | (chroma > 40)


def balance(crop):
    """One global per-channel gain, estimated from the unpainted paper."""
    lab = cv2.cvtColor(crop, cv2.COLOR_BGR2LAB)
    L = lab[:, :, 0].astype(np.float32)
    chroma = np.hypot(lab[:, :, 1].astype(np.float32) - 128,
                      lab[:, :, 2].astype(np.float32) - 128)
    pm = (L > np.percentile(L, 70)) & (chroma < 20)
    if pm.mean() < 0.05:                       # drawing fills the frame
        pm = (L > np.percentile(L, 90)) & (chroma < 25)
    med = np.median(crop[pm], axis=0)
    gains = PAPER_TARGET / np.maximum(med, 1)
    return np.clip(crop.astype(np.float32) * gains, 0, 255), med, gains


def paper_region(img):
    """The sheet itself: bright, neutral, hole-filled. Everything else is desk."""
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    L = lab[:, :, 0].astype(np.float32)
    chroma = np.hypot(lab[:, :, 1].astype(np.float32) - 128,
                      lab[:, :, 2].astype(np.float32) - 128)
    bright = cv2.morphologyEx(((L > 120) & (chroma < 40)).astype(np.uint8),
                              cv2.MORPH_CLOSE, np.ones((41, 41), np.uint8))
    n, lab2, stats, _ = cv2.connectedComponentsWithStats(bright, 8)
    j = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    m = (lab2 == j).astype(np.uint8)
    flood = m.copy()
    pad = np.zeros((m.shape[0] + 2, m.shape[1] + 2), np.uint8)
    cv2.floodFill(flood, pad, (0, 0), 1)
    sheet = (m | (flood == 0).astype(np.uint8)).astype(np.uint8)
    return cv2.erode(sheet, np.ones((25, 25), np.uint8))   # stay off the sheet edge


def biggest(mask, k):
    """Largest connected blob of `mask` after closing gaps of k px."""
    m = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_CLOSE,
                         np.ones((k, k), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    j = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    return (lab == j).astype(np.uint8), tuple(int(v) for v in stats[j, :4])


def silhouette(crop):
    """Opaque = ink+pigment, gaps closed, enclosed paper (face!) filled."""
    m, box = biggest(marks(crop), 13)
    H, W = m.shape[:2]
    flood = m.copy()
    pad = np.zeros((H + 2, W + 2), np.uint8)
    cv2.floodFill(flood, pad, (0, 0), 1)
    holes = (flood == 0).astype(np.uint8)      # paper the border cannot reach
    filled = (m | holes).astype(np.uint8)
    a = cv2.GaussianBlur(filled * 255, (0, 0), 1.0)
    return a, filled, box


def cut(img, box, pad):
    x, y, w, h = box
    x0, y0 = max(0, x - pad), max(0, y - pad)
    x1, y1 = min(img.shape[1], x + w + pad), min(img.shape[0], y + h + pad)
    return img[y0:y1, x0:x1].copy()


def find_hand(mask, box):
    """The raised right hand (screen left): the art's leftmost extremity.

    The hand is a scribbled blob at arm's end, so take the leftmost point of the
    silhouette inside the shoulder band and then the centroid of the ink around
    it - the ball is pinned there, so it must sit inside the blob, not on its rim.
    """
    x, y, w, h = box
    sub = mask[y:y + h, x:x + w]
    band = sub[int(h * 0.12):int(h * 0.45), :]
    ys, xs = np.where(band > 0)
    if not len(xs):
        return w * 0.2, h * 0.3
    tip_x, tip_y = int(xs.min()), int(ys[np.argmin(xs)])

    x0, x1 = tip_x, min(w, tip_x + int(w * 0.16))
    y0, y1 = max(0, tip_y - int(h * 0.09)), min(band.shape[0], tip_y + int(h * 0.09))
    win = band[y0:y1, x0:x1]
    wy, wx = np.where(win > 0)
    if not len(wx):
        return tip_x, int(h * 0.12) + tip_y
    return x0 + wx.mean(), int(h * 0.12) + y0 + wy.mean()


def crop_to_alpha(canvas):
    a = canvas[:, :, 3]
    ys, xs = np.where(a > 8)
    return canvas[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def fit(canvas, height):
    h, w = canvas.shape[:2]
    s = height / h
    return cv2.resize(canvas, (max(1, int(round(w * s))), height),
                      interpolation=cv2.INTER_AREA)


def build():
    img = read_upright(SRC)
    print("source %dx%d (rotated upright)" % (img.shape[1], img.shape[0]))

    sheet = paper_region(img)
    roi = np.zeros(img.shape[:2], np.uint8)
    x0, y0, x1, y1 = [int(f * s) for f, s in zip(FIGURE_ROI, (img.shape[1], img.shape[0]) * 2)]
    roi[y0:y1, x0:x1] = 1
    fig_mask, box = biggest(marks(img) & (sheet > 0) & (roi > 0), 13)
    print("figure at %s" % (box,))
    crop = cut(img, box, CROP_PAD)
    bal, med, gains = balance(crop)
    a, filled, sub = silhouette(crop)

    out = np.zeros((crop.shape[0], crop.shape[1], 4), np.uint8)
    out[:, :, :3] = bal.astype(np.uint8)
    out[:, :, 3] = a
    out = crop_to_alpha(out)

    # hand: measured on the filled silhouette, then mapped into the trim
    hx, hy = find_hand(filled, sub)
    trim_y, trim_x = np.where(out[:, :, 3] > 8)[0].min(), np.where(out[:, :, 3] > 8)[1].min()
    hx, hy = hx - trim_x, hy - trim_y

    scale = (CANVAS_H - 2 * MARGIN) / out.shape[0]
    sprite = fit(out, CANVAS_H - 2 * MARGIN)
    canvas = np.zeros((CANVAS_H, sprite.shape[1] + 2 * MARGIN, 4), np.uint8)
    canvas[MARGIN:MARGIN + sprite.shape[0], MARGIN:MARGIN + sprite.shape[1]] = sprite

    hand = ((hx * scale + MARGIN) / canvas.shape[1],
            (hy * scale + MARGIN) / canvas.shape[0])

    print("paper BGR %s  gains %s" % ([int(v) for v in med], np.round(gains, 3).tolist()))
    print("sprite %dx%d  hand x=%.3f y=%.3f"
          % (canvas.shape[1], canvas.shape[0], hand[0], hand[1]))
    return canvas, hand, img, sheet, fig_mask, box


def build_name(img, sheet, fig_mask, box):
    """The handwritten 'Janbob' next to the figure, as its own cut-out."""
    x, y, w, h = box
    # everything on the sheet that is not the figure; the letters are what is
    # left in the strip to the right of the body
    rest = (marks(img) & (sheet > 0) &
            ~cv2.dilate(fig_mask, np.ones((41, 41), np.uint8)).astype(bool)
            ).astype(np.uint8)
    win = np.zeros_like(rest)
    win[max(0, y):y + h + 400, x + int(w * 0.62):min(img.shape[1], x + w + 1500)] = 1
    rest &= win
    rest = cv2.morphologyEx(rest, cv2.MORPH_CLOSE, np.ones((13, 13), np.uint8))

    n, lab, stats, _ = cv2.connectedComponentsWithStats(rest, 8)
    keep = [i for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] > 800]
    if len(keep) < 3:
        return None
    km = np.isin(lab, keep).astype(np.uint8)
    ys, xs = np.where(km > 0)
    pad = NAME_PAD
    y0i, y1i = max(0, ys.min() - pad), min(img.shape[0], ys.max() + pad)
    x0i, x1i = max(0, xs.min() - pad), min(img.shape[1], xs.max() + pad)

    bal, med, gains = balance(img)
    out = np.zeros((y1i - y0i, x1i - x0i, 4), np.uint8)
    out[:, :, :3] = bal[y0i:y1i, x0i:x1i].astype(np.uint8)
    out[:, :, 3] = cv2.GaussianBlur(km[y0i:y1i, x0i:x1i] * 255, (0, 0), 1.0)
    if out.shape[1] > NAME_W:                  # it is drawn ~200px wide in game
        s = NAME_W / out.shape[1]
        out = cv2.resize(out, (NAME_W, int(round(out.shape[0] * s))),
                         interpolation=cv2.INTER_AREA)
    print("name   %dx%d (%d letters)" % (out.shape[1], out.shape[0], len(keep)))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", metavar="OUTDIR", help="write diagnostics here")
    args = ap.parse_args()

    from PIL import Image
    canvas, hand, img, sheet, fig_mask, box = build()

    def save(path, arr):
        # palette PNG: crayon + paper grain is flat enough that 160 colours
        # look identical and cost a fifth of the bytes (these get inlined into
        # the single-file build)
        im = Image.fromarray(arr[:, :, [2, 1, 0, 3]], "RGBA")
        im.quantize(colors=160, method=Image.Quantize.FASTOCTREE).save(path, optimize=True)
        print("  %-28s %5.1f KB" % (os.path.relpath(path, ROOT),
                                    os.path.getsize(path) / 1024))

    save(os.path.join(OUT, "player.png"), canvas)
    name = build_name(img, sheet, fig_mask, box)
    if name is not None:
        save(os.path.join(OUT, "janbob_name.png"), name)

    if args.preview:
        os.makedirs(args.preview, exist_ok=True)
        for label, bg in (("grass", (0x5d, 0xa8, 0x51)), ("paper", (0xd7, 0xd2, 0xc4))):
            comp = canvas[:, :, :3].astype(np.float32) * (canvas[:, :, 3:4] / 255.0) \
                + np.array(bg, np.float32) * (1 - canvas[:, :, 3:4] / 255.0)
            im = comp.astype(np.uint8)
            hx = int(round(hand[0] * im.shape[1]))
            hy = int(round(hand[1] * im.shape[0]))
            cv2.drawMarker(im, (hx, hy), (0, 0, 255), cv2.MARKER_CROSS, 26, 2)
            cv2.circle(im, (hx, hy), 26, (0, 0, 255), 2)
            cv2.imwrite(os.path.join(args.preview, "player_on_%s.png" % label), im)
        if name is not None:
            n = cv2.resize(name, (name.shape[1] * 2, name.shape[0] * 2),
                           interpolation=cv2.INTER_AREA)
            comp = n[:, :, :3].astype(np.float32) * (n[:, :, 3:4] / 255.0) + 200 * (1 - n[:, :, 3:4] / 255.0)
            cv2.imwrite(os.path.join(args.preview, "name.png"), comp.astype(np.uint8))
        print("previews ->", args.preview)


if __name__ == "__main__":
    main()
