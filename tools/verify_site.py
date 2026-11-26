#!/usr/bin/env python3
"""Sanity-check the static site before it goes to GitHub Pages.

    python3 tools/verify_site.py

The repo root *is* the website: index.html pulls style.css, the two scripts and
vendor/phaser, and the loader fetches every file under assets/ at runtime. A
missing sprite would only show up as a silently absent Pokémon, so check them
here instead.
"""

from __future__ import annotations

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Files wired directly from index.html / style.css.
STATIC = [
    "index.html",
    "style.css",
    "src/roster.js",
    "src/game.js",
    "vendor/phaser.min.js",
    "assets/fonts/Fredoka.ttf",
    "assets/background.jpg",
    "assets/rocky-hill-16x9.jpg",
    "assets/blue-sea-16x9.jpg",
    "assets/player.png",
    "assets/janbob_name.png",
]

MIN_BYTES = {
    ".html": 500,
    ".css": 500,
    ".js": 1000,
    ".png": 200,
    ".jpg": 2000,
    ".ttf": 20000,
}


def main() -> None:
    missing: list[str] = []
    thin: list[str] = []
    checked: list[pathlib.Path] = []

    roster_src = (ROOT / "src" / "roster.js").read_text(encoding="utf-8")
    game_src = (ROOT / "src" / "game.js").read_text(encoding="utf-8")

    # Every species in the roster needs its artwork, and vice versa.
    roster_ids = re.findall(r"id:\s*(\d+)", roster_src)
    if not roster_ids:
        sys.exit("could not read any ids out of src/roster.js")

    # Every ball in the table needs its drawing.
    balls_block = re.search(r"const BALLS = \{([^}]*)\}", game_src)
    if not balls_block:
        sys.exit("could not find the BALLS table in src/game.js")
    ball_names = re.findall(r"(\w+)\s*:", balls_block.group(1))

    wanted = list(STATIC)
    wanted += [f"assets/pokemon/{i}.png" for i in roster_ids]
    wanted += [f"assets/balls/{b}.png" for b in ball_names]

    for rel in wanted:
        path = ROOT / rel
        if not path.exists():
            missing.append(rel)
            continue
        checked.append(path)
        floor = MIN_BYTES.get(path.suffix, 1)
        if path.stat().st_size < floor:
            thin.append(f"{rel} ({path.stat().st_size}B)")

    # Artwork on disk that nothing references is just dead weight.
    on_disk = {p.name for p in (ROOT / "assets" / "pokemon").glob("*.png")}
    orphan = sorted(on_disk - {f"{i}.png" for i in roster_ids})

    total_mb = sum(p.stat().st_size for p in checked) / 1e6

    print(f"checked {len(checked)} files, {total_mb:.1f} MB")
    print(f"roster: {len(roster_ids)} species   balls: {', '.join(ball_names)}")
    if orphan:
        print(f"unused art in assets/pokemon: {', '.join(orphan)}")
    if thin:
        print("suspiciously small:")
        for t in thin:
            print(f"  {t}")
    if missing:
        print("MISSING:")
        for m in missing:
            print(f"  {m}")
        sys.exit(1)
    print("site is complete")


if __name__ == "__main__":
    main()
