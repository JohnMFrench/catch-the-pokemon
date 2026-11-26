# Catch the Pokémon

A 120-second catching game for the browser. Janbob stands at the bottom of the
meadow and throws from his raised hand: pull the Pokéball back, let go, hit a
Pokémon, watch the ball wobble three times — it's yours. Built with Phaser 3.
No build step, no internet, no accounts.

## Play it

**As a website — the repo root is the site.** Upload/copy these five things and
it runs anywhere static:

    index.html  style.css  src/  vendor/  assets/   (+ .nojekyll for Pages)

**Offline, one file — double-click:**

    python3 tools/build_standalone.py     # -> dist/pokecatch.html

That build inlines Phaser, every sprite, the font and the code into a single
HTML file, so it runs straight off the filesystem: no server, no Wi-Fi, works
from a USB stick. It is a build artifact, not the thing that gets published.

**From source (better while editing):**

    ./start.sh            # serves http://127.0.0.1:8088 and opens a browser

Any static server works, e.g. `python3 -m http.server 8088`.

**On a phone or tablet on the same Wi-Fi:** run `./start.sh` and open the
"phone / tablet" address it prints, e.g. `http://192.168.1.162:8088/`. The
server binds all interfaces (`--bind 0.0.0.0`), so any device on your network
can reach it — only this folder is shared. Turn the phone sideways; portrait
shows a "turn your phone" screen instead of a squashed game.

No server at all? Airdrop/drop `dist/pokecatch.html` onto the phone and open it
with a browser (Android: fine; iOS: Files can preview HTML but blocks most
scripts, so the LAN URL is the reliable route on an iPhone).

## How to play

- The ball sits in Janbob's raised hand at the bottom of the screen.
- Press on it, drag **down / back** — the dotted arc shows where it will go.
- Let go to throw. Hit a Pokémon to catch it.
- **Or just tap a Pokémon** — the game aims and throws for you. It is the way in
  for a younger player, and it scores **25** instead of 100.
- Pull it **nearly all the way back** and the dotted arc turns **red**: that
  throw is too fast, the ball bounces off and the Pokémon says *Oof!*. The
  threshold is ~90% of a full pull, so only a hard yank bounces.
- A bad throw is not wasted: the ball **bounces off the grass** and comes back
  up, and each bounce takes the heat out of the throw, so a ball that has hit
  the ground can still catch. Pulling the sling the wrong way (up) fires it at
  the ground — and it comes back.
- `Esc` ends a round early.

Mouse and touch both work. On a phone, turn it sideways (there's a hint if you
forget). The Fullscreen button is bottom-right.

## Rules

| | |
|---|---|
| Round length | 120 seconds |
| Sling throw that lands | +100 |
| Tap a Pokémon (auto-aim) | +25 |
| Pokémon on screen | up to 4, standing still |
| Pokédex | 42 species to find; caught ones stay caught |
| High scores | top 10, saved in the browser (`localStorage`), with a name — every run is its own row, so the same player can appear more than once |
| New record | beating the best score on the board banners the results card with the old number |

Score and Pokédex are per-browser-profile. Nothing leaves the machine.

## Files

    index.html              page shell + results card (DOM)
    style.css               page, card, buttons, portrait-phone hint
    src/game.js             the whole game (scenes, sling, scoring, storage)
    src/roster.js           which Pokémon can appear
    assets/background.jpg   the hand-drawn meadow (1920x1080, from assets/custom)
    assets/player.png       Janbob, the player: cut from
                            assets/custom/img/player.jpg by tools/build_player.py
    assets/janbob_name.png  the handwritten name off the same sheet (menu only)
    assets/balls/<colour>.png  the three hand-drawn balls (320px, alpha), cut from
                            assets/custom/img/pokeballs.jpg by tools/build_balls.py
    assets/pokemon/<id>.png 42 sprites, 320px, from the PokeAPI sprites repo
    assets/fonts/Fredoka.ttf  chunky rounded UI font (SIL Open Font License)
    vendor/phaser.min.js    Phaser 3.90
    tools/build_standalone.py  inlines everything -> dist/pokecatch.html (offline)
    tools/verify_site.py    pre-deploy check: every referenced asset exists
    .nojekyll               tells GitHub Pages to serve the folder as-is
    start.sh                local dev server

