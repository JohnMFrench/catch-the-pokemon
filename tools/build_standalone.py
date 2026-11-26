#!/usr/bin/env python3
"""Fold the whole game into one self-contained HTML file.

Everything gets inlined - Phaser, the sprites, the font, the CSS, the code -
so dist/pokecatch.html works from a USB stick with no server and no internet.

    python3 tools/build_standalone.py
"""

from __future__ import annotations

import base64
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
OUT = DIST / "pokecatch.html"

SPRITE_DIR = ROOT / "assets" / "pokemon"
FONT = ROOT / "assets" / "fonts" / "Fredoka.ttf"


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def read(path: pathlib.Path) -> str:
    if not path.exists():
        sys.exit(f"missing file: {path}")
    return path.read_text(encoding="utf-8")


def script_safe(js: str) -> str:
    """A literal </script> inside an inline script would end the tag early."""
    return js.replace("</script", "<\\/script")


def main() -> None:
    html = read(ROOT / "index.html")
    css = read(ROOT / "style.css")
    phaser = read(ROOT / "vendor" / "phaser.min.js")
    roster = read(ROOT / "src" / "roster.js")
    game = read(ROOT / "src" / "game.js")

    sprites = sorted(SPRITE_DIR.glob("*.png"))
    if not sprites:
        sys.exit(f"no sprites in {SPRITE_DIR}")

    # font -> data URI inside the stylesheet
    css = css.replace(
        "url('assets/fonts/Fredoka.ttf')",
        "url(data:font/ttf;base64," + b64(FONT.read_bytes()) + ")",
    )
    if "assets/fonts" in css:
        sys.exit("font url was not inlined - check style.css")

    # sprites -> a lookup table the loader prefers over file paths
    items = [
        f'"{p.stem}":"data:image/png;base64,{b64(p.read_bytes())}"' for p in sprites
    ]

    # the hand-drawn backdrop is optional: the game falls back to the
    # code-drawn meadow when it is missing
    bgs = {
        "bg-ground": ROOT / "assets" / "background.jpg",
        "bg-rocky": ROOT / "assets" / "rocky-hill-16x9.jpg",
        "bg-sea": ROOT / "assets" / "blue-sea-16x9.jpg",
    }
    for key, path in bgs.items():
        if path.exists():
            items.append(f'"{key}":"data:image/jpeg;base64,' + b64(path.read_bytes()) + '"')
        else:
            print(f"note: no {path.name} - that map falls back to the meadow")

    # hand-drawn balls: assets/balls/<colour>.png -> "ball-<colour>"
    balls = sorted((ROOT / "assets" / "balls").glob("*.png"))
    if not balls:
        print("note: no ball sprites - the game draws its own Poké Ball")
    for b in balls:
        items.append(f'"ball-{b.stem}":"data:image/png;base64,{b64(b.read_bytes())}"')

    # Janbob, the player, and the handwritten name off the same sheet
    player = ROOT / "assets" / "player.png"
    if player.exists():
        items.append('"player":"data:image/png;base64,' + b64(player.read_bytes()) + '"')
    else:
        print("note: no assets/player.png - the game shows its sling pad instead")
    name = ROOT / "assets" / "janbob_name.png"
    if name.exists():
        items.append('"janbob-name":"data:image/png;base64,' + b64(name.read_bytes()) + '"')

    inline_assets = "window.POKECATCH_INLINE={" + ",".join(items) + "};"

    replacements = [
        ('<link rel="stylesheet" href="style.css">', "<style>\n" + css + "\n</style>"),
        ('<script src="vendor/phaser.min.js"></script>',
         "<script>\n" + script_safe(phaser) + "\n</script>"),
        ('<script src="src/roster.js"></script>',
         "<script>\n" + script_safe(inline_assets) + "\n" + script_safe(roster) + "\n</script>"),
        ('<script src="src/game.js"></script>',
         "<script>\n" + script_safe(game) + "\n</script>"),
    ]
    for old, new in replacements:
        if old not in html:
            sys.exit(f"index.html no longer contains: {old}")
        html = html.replace(old, new)

    DIST.mkdir(exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    mb = OUT.stat().st_size / 1e6
    print(f"wrote {OUT} ({mb:.1f} MB, {len(sprites)} sprites, {len(balls)} balls)")


if __name__ == "__main__":
    main()
