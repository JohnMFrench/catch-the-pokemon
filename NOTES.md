# Notes for the next session

State of the game as of the end of the previous one. Read this before touching
anything; the README is the player-facing doc, this is the working doc.

## Where things are

    ~/pokecatch                  repo root IS the published site
    https://johnmfrench.github.io/catch-the-pokemon/
    http://192.168.1.162:8088/   dev server (python3 -m http.server 8088 --bind 0.0.0.0)
    dist/pokecatch.html          offline single file (gitignored, ~11.6 MB)

    index.html        shell, meta tags, results overlay, iOS fullscreen panel
    style.css         overlay scrims, results card, chips, safe-area rules
    src/game.js       all scenes + tuning (~1780 lines)
    src/roster.js     74 species, order = dex grid order
    tools/build_bg.py      photo -> rectified 16:9 backdrop
    tools/build_standalone.py
    tools/verify_site.py   asserts every referenced asset exists
    assets/*-16x9.jpg   one backdrop per map

## What is in it

- 4 maps, picked on the menu, remembered in `localStorage['pokecatch.map']`:
  ground (meadow), rocky, sea, dark.
- 74 species; pools are **ground 40 / rocky 13 / sea 15 / dark 13**.
- Slingshot throw: 100. Nice throw: 150. Tap-to-throw (auto-aim): 25.
- Bounce: a pull >= ~90% (920 of 1020) bounces off the creature with an "Oof!".
- Pokédex with per-entry screens, 10 cols x 8 rows, fits 74 with room for ~80.
- High scores in `localStorage['pokecatch.v1']`, every run its own row.

Canvas is a fixed 1280x720 logical space, Phaser FIT + CENTER_BOTH.

## Numbers worth not re-deriving

    CFG.roundSeconds 120      pointsPerCatch 100   nicePoints 150   tapPoints 25
    CFG.gravity 340           launchK 6.0          maxDrag 170      minDrag 20
    CFG.bounceSpeed 920       hitRadius 58         ballRadius 26    spriteSize 142
    CFG.maxOnScreen 4         spawnDelay 900       launcher {x:640, y:~560}

Spawn bands, per map (y in the 720-tall space; deliberate, do not "fix" to the
horizon):

    ground 294-430    rocky 226-366    sea 234-364    dark 350-520

Measured art landmarks (frame fractions, for future band work):
sea waterline 42.9%, sea waves from ~79%, dark path from ~45%, hill slope from
~28%.

## Art pipeline

    python3 tools/build_bg.py --src assets/rocky-hill.jpg --out16 assets/rocky-hill-16x9.jpg --bias 0.2
    python3 tools/build_bg.py --src assets/blue-sea.jpg   --out16 assets/blue-sea-16x9.jpg   --bias 1.0
    python3 tools/build_bg.py --src assets/dark-path.jpg  --out16 assets/dark-path-16x9.jpg  --bias 0.5 --rotate 270

`--bias` = how much of the crop's lost height comes off the TOP (0 keeps sky, 1
keeps ground). `--rotate` exists because phones store the sensor frame and only
set an EXIF tag; PIL is used on purpose so the stored pixels are not
auto-rotated. The sea at 1.0 keeps the waves and gives up the sun; that was a
deliberate trade, and the dark path at 270 is the orientation the drawing was
actually in (judge it by whether the branches grow up from the ground).

Sheet detection falls back to the paper-coloured bounding box when the biggest
bright component covers under 45% of the frame - dark drawings otherwise
rectify into a zoomed patch of themselves.

## Deploy and verify

    python3 tools/verify_site.py && python3 tools/build_standalone.py
    git add -A && git commit && git push origin main
    gh api repos/JohnMFrench/catch-the-pokemon/pages/builds/latest \
      --jq '.status + " " + .commit[0:7]'      # must say "built <your sha>"

Two traps, both hit in the last session:

1. `pages/builds/latest` right after a push reports the **previous** build as
   `built`. Poll until the status is built *and* the sha matches HEAD.
2. The page HTML was cache-busted but the browser served a stale `src/roster.js`,
   so a new map showed an empty pool while `curl` proved the edge was current.
   `Network.setCacheDisabled` (or a private tab) before believing a live result.

Also: **a hidden tab cannot enter fullscreen and freezes rAF**. Call
`cdp('Page.bringToFront')` first, or a working button looks broken.

## Known rough edges (not bugs reported, but real)

- The ball's ground-bounce line is still y~682 on every map, so on the sea it
  bounces at the bottom of the frame rather than on the water line.
- The nice-throw ring is the aim arc's endpoint, capped at 90 steps of 1/60 s -
  it is "where the ball is in 1.5 s", not "where it lands". That is what makes
  the bonus a skill; keep the cap if you touch it.
- Tap-to-throw is excluded from nice throws on purpose.
- No sound yet (there is an `assets/custom/audio/gotit.mp3` from the other
  session, unused here).
- Portrait drawing into a 16:9 canvas is handled by banding, not by any smarter
  composition.

## Ideas the user has floated that are not built

- Per-map ground-bounce height.
- More species per map if any pool starts feeling thin (13 is the current
  floor and it was fine, but rocky was 7 once and read as "one Pokémon").

## House rules that came from the user

- Everything must work on a phone in landscape; touch is primary.
- Scores: no de-dupe, a repeat score appears twice.
- Spawn height: "up towards the top", ignore the horizon.
- Dual-type species live on **both** their maps (`mapsForTypes` returns a list).
- Art is the child's drawings; do not redraw, retouch or recolour them. Crop
  decisions are explained in the README next to the command that made them.
