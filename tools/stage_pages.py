#!/usr/bin/env python3
"""Stage the single-file build as a GitHub Pages site.

    python3 tools/stage_pages.py

Rebuilds dist/pokecatch.html, then copies it to docs/index.html (the file Pages
serves at the site root) and drops a .nojekyll next to it. Commit docs/ and
point Pages at "main / docs".
"""

from __future__ import annotations

import hashlib
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "dist" / "pokecatch.html"
DOCS = ROOT / "docs"
OUT = DOCS / "index.html"

# Things that must survive into the staged file, so a broken build cannot be
# published by accident.
REQUIRED = ('window.POKECATCH_INLINE', 'id="game"', 'id="endOverlay"', 'Catch the Pokémon')


def main() -> None:
    # Always rebuild: the staged file must never drift from the source.
    subprocess.run([sys.executable, str(ROOT / "tools" / "build_standalone.py")], check=True)

    if not SOURCE.exists():
        sys.exit(f"build produced nothing at {SOURCE}")

    html = SOURCE.read_text(encoding="utf-8")
    for marker in REQUIRED:
        if marker not in html:
            sys.exit(f"refusing to stage: {marker!r} is missing from the build")

    DOCS.mkdir(exist_ok=True)
    shutil.copyfile(SOURCE, OUT)
    # GitHub runs Jekyll over Pages by default; nothing here needs it, and the
    # underscore-prefixed internals it would touch are inlined anyway.
    (DOCS / ".nojekyll").write_text("", encoding="utf-8")

    digest = hashlib.sha256(OUT.read_bytes()).hexdigest()[:12]
    mb = OUT.stat().st_size / 1e6
    print(f"staged {OUT.relative_to(ROOT)}  {mb:.1f} MB  sha256:{digest}")
    print("next: git add docs && git commit -m 'stage for Pages'")
    print("then: Settings -> Pages -> Deploy from a branch -> main / docs")


if __name__ == "__main__":
    main()