## The background

`assets/background.jpg` is the crayon drawing from `assets/custom/img/`
(source kept untouched there). It is drawn full-bleed behind every scene.

To use a different drawing, drop it in and rebuild:

    convert your-art.jpg -resize 1920x1080^ -gravity center -extent 1920x1080 \
            -quality 82 -strip assets/background.jpg
    python3 tools/build_standalone.py

If `assets/background.jpg` is missing the game quietly falls back to the
meadow drawn in code (`drawMeadow()` in `src/game.js`), so it never breaks.

## The ball

`BALLS` at the top of `src/game.js` lists the hand-drawn balls and doubles as the
rotation order (see above). `BALL_SIZE` (84) is the sprite frame on screen — the
drawings have paper margins baked in, so the ball itself is a bit smaller than
that number.

The sprites are cut from the photo of the crayon sheet by `tools/build_balls.py`
(needs opencv/numpy/pillow, `uv pip install` them or use the project `.venv`).
If `assets/balls/` is ever empty the game draws its own ball with Graphics
instead, so nothing breaks.

## Ball rotation

Three balls, **purely cosmetic**: they all score the same `pointsPerCatch`.
There is no power, catch-rate or scoring difference between them.

- The ball in hand cycles **poké (orange) → great (blue) → master (purple) →
  poké …**, advancing one step per throw, and the new ball appears when the
  thrown one lands.
- The ball in flight keeps the look it was thrown with; the swap happens in
  `resetBall()`, never mid-air.
- Each round starts on the Poké Ball (`ballIndex = 0` in `GameScene.create`).
- Cycle order is the insertion order of `BALLS` in `src/game.js`; delete a key
  and that ball drops out of the rotation, art or not (load failures are
  filtered out at startup).
- If `assets/balls/` is empty the game falls back to one Graphics-drawn ball.

To make one of them worth extra points later, that is the only place to touch —
`finishCatch()` currently adds `CFG.pointsPerCatch` regardless of `ballName`.

## Janbob, the player

`assets/custom/img/player.jpg` is a photo of the crayon drawing of **Janbob**,
the kid you play as. He stands at the bottom of the meadow in every round, and
the ball you throw is the one in his raised hand.

`tools/build_player.py` turns the photo into a game sprite:

1. the sheet was photographed on its side → rotate 90° so he stands up
2. warm indoor light → one global per-channel white balance (same as the balls)
3. the white face is paper → alpha is the drawing's own silhouette, gaps closed
   and enclosed paper filled, so his face stays opaque
4. the handwritten "Janbob" next to him → a second cut-out, used on the menu

Both come out as palette PNGs (40 KB and 18 KB) so the single-file build stays
small. Rebuild with:

    .venv/bin/python tools/build_player.py --preview /tmp/janbob

The cut is anchored on his **right hand** (screen left) — the one he throws
with — and the script prints that point as a fraction of the sprite:

    sprite 440x520  hand x=0.250 y=0.252

`JANBOB_HAND` in `src/game.js` holds those numbers, and the sprite's origin is
set to them, so the ball is pinned to his fingers no matter how he is animated.
`CFG.launcher` is that same point: the throw, the dotted arc and the resting
ball all start at his hand. If you re-cut the art and the printed line changes,
update `JANBOB_HAND` to match or the ball will slide off his hand.

If `assets/player.png` is missing the game falls back to the old sling pad and
draws no character, so nothing breaks.

## The Pokédex

Menu → **Pokédex** → tap any Pokémon for a full-screen entry, drawn as the
device itself: red body, blue lens, cream screen. Each entry has large art, type
chips, real height and weight (pulled from PokeAPI), the date you first caught
it, and two facts — one from the games, one real-world science tied to the same
idea: electric eels for Pikachu, spider silk for Scizor, owl feathers for Rowlet,
keratin for Litten, invasive species for Gyarados.

Anything not caught yet opens as a silhouette: "Catch it to unlock this entry!",
and its facts stay hidden.

Facts live in `src/roster.js` beside each species (`dex:` = in-world, `real:` =
real world), so adding a Pokémon means adding all of its data in one place.
`tools/dexdata.json` keeps the height/weight/types that came back from PokeAPI.
The entry screen is the `DexEntry` scene in `src/game.js`; first-catch dates are
stored in `localStorage` under `caughtAt`, keyed by species id.

## Tuning

The knobs are the `CFG` block at the top of `src/game.js` — no magic numbers
buried in the logic:

    roundSeconds   120     length of a round
    pointsPerCatch 100     score per catch
    maxOnScreen    4       how many are loose at once
    spawnDelay     900     ms between spawns
    hitRadius      58      how forgiving the hit test is (with ballRadius 26)
    maxDrag        170     pull length for a full-power throw
    launchK        6.0     pull distance -> launch speed (170*6 = 1020 max)
    bounceSpeed    828     launch speed that bounces instead of catching (~81%)
    tapPoints      25      what a tap-to-throw catch is worth
    groundY        682     grass line the ball bounces off
    bounceDamp     0.68    share of speed a bounce keeps (tuned to reach the band)
    bounceFriction 0.88    share of sideways speed a bounce keeps
    fieldTop       294     highest a Pokémon can spawn (5% of screen above 330)
    gravity        340     arc of the ball
    spriteSize     142     base on-screen size (farther up = smaller)
    janbob.height  200     how tall Janbob stands (his hand anchors the ball)
    launcher       W/2,560 where the ball is held and thrown from

Easier game for small hands: raise `hitRadius`, lower `gravity`, raise
`maxOnScreen`. Harder: the other way.

## Adding a Pokémon

1. Pick a National Dex number, say 133. (`assets/pokemon_list.txt` is the
   shortlist of names to draw from when adding a batch - seven of the nine in
   it were already in the game.)
2. Download
   `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/133.png`
   into `assets/pokemon/133.png` (resize to 320px wide to keep the file small).
3. Add `{ id: 133, name: 'Eevee' }` to `src/roster.js`.
4. Rebuild the single file: `python3 tools/build_standalone.py`.

Order in `roster.js` is the order of the Pokédex grid, so keep it roughly by
generation.

## Not in v1 (on purpose)

- **Sound.** Nothing yet — no music, no effects. Easy to add with Phaser's
  audio manager once there are actual files.
- Flee timers, per-species catch rates, different ball types, combos.
- Per-species scoring (currently flat 100 so the maths stays obvious to a kid).

## Publish on GitHub Pages

The repo root is the site — no build step, no staging copy, nothing to keep in
sync. Pages serves `index.html`, which pulls `style.css`, `src/*.js`,
`vendor/phaser.min.js` and (at runtime) every file under `assets/`.

Before pushing, check the asset graph:

    python3 tools/verify_site.py      # every roster/ball/background file exists

Then, one time:

    git init -b main && git add -A && git commit -m "Catch the Pokémon"
    gh repo create catch-the-pokemon --public --source=. --remote=origin --push
    gh api -X POST repos/<user>/catch-the-pokemon/pages \
        -f 'source[branch]=main' -f 'source[path]=/'

Site: `https://<user>.github.io/catch-the-pokemon/` — a minute or two after the
first push. `gh api repos/<user>/catch-the-pokemon/pages` shows the build status.

Why the split matters: the page itself is ~2 kB, CSS 5 kB, game code ~55 kB,
Phaser 1.2 MB (cached by the browser after the first load), and the art loads on
demand — 42 sprites at ~50 kB each plus the crayon background at 525 kB. One
6.3 MB file meant a long blank screen on mobile; this way the title screen is up
in about a second and the loader bar covers the rest.

Pages deploys from the branch, so any push to `main` republishes. `dist/` is
git-ignored: it is the offline single-file artifact, not part of the site.

⚠ **Before publishing:** this is a fan project using Pokémon sprites and names
(see Credits). Pages on a free GitHub account is a public site, so publishing
means a Pokémon fan game on a public URL under your name. That is your call, not
something the code can decide. If you would rather keep it private, play over
the LAN with `./start.sh` or hand someone `dist/pokecatch.html`.

## Credits / licence

Pokémon and Pokémon character names are trademarks of Nintendo, Creatures Inc.
and GAME FREAK inc. Sprites come from the [PokeAPI sprites
repository](https://github.com/PokeAPI/sprites). This is a fan project for
personal use — please don't publish it or sell it.
