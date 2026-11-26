/* =====================================================================
   Catch the Pokémon
   A 120-second game: sling the ball back, let go, catch Pokémon.
   Built with Phaser 3. Everything here is tuned for small hands.
   ===================================================================== */
(function () {
  'use strict';

  // ---------------------------------------------------------------- tuning
  const W = 1280;
  const H = 720;

  const CFG = {
    roundSeconds: 120,     // length of one round
    pointsPerCatch: 100,   // score for a sling throw that lands
    nicePoints: 150,       // sling throw whose aim ring sits on the Pokémon
    tapPoints: 25,         // tapping a Pokémon throws for you, for less
    maxOnScreen: 4,        // how many Pokémon are loose at once
    spawnDelay: 900,       // ms between spawns
    ballRadius: 26,
    hitRadius: 58,         // generous: big target, small ball
    maxDrag: 170,          // pixels of pull for a full-power throw
    minDrag: 30,           // less than this and nothing is thrown
    launchK: 6.0,          // pull distance -> launch speed
    // A throw at or above this launch speed bounces off instead of catching.
    // A full pull is maxDrag * launchK = 170 * 6 = 1020, so 828 is ~81%: the
    // red arc appears earlier than it used to (was 920 / ~90%).
    bounceSpeed: 828,
    gravity: 340,          // gentle arc, easy to aim
    // The ball bounces off the ground instead of being lost, so a sling pulled
    // the wrong way still gets a second chance. groundY is where the ball's
    // centre meets the grass; damping is what is left of the speed.
    groundY: 682,
    bounceDamp: 0.68,      // enough left to reach the low Pokémon band again
    bounceFriction: 0.88,
    // Where Pokémon are allowed to appear. Measured against the drawing: the
    // crayon grass starts at y~363 and Janbob's head tops out around y~510, so
    // this band puts their feet on the meadow (roughly y 395-495) instead of
    // leaving them floating in the sky.
    fieldTop: 294,         // 5% of the screen height higher than 330
    fieldBottom: 430,
    fieldLeft: 95,
    fieldRight: W - 95,
    spriteSize: 142,
    // The ball is thrown from Janbob's raised hand, so the launcher IS his
    // hand. It sits high on the sprite, which is why y is above the old pad.
    launcher: { x: W / 2, y: 560 },
    janbob: { height: 200 },       // how tall he stands on screen
    maxBoard: 10,
    storeKey: 'pokecatch.v1'
  };

  // Where the ball sits on the Janbob sprite - the centre of his scribbled
  // right hand, as a fraction of the sprite. tools/build_player.py measures it
  // and prints this line; keep the two in step if the art is re-cut.
  //     hand  x=0.250 y=0.252
  const JANBOB_HAND = { x: 0.250, y: 0.252 };

  const C = {
    ink: '#22333d', inkNum: 0x22333d,
    red: '#e4572e', redNum: 0xe4572e,
    yellow: '#ffc93c', yellowNum: 0xffc93c,
    blue: '#3a86c8', blueNum: 0x3a86c8,
    green: '#4caf50', greenNum: 0x4caf50,
    creamNum: 0xfff8e7,
    white: '#ffffff'
  };

  // Type chip colours, roughly the ones the games use.
  const TYPE_COLOURS = {
    Normal: 0xa8a77a, Fire: 0xf08030, Water: 0x6390f0, Grass: 0x7ac74c,
    Electric: 0xf6d02f, Ice: 0x96d9d6, Fighting: 0xc22e28, Poison: 0xa33ea1,
    Ground: 0xe2bf65, Flying: 0xa98ff3, Psychic: 0xf95587, Bug: 0xa6b91a,
    Rock: 0xb6a136, Ghost: 0x735797, Dragon: 0x6f35fc, Dark: 0x705746,
    Steel: 0xb7b7ce, Fairy: 0xd685ad
  };

  // The three maps. Each species belongs to exactly one of them, decided by its
  // types, so nothing becomes uncatchable. Sea and hill are checked first so a
  // Water/Flying Pokémon counts as a sea one rather than a sky one.
  const MAPS = {
    ground: { name: 'Ground & Sky', blurb: 'Normal and flying Pokémon, plus the rest', types: ['Normal', 'Flying'],
              bg: 'bg-ground', field: { top: 294, bottom: 430 } },
    // Bands sit 20% of the screen height (144px) above where they started
    // (rocky 370-510, sea 378-508), deliberately ignoring where the horizon is
    // in the drawing: the request was "up towards the top", not "on the ground".
    rocky:  { name: 'Rocky Hill',   blurb: 'Rock and ground Pokémon',                  types: ['Rock', 'Ground'],
              bg: 'bg-rocky',  field: { top: 226, bottom: 366 } },
    sea:    { name: 'Blue Sea',     blurb: 'Water Pokémon',                            types: ['Water'],
              bg: 'bg-sea',    field: { top: 234, bottom: 364 } },
    // The dark path sheet is landscape with the path drawn down the middle, so
    // the 16:9 crop keeps the full width and takes its loss off top and bottom.
    // Its band sits as high as the hill's and the sea's, up in the tree line.
    dark:   { name: 'Dark Path',    blurb: 'Dark Pokémon',                             types: ['Dark'],
              bg: 'bg-dark',   field: { top: 226, bottom: 366 } }
  };
  const MAP_ORDER = ['ground', 'rocky', 'sea', 'dark'];   // picker order

  // A Pokémon lives on every map whose types it has, so a dual type is at home
  // in both: Gyarados (Water/Flying) is a sea creature AND a sky one, Aerodactyl
  // (Rock/Flying) is a hill creature AND a sky one. Anything no map claims -
  // fire, electric, grass - lives on the default map, which keeps the Pokédex
  // fillable.
  function mapsForTypes(types) {
    const t = types || [];
    const homes = MAP_ORDER.filter((key) => MAPS[key].types.some((x) => t.indexOf(x) !== -1));
    return homes.length ? homes : ['ground'];
  }

  function loadMapChoice() {
    try {
      const k = localStorage.getItem('pokecatch.map');
      return MAPS[k] ? k : 'ground';
    } catch (e) { return 'ground'; }
  }

  function saveMapChoice(key) {
    try { localStorage.setItem('pokecatch.map', key); } catch (e) { /* private mode */ }
  }

  // Hand-drawn balls, cut from the crayon sheet by tools/build_balls.py.
  // Purely cosmetic: they all score the same, they just cycle on every throw
  // (poké -> great -> master -> poké ...). Insertion order IS the cycle order.
  const BALLS = { orange: 'Poké Ball', blue: 'Great Ball', purple: 'Master Ball' };
  const BALL_SIZE = 84;          // px of sprite frame (the drawing has margins)

  const FONT = '"Fredoka", system-ui, sans-serif';
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------------------------------------------------------------- utilities
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function loadState() {
    const base = { board: [], caught: [], caughtAt: {} };
    try {
      const parsed = JSON.parse(localStorage.getItem(CFG.storeKey) || 'null');
      if (!parsed) return base;
      return {
        board: Array.isArray(parsed.board)
          ? parsed.board.filter(e => e && typeof e.score === 'number' && typeof e.name === 'string')
          : [],
        caught: Array.isArray(parsed.caught) ? parsed.caught.filter(n => typeof n === 'number') : [],
        // id -> timestamp of the first catch; older saves simply have none
        caughtAt: (parsed.caughtAt && typeof parsed.caughtAt === 'object') ? parsed.caughtAt : {}
      };
    } catch (e) { return base; }
  }

  function saveState(s) {
    try { localStorage.setItem(CFG.storeKey, JSON.stringify(s)); } catch (e) { /* private mode */ }
  }

  // Every save is its own row. The same player scoring the same total twice
  // gets two entries - only the board size trims anything away.
  function addScore(name, score) {
    const st = loadState();
    if (score > 0) {
      const clean = (name || 'PLAYER').trim().slice(0, 10).toUpperCase() || 'PLAYER';
      st.board.push({ name: clean, score: score, date: Date.now() });
      // highest first; between equal scores the newer run ranks above the older
      st.board.sort((a, b) => (b.score - a.score) || (b.date - a.date));
      st.board = st.board.slice(0, CFG.maxBoard);
      saveState(st);
    }
    return st;
  }

  function label(scene, x, y, str, size, color, bold) {
    return scene.add.text(x, y, str, {
      fontFamily: FONT,
      fontSize: size + 'px',
      color: color || C.ink,
      fontStyle: bold ? 'bold' : 'normal'
    }).setOrigin(0.5);
  }

  // A little speech bubble that pops, drifts up and fades. Used for the
  // "Oof!" when a throw is too hot to catch.
  function sayBubble(scene, x, y, text, depth) {
    const t = scene.add.text(0, 0, text, {
      fontFamily: FONT, fontSize: '24px', color: C.ink, fontStyle: 'bold'
    }).setOrigin(0.5);
    const w = t.width + 26;
    const h = t.height + 14;
    const g = scene.add.graphics();
    g.fillStyle(0xfff8e7, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    g.lineStyle(3, 0x22333d, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    // tail, pointing down at the Pokémon
    g.fillStyle(0xfff8e7, 1);
    g.beginPath();
    g.moveTo(-8, h / 2 - 1);
    g.lineTo(8, h / 2 - 1);
    g.lineTo(0, h / 2 + 13);
    g.closePath();
    g.fillPath();
    g.lineStyle(3, 0x22333d, 1);
    g.beginPath();
    g.moveTo(-8, h / 2 - 1);
    g.lineTo(0, h / 2 + 13);
    g.lineTo(8, h / 2 - 1);
    g.strokePath();

    const c = scene.add.container(x, y, [g, t])
      .setDepth(depth || 42)
      .setScale(0.4).setAlpha(0);
    scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 150, ease: 'Back.out' });
    scene.tweens.add({
      targets: c, y: y - 28, alpha: 0, delay: 650, duration: 430,
      ease: 'Quad.in', onComplete: () => c.destroy()
    });
    return c;
  }

  function dim(scene) {
    return scene.add.rectangle(0, 0, W, H, 0x0c1e28, 0.42).setOrigin(0, 0).setScrollFactor(0);
  }

  // A chunky, kid-sized button: cream/yellow slab with a hard shadow that
  // squishes when you press it. The look lives in a container, but the thing
  // you actually press is a Zone in world space - that is what works
  // reliably with a finger as well as a mouse.
  function makeButton(scene, x, y, w, h, text, fill, onClick) {
    const c = scene.add.container(x, y);
    const g = scene.add.graphics();
    const r = Math.min(20, h / 2);
    g.fillStyle(0x000000, 0.16);
    g.fillRoundedRect(-w / 2, -h / 2 + 7, w, h, r);
    g.fillStyle(fill, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    g.lineStyle(4, C.inkNum, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);

    const t = label(scene, 0, 0, text, Math.round(h * 0.40), C.ink, true);
    c.add([g, t]);

    const zone = scene.add.zone(x, y, w, h).setOrigin(0.5).setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => scene.tweens.add({ targets: c, scale: 1.04, duration: 110 }));
    zone.on('pointerout', () => scene.tweens.add({ targets: c, scale: 1, duration: 110 }));
    zone.on('pointerdown', () => {
      scene.tweens.add({ targets: c, scale: 0.94, duration: 70, yoyo: true });
      onClick();
    });

    return {
      container: c,
      zone: zone,
      destroy: function () {
        if (c.active) c.destroy();
        if (zone.active) zone.destroy();
      }
    };
  }

  // ------------------------------------------------------ generated art
  function makeBallTexture(scene, key, radius) {
    const size = radius * 2 + 6;
    const cx = size / 2;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx, cx, radius);
    g.fillStyle(C.redNum, 1);
    g.slice(cx, cx, radius, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360), false);
    g.fillPath();
    g.fillStyle(C.inkNum, 1);
    g.fillRect(cx - radius, cx - radius * 0.14, radius * 2, radius * 0.28);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx, cx, radius * 0.30);
    g.lineStyle(Math.max(3, radius * 0.16), C.inkNum, 1);
    g.strokeCircle(cx, cx, radius * 0.30);
    g.strokeCircle(cx, cx, radius);
    g.generateTexture(key, size, size);
    g.destroy();
  }

  function makeSparkTexture(scene) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(6, 6, 6);
    g.generateTexture('spark', 12, 12);
    g.destroy();
  }

  // Soft cream glow, drawn behind every Pokémon. Rock creatures on the rocky
  // drawing were grey-on-grey; this lifts them without a hard sticker edge.
  function makeHaloTexture(scene) {
    const size = 256;
    const tex = scene.textures.createCanvas('halo', size, size);
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.06, size / 2, size / 2, size / 2);
    g.addColorStop(0.00, 'rgba(255,248,231,0.85)');
    g.addColorStop(0.55, 'rgba(255,248,231,0.55)');
    g.addColorStop(1.00, 'rgba(255,248,231,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    tex.refresh();
  }

  function makeShadowTexture(scene) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x1d3b2a, 0.16);
    g.fillEllipse(70, 18, 132, 34);
    g.generateTexture('shadow', 140, 36);
    g.destroy();
  }

  // ------------------------------------------------------------- backdrop
  // Each map has its own backdrop; the default meadow is also the fallback for
  // any map whose art has not been drawn yet.
  function drawMeadow(scene, mapKey) {
    const map = MAPS[mapKey] || MAPS.ground;
    const key = scene.textures.exists(map.bg) ? map.bg
      : (scene.textures.exists('bg-ground') ? 'bg-ground' : null);
    if (key) {
      return scene.add.image(0, 0, key)
        .setOrigin(0, 0)
        .setDisplaySize(W, H)
        .setDepth(-20);
    }
    if (!scene.textures.exists('meadow')) {
      const tex = scene.textures.createCanvas('meadow', 8, H);
      const ctx = tex.getContext();
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0.00, '#6fc0e6');
      grad.addColorStop(0.26, '#b9e3f4');
      grad.addColorStop(0.42, '#e9f5e3');
      grad.addColorStop(0.48, '#96d67b');
      grad.addColorStop(1.00, '#5da851');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 8, H);
      tex.refresh();
    }
    scene.add.image(0, 0, 'meadow').setOrigin(0, 0).setDisplaySize(W, H).setDepth(-20);

    const rnd = mulberry32(20261125);

    // distant hills
    const hills = scene.add.graphics().setDepth(-19);
    hills.fillStyle(0x8ecc74, 1);
    for (let i = 0; i < 7; i++) hills.fillCircle(i * 230 - 70, 372 + (i % 2 ? 18 : -4), 112);
    hills.fillStyle(0x7dc065, 1);
    for (let i = 0; i < 8; i++) hills.fillCircle(i * 190 + 50, 400, 86);

    // clouds
    const cloud = scene.add.graphics().setDepth(-18);
    cloud.fillStyle(0xffffff, 0.85);
    for (let i = 0; i < 4; i++) {
      const cx = 140 + rnd() * (W - 280);
      const cy = 60 + rnd() * 140;
      cloud.fillCircle(cx, cy, 34);
      cloud.fillCircle(cx + 40, cy + 8, 26);
      cloud.fillCircle(cx - 42, cy + 10, 24);
      cloud.fillEllipse(cx, cy + 18, 120, 34);
    }

    // grass texture
    const deco = scene.add.graphics().setDepth(-17);
    for (let i = 0; i < 170; i++) {
      const x = rnd() * W;
      const y = 410 + rnd() * (H - 400);
      const s = 0.8 + rnd() * 1.5;
      deco.fillStyle(0x4f9c46, 0.28);
      deco.fillEllipse(x, y, 16 * s, 7 * s);
    }
    const petals = [0xfff1a8, 0xffffff, 0xffb3c7, 0xffd166];
    for (let i = 0; i < 30; i++) {
      const x = rnd() * W;
      const y = 440 + rnd() * (H - 450);
      deco.fillStyle(petals[Math.floor(rnd() * petals.length)], 0.9);
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2;
        deco.fillCircle(x + Math.cos(a) * 4.5, y + Math.sin(a) * 4.5, 3.4);
      }
      deco.fillStyle(0xffc93c, 1);
      deco.fillCircle(x, y, 2.4);
    }

    // bushes hugging the bottom corners
    const bush = scene.add.graphics().setDepth(-16);
    bush.fillStyle(0x3f8a3c, 0.9);
    const tufts = [[70, H - 4, 120], [W - 90, H + 6, 140], [250, H + 30, 90], [W - 300, H + 22, 100]];
    tufts.forEach(function (t) {
      bush.fillCircle(t[0] - 40, t[1], t[2] * 0.5);
      bush.fillCircle(t[0] + 44, t[1], t[2] * 0.42);
      bush.fillCircle(t[0], t[1] - 14, t[2] * 0.55);
    });
  }

  // ============================================================ Boot scene
  class BootScene extends Phaser.Scene {
    constructor() { super('Boot'); }

    preload() {
      const inline = window.POKECATCH_INLINE || {};
      drawMeadow(this);
      const barW = 400, barH = 16, cx = W / 2, cy = H / 2 + 46;
      const title = label(this, W / 2, H / 2 - 60, 'Catch the Pokémon', 44, C.ink, true);
      const hint = label(this, W / 2, H / 2 - 6, 'Loading Pokémon…', 26, C.ink, true).setAlpha(0.7);
      const track = this.add.graphics();
      track.fillStyle(0xffffff, 0.55);
      track.fillRoundedRect(cx - barW / 2, cy, barW, barH, barH / 2);
      const fill = this.add.graphics();

      this.load.on('progress', function (p) {
        fill.clear();
        fill.fillStyle(C.redNum, 1);
        fill.fillRoundedRect(cx - barW / 2, cy, Math.max(barH, barW * p), barH, barH / 2);
      });
      this.load.on('loaderror', function (file) {
        console.warn('Could not load', file.key);
      });

      this.load.image('bg-ground', inline['bg-ground'] || 'assets/background.jpg');
      this.load.image('bg-rocky', inline['bg-rocky'] || 'assets/rocky-hill-16x9.jpg');
      this.load.image('bg-sea', inline['bg-sea'] || 'assets/blue-sea-16x9.jpg');
      this.load.image('bg-dark', inline['bg-dark'] || 'assets/dark-path-16x9.jpg');
      Object.keys(BALLS).forEach((name) => {
        this.load.image('ball-' + name, inline['ball-' + name] || ('assets/balls/' + name + '.png'));
      });
      this.load.image('player', inline.player || 'assets/player.png');
      // optional: the handwritten name off the same sheet, used on the menu
      this.load.image('janbob-name', inline['janbob-name'] || 'assets/janbob_name.png');
      ROSTER.forEach((p) => {
        this.load.image('poke-' + p.id, inline[p.id] || ('assets/pokemon/' + p.id + '.png'));
      });
      this.__ui = [title, hint, track, fill];
    }

    create() {
      this.__ui.forEach(o => o.destroy());
      // only draw a ball if none of the crayon art arrived
      if (!Object.keys(BALLS).some((n) => this.textures.exists('ball-' + n))) {
        makeBallTexture(this, 'ball-orange', 30);
      }
      makeSparkTexture(this);
      makeShadowTexture(this);
      makeHaloTexture(this);
      // only keep species whose art actually arrived
      ACTIVE = ROSTER.filter(p => this.textures.exists('poke-' + p.id));
      if (!ACTIVE.length) {
        label(this, W / 2, H / 2, 'No Pokémon art found.', 30, C.red, true);
        return;
      }
      this.scene.start('Menu');
    }
  }

  let ACTIVE = [];

  // ============================================================ Menu scene
  class MenuScene extends Phaser.Scene {
    constructor() { super('Menu'); }

    create() {
      let chosen = loadMapChoice();
      const backdrop = drawMeadow(this, chosen);
      const st = loadState();

      // mascot: a Pokémon bobbing on the grass
      const mascotSpec = ACTIVE[3] || ACTIVE[0];
      this.add.image(W * 0.72, 500, 'shadow').setDisplaySize(150, 40).setDepth(3);
      const mascot = this.add.image(W * 0.72, 470, 'poke-' + mascotSpec.id)
        .setScale(CFG.spriteSize * 1.35 / 320).setDepth(4);
      this.tweens.add({
        targets: mascot, y: mascot.y - 16, duration: 1100,
        yoyo: true, repeat: -1, ease: 'Sine.inOut'
      });

      // Janbob, the player, standing on the grass with his name in crayon
      if (this.textures.exists('player')) {
        const src = this.textures.get('player').getSourceImage();
        const jh = 240, jw = jh * (src.width / src.height);
        const jx = W * 0.135, jFeet = H - 8;
        this.add.image(jx, jFeet - jh / 2, 'player')
          .setScale(jh / src.height).setDepth(5);
        this.add.image(jx, jFeet - 2, 'shadow')
          .setDisplaySize(jw * 0.7, jw * 0.16).setDepth(4);
        if (this.textures.exists('janbob-name')) {
          // the handwritten name off the drawing, sitting above him
          this.add.image(jx, jFeet - jh - 34, 'janbob-name')
            .setDisplaySize(230, 230 * 226 / 700).setDepth(6);
        }
      }

      const title = label(this, W * 0.40, 158, 'Catch the Pokémon', 66, C.white, true)
        .setStroke(C.ink, 11).setShadow(0, 7, 'rgba(34,51,61,0.35)', 6, true, true);
      this.tweens.add({
        targets: title, scale: { from: 1, to: 1.03 }, duration: 1400,
        yoyo: true, repeat: -1, ease: 'Sine.inOut'
      });

      label(this, W * 0.40, 232, 'Catch as many as you can in 2 minutes!', 27, C.white, true)
        .setStroke(C.ink, 7);

      const bx = W * 0.42;

      // ---- which map the round is played on, picked before it starts
      const chipY = 292, chipW = 150, chipH = 46, gap = 8;
      const total = MAP_ORDER.length * chipW + (MAP_ORDER.length - 1) * gap;
      const blurb = label(this, bx, 340, MAPS[chosen].blurb, 16, C.ink, true)
        .setStroke(C.white, 5).setAlpha(0.85);
      const chips = {};

      const paintChips = () => {
        MAP_ORDER.forEach((key) => {
          const c = chips[key];
          const on = key === chosen;
          c.g.clear();
          c.g.fillStyle(on ? C.yellowNum : 0xffffff, on ? 1 : 0.70);
          c.g.fillRoundedRect(c.cx - chipW / 2, chipY - chipH / 2, chipW, chipH, chipH / 2);
          c.g.lineStyle(on ? 4 : 2, C.inkNum, on ? 1 : 0.45);
          c.g.strokeRoundedRect(c.cx - chipW / 2, chipY - chipH / 2, chipW, chipH, chipH / 2);
          c.t.setAlpha(on ? 1 : 0.6);
        });
        blurb.setText(MAPS[chosen].blurb);
      };

      MAP_ORDER.forEach((key, i) => {
        const cx = bx - total / 2 + chipW / 2 + i * (chipW + gap);
        chips[key] = {
          cx: cx,
          g: this.add.graphics(),
          t: label(this, cx, chipY, MAPS[key].name, 15, C.ink, true)
        };
        const zone = this.add.zone(cx, chipY, chipW, chipH)
          .setOrigin(0.5).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => {
          if (chosen === key) return;
          chosen = key;
          saveMapChoice(key);
          paintChips();
          // show them where they are going before they press PLAY
          if (backdrop && MAPS[key].bg && this.textures.exists(MAPS[key].bg)) {
            backdrop.setTexture(MAPS[key].bg);
          }
          this.tweens.add({ targets: chips[key].t, scale: 1.12, duration: 90, yoyo: true });
        });
      });
      paintChips();

      const play = () => this.scene.start('Game', { map: chosen });
      makeButton(this, bx, 404, 330, 82, 'PLAY', C.yellowNum, play);
      makeButton(this, bx, 492, 330, 66, 'POKÉDEX  ' + st.caught.length + '/' + ACTIVE.length, 0xa8dd86,
        () => this.scene.start('Dex'));
      makeButton(this, bx, 566, 330, 58, 'How to play', 0xffffff, () => this.showHowTo());

      // best score
      const best = st.board.length ? st.board[0].score : 0;
      label(this, bx, 634, best > 0 ? ('Best: ' + best + ' by ' + st.board[0].name) : 'No scores yet — be the first!',
        21, C.ink, true).setStroke(C.white, 6).setAlpha(0.9);

      this.input.keyboard.on('keydown-ENTER', play);
      this.input.keyboard.on('keydown-SPACE', play);
    }

    showHowTo() {
      const panel = this.add.container(0, 0).setDepth(50);
      panel.add(dim(this));
      const card = this.add.graphics();
      card.fillStyle(C.creamNum, 1);
      card.fillRoundedRect(W / 2 - 300, 150, 600, 418, 28);
      card.lineStyle(5, C.inkNum, 1);
      card.strokeRoundedRect(W / 2 - 300, 150, 600, 418, 28);
      panel.add(card);
      panel.add(label(this, W / 2, 205, 'How to play', 40, C.red, true));
      const steps = [
        "1.  Press the ball in Janbob's hand",
        '2.  Drag DOWN and let go to aim',
        '3.  Hit a Pokémon to catch it!',
        '4.  Ring on the Pokémon goes GREEN? That is a nice throw!',
        '5.  Red dots mean too hard - that throw bounces off!',
        '',
        'Nice throw +' + CFG.nicePoints + '  ·  sling +' + CFG.pointsPerCatch +
          '  ·  tapping +' + CFG.tapPoints,
        'You have ' + CFG.roundSeconds + ' seconds.'
      ];
      steps.forEach((s, i) => {
        panel.add(label(this, W / 2, 258 + i * 36, s, 23, C.ink, false));
      });
      const close = makeButton(this, W / 2, 524, 220, 60, 'Got it!', C.yellowNum, () => kill());
      // the panel is depth 50, so the button has to sit above it or the card
      // draws over it (it did: the only way out was Esc)
      close.container.setDepth(51);
      close.zone.setDepth(51);
      const kill = () => {
        if (panel.active) panel.destroy();
        close.destroy();
      };
      this.input.keyboard.once('keydown-ESC', kill);
    }
  }

  // ============================================================ Dex scene
  class DexScene extends Phaser.Scene {
    constructor() { super('Dex'); }

    create() {
      drawMeadow(this);
      dim(this);
      const st = loadState();
      const caught = st.caught;

      const panel = this.add.graphics();
      panel.fillStyle(C.creamNum, 1);
      panel.fillRoundedRect(70, 40, W - 140, H - 80, 30);
      panel.lineStyle(5, C.inkNum, 1);
      panel.strokeRoundedRect(70, 40, W - 140, H - 80, 30);

      label(this, W / 2, 84, 'Pokédex', 40, C.red, true);
      label(this, W / 2, 120, caught.length + ' of ' + ACTIVE.length + ' caught  ·  tap one to read its entry',
        21, C.ink, true).setAlpha(0.65);

      // Geometry adapts to the roster: 8 columns wide, as many rows as it
      // takes, cells shrinking so the last row stays clear of the Back button.
      // Wide rosters get more columns, not a microscopic grid.
      const cols = ACTIVE.length > 48 ? 10 : 8;
      const rows = Math.ceil(ACTIVE.length / cols);
      const cw = Math.min(132, (W - 200) / cols);
      const top = 158;
      const bottom = H - 110;
      const ch = Math.min(114, (bottom - top) / rows);
      const imgSize = Math.min(78, ch * 0.72);
      const nameSize = ch > 100 ? 14 : 12;
      const x0 = W / 2 - (cols * cw) / 2 + cw / 2;
      const y0 = top + ch / 2;

      ACTIVE.forEach((p, i) => {
        const x = x0 + (i % cols) * cw;
        const y = y0 + Math.floor(i / cols) * ch;
        const got = caught.indexOf(p.id) !== -1;
        const img = this.add.image(x, y, 'poke-' + p.id).setDisplaySize(imgSize, imgSize);
        if (!got) img.setTint(0x3b4f5b).setAlpha(0.28);
        label(this, x, y + ch * 0.36, got ? p.name : '???', nameSize, got ? C.ink : '#7c8c95', got).setAlpha(got ? 1 : 0.7);

        // Zone, not a container: that is the thing that reliably takes a finger.
        const zone = this.add.zone(x, y + ch * 0.02, cw * 0.94, ch * 0.9)
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => img.setScale(img.scale * 1.08));
        zone.on('pointerout', () => img.setDisplaySize(imgSize, imgSize));
        zone.on('pointerdown', () => this.scene.start('DexEntry', { id: p.id }));
      });

      makeButton(this, W / 2, H - 74, 240, 58, 'Back', C.yellowNum, () => this.scene.start('Menu'));
      this.input.keyboard.once('keydown-ESC', () => this.scene.start('Menu'));
      this.input.keyboard.once('keydown-ENTER', () => this.scene.start('Menu'));
    }
  }

  // ======================================================== Pokédex entry
  // One species, full screen, drawn as an actual Pokédex unit: red body, blue
  // lens, cream screen. Big art and identity on top, two facts underneath.
  class DexEntryScene extends Phaser.Scene {
    constructor() { super('DexEntry'); }

    init(data) { this.speciesId = data && data.id; }

    create() {
      drawMeadow(this);
      dim(this);

      const spec = ROSTER.find(r => r.id === this.speciesId);
      if (!spec) { this.scene.start('Dex'); return; }

      const st = loadState();
      const got = st.caught.indexOf(spec.id) !== -1;
      const caughtAt = got ? st.caughtAt[spec.id] : 0;

      // ---------------------------------------------------------- the device
      const body = this.add.graphics();
      body.fillStyle(0x9e3016, 1);
      body.fillRoundedRect(78, 38, 1124, 606, 30);
      body.fillStyle(C.redNum, 1);
      body.fillRoundedRect(80, 40, 1120, 596, 28);
      body.lineStyle(5, C.inkNum, 1);
      body.strokeRoundedRect(80, 40, 1120, 596, 28);

      // lens and status LEDs along the top edge
      const lens = this.add.graphics();
      lens.fillStyle(0x2f6fa8, 1);
      lens.fillCircle(146, 92, 27);
      lens.fillStyle(0x76c4f2, 1);
      lens.fillCircle(146, 92, 20);
      lens.fillStyle(0xffffff, 0.75);
      lens.fillCircle(139, 85, 7);
      lens.lineStyle(5, C.inkNum, 1);
      lens.strokeCircle(146, 92, 27);
      [0xd6453a, 0xffc93c, 0x7ac74c].forEach((c, i) => {
        lens.fillStyle(c, 1);
        lens.fillCircle(200 + i * 30, 92, 9);
        lens.lineStyle(4, C.inkNum, 1);
        lens.strokeCircle(200 + i * 30, 92, 9);
      });
      label(this, 1150, 92, 'POKÉDEX', 23, C.creamNum, true).setOrigin(1, 0.5).setAlpha(0.85);

      // the screen
      const screen = this.add.graphics();
      screen.fillStyle(0xfff8e7, 1);
      screen.fillRoundedRect(120, 132, 1040, 468, 18);
      screen.lineStyle(6, C.inkNum, 1);
      screen.strokeRoundedRect(120, 132, 1040, 468, 18);

      // ------------------------------------------------------------- the art
      this.add.circle(290, 300, 132, 0xefe3cb, 1);
      const art = this.add.image(290, 300, 'poke-' + spec.id).setDisplaySize(240, 240);
      if (!got) art.setTint(0x3b4f5b).setAlpha(0.3);

      // -------------------------------------------------------- the identity
      label(this, 430, 200, got ? spec.name : '???', 46, C.ink, true).setOrigin(0, 0.5);

      if (got) {
        let cx = 430;
        spec.types.forEach((t) => {
          const chip = this.add.graphics();
          const tw = t.length * 12 + 32;
          chip.fillStyle(TYPE_COLOURS[t] || 0x888888, 1);
          chip.fillRoundedRect(cx, 218, tw, 34, 17);
          chip.lineStyle(3, 0x22333d, 0.25);
          chip.strokeRoundedRect(cx, 218, tw, 34, 17);
          label(this, cx + tw / 2, 235, t, 18, '#ffffff', true).setOrigin(0.5);
          cx += tw + 10;
        });

        label(this, 430, 292, spec.h.toFixed(1) + ' m tall   ·   ' + spec.w.toFixed(1) + ' kg',
          20, C.ink).setOrigin(0, 0.5).setAlpha(0.8);

        const when = caughtAt
          ? new Date(caughtAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
          : null;
        label(this, 430, 326, when ? ('First caught ' + when) : 'This one is in your Pokédex',
          17, '#5d7078').setOrigin(0, 0.5);
      } else {
        label(this, 430, 244, 'Not caught yet', 26, C.ink, true).setOrigin(0, 0.5).setAlpha(0.7);
        label(this, 430, 288, 'Catch it to unlock this entry!', 21, '#5d7078').setOrigin(0, 0.5);
      }

      // --------------------------------------------------------------- facts
      const line = this.add.graphics();
      line.lineStyle(2, 0x22333d, 0.12);
      line.lineBetween(150, 430, 1130, 430);

      const factStyle = {
        fontFamily: FONT, fontSize: '19px', color: C.ink,
        wordWrap: { width: 455, useAdvancedWrap: true }, lineSpacing: 6
      };

      if (got) {
        label(this, 150, 458, 'IN THE GAME', 14, C.red, true).setOrigin(0, 0.5).setAlpha(0.9);
        this.add.text(150, 476, spec.dex, factStyle);

        label(this, 660, 458, 'IN REAL LIFE', 14, C.blue, true).setOrigin(0, 0.5).setAlpha(0.9);
        this.add.text(660, 476, spec.real, factStyle);
      } else {
        label(this, W / 2, 490, 'Its facts are a secret until you catch one.', 22, '#5d7078').setOrigin(0.5);
      }

      const back = makeButton(this, W / 2, 672, 210, 54, 'Back', C.yellowNum, () => this.scene.start('Dex'));
      back.container.setDepth(60);
      back.zone.setDepth(60);
      this.input.keyboard.once('keydown-ESC', () => this.scene.start('Dex'));
      this.input.keyboard.once('keydown-ENTER', () => this.scene.start('Dex'));
    }
  }

  // ============================================================ Game scene
  class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }

    // Which map this round is on; the menu passes it in, and the last choice is
    // remembered if a scene starts without one (Play again, tests, deep links).
    init(data) {
      this.chosenMap = (data && MAPS[data.map]) ? data.map : loadMapChoice();
    }

    create() {
      drawMeadow(this, this.chosenMap);

      this.score = 0;
      this.caughtCount = 0;
      this.timeLeft = CFG.roundSeconds;
      this.roundActive = false;
      this.ballState = 'idle';       // idle | aiming | flying | catching | done
      this.pokemon = [];
      this.newThisRound = [];
      this.shotsThrown = 0;
      this.hintShown = false;
      this.aim = null;
      this.dex = loadState().caught;

      // Only this map's species spawn, so each map feels like somewhere else.
      // The pool can never be empty: the default map catches anything left over.
      this.pool = ACTIVE.filter((p) => mapsForTypes(p.types).indexOf(this.chosenMap) !== -1);
      if (!this.pool.length) this.pool = ACTIVE.slice();

      // Each drawing puts its ground at a different height, so the band where
      // Pokémon may appear comes from the map, not from one global value.
      this.field = MAPS[this.chosenMap].field || { top: CFG.fieldTop, bottom: CFG.fieldBottom };
      this.thrownSpeed = 0;
      this.ballHits = new Set();     // Pokémon this throw has already bounced off

      // Janbob stands at the bottom of the field and the ball sits in his
      // raised hand - the hand IS the launcher, so every throw starts from his
      // fingers. The sprite's origin is the hand, which keeps the ball glued
      // to it no matter how he is animated.
      if (this.textures.exists('player')) {
        const src = this.textures.get('player').getSourceImage();
        const jh = CFG.janbob.height;
        const jw = jh * (src.width / src.height);
        this.janbobScale = jh / src.height;
        this.janbob = this.add.image(CFG.launcher.x, CFG.launcher.y, 'player')
          .setOrigin(JANBOB_HAND.x, JANBOB_HAND.y)
          .setScale(this.janbobScale)
          .setDepth(9);              // in the meadow, behind the Pokémon
        this.janbobFeet = CFG.launcher.y + (1 - JANBOB_HAND.y) * jh;
        // soft shadow where his feet meet the grass
        this.add.image(CFG.launcher.x + (0.5 - JANBOB_HAND.x) * jw, this.janbobFeet, 'shadow')
          .setDisplaySize(jw * 0.70, jw * 0.16).setDepth(8);
      } else {
        // no drawing: the ball rests on its old sling pad
        const pad = this.add.graphics().setDepth(1);
        pad.fillStyle(0x2f6b3a, 0.22);
        pad.fillEllipse(CFG.launcher.x, CFG.launcher.y + 78, 210, 54);
        this.add.circle(CFG.launcher.x, CFG.launcher.y, 46, 0xfff8e7, 0.26).setDepth(28);
        this.add.circle(CFG.launcher.x, CFG.launcher.y, 46)
          .setStrokeStyle(3, 0xfff8e7, 0.6).setDepth(28);
      }

      // Only the balls whose art actually loaded go into the cycle, and the
      // cycle order is the BALLS table order: poké -> great -> master.
      this.ballKeys = Object.keys(BALLS).filter((n) => this.textures.exists('ball-' + n));
      if (!this.ballKeys.length) this.ballKeys = ['orange'];
      this.ballIndex = 0;

      // A soft ink shadow behind the ball: the crayon ball is cream and orange,
      // and it sits on orange-ish Janbob and on busy crayon grass, so without
      // this it melts into both.
      this.ballShadow = this.add.ellipse(
        CFG.launcher.x + 3, CFG.launcher.y + 5, BALL_SIZE * 0.62, BALL_SIZE * 0.62,
        C.inkNum, 0.20
      ).setDepth(29);

      this.ballScale = 1;
      this.ball = this.add.image(CFG.launcher.x, CFG.launcher.y, 'ball-' + this.ballKeys[0])
        .setDepth(30);
      this.setBallArt(0);

      this.aimGfx = this.add.graphics().setDepth(29);
      this.sparkles = this.add.particles(0, 0, 'spark', {
        speed: { min: 90, max: 320 },
        lifespan: 700,
        scale: { start: 1.1, end: 0 },
        alpha: { start: 1, end: 0 },
        quantity: 0,
        emitting: false,
        tint: [0xffd166, 0xffffff, 0xe4572e]
      }).setDepth(35);

      this.buildHud();
      this.bindInput();
      this.showHint('Drag the ball down and let go!');

      // ready / go
      const ready = label(this, W / 2, H / 2, 'READY?', 92, C.white, true)
        .setStroke(C.ink, 14).setDepth(60);
      this.tweens.add({ targets: ready, scale: { from: 0.6, to: 1 }, duration: 260, ease: 'Back.out' });

      this.time.delayedCall(700, () => {
        ready.setText('GO!').setScale(1.25).setColor(C.yellow);
        this.tweens.add({ targets: ready, scale: 1, duration: 200 });
        this.spawnThree();
      });
      this.time.delayedCall(1150, () => {
        this.tweens.add({ targets: ready, alpha: 0, duration: 220, onComplete: () => ready.destroy() });
        this.roundActive = true;
        this.startClock();
      });

      this.spawnTimer = this.time.addEvent({
        delay: CFG.spawnDelay, loop: true, callback: () => {
          if (this.roundActive && this.pokemon.length < CFG.maxOnScreen) this.spawnPokemon();
        }
      });

      this.events.once('shutdown', () => {
        if (this.clock) this.clock.remove();
        if (this.spawnTimer) this.spawnTimer.remove();
      });
    }

    // ---------------------------------------------------------------- HUD
    buildHud() {
      this.scoreText = label(this, 34, 26, 'SCORE 0', 34, C.ink, true)
        .setOrigin(0, 0).setDepth(40).setStroke(C.white, 7);
      // which map this round is on
      label(this, 34, 64, MAPS[this.chosenMap].name.toUpperCase(), 14, C.ink, true)
        .setOrigin(0, 0).setDepth(40).setAlpha(0.55).setStroke(C.white, 5);
      this.caughtText = label(this, W - 34, 26, 'CAUGHT 0', 26, C.ink, true)
        .setOrigin(1, 0).setDepth(40).setAlpha(0.9).setStroke(C.white, 6);
      this.timerText = label(this, W / 2, 50, this.fmt(this.timeLeft), 54, C.ink, true).setDepth(40);
      this.timerText.setStroke(C.white, 8);

      this.barBg = this.add.rectangle(W / 2 - 130, 92, 260, 12, 0xffffff, 0.55)
        .setOrigin(0, 0.5).setDepth(40);
      this.bar = this.add.rectangle(W / 2 - 130, 92, 260, 12, C.greenNum, 1)
        .setOrigin(0, 0.5).setDepth(41);
    }

    fmt(sec) {
      const s = Math.max(0, Math.ceil(sec));
      return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }

    updateHud() {
      this.scoreText.setText('SCORE ' + this.score);
      this.caughtText.setText('CAUGHT ' + this.caughtCount);
      this.tweens.add({ targets: this.scoreText, scale: { from: 1.18, to: 1 }, duration: 240, ease: 'Quad.out' });
    }

    startClock() {
      this.clock = this.time.addEvent({
        delay: 1000, loop: true, callback: () => {
          this.timeLeft -= 1;
          this.timerText.setText(this.fmt(this.timeLeft));
          const frac = Phaser.Math.Clamp(this.timeLeft / CFG.roundSeconds, 0, 1);
          this.bar.setScale(frac, 1);
          if (this.timeLeft <= 20) {
            this.bar.fillColor = C.redNum;
            this.timerText.setColor(C.red);
          }
          if (this.timeLeft <= 10 && this.timeLeft > 0 && !REDUCED) {
            this.tweens.add({ targets: this.timerText, scale: { from: 1.25, to: 1 }, duration: 260 });
          }
          if (this.timeLeft <= 0) this.endRound();
        }
      });
    }

    // -------------------------------------------------------------- input
    bindInput() {
      this.input.on('pointerdown', (p) => {
        if (!this.roundActive || this.ballState !== 'idle') return;

        // Tapping a Pokémon throws at it for you. Smaller reward, but it needs
        // no aim at all, so a very young player can still take part.
        const hit = this.pokemonUnder(p.x, p.y);
        if (hit) {
          this.hideHint();
          this.tapThrow(hit);
          return;
        }

        const nearBall = Phaser.Math.Distance.Between(p.x, p.y, CFG.launcher.x, CFG.launcher.y) < 170;
        if (nearBall || p.y > H - 300) {
          this.ballState = 'aiming';
          this.aim = { x: p.x, y: p.y };
          this.hideHint();
        } else {
          this.showHint('Tap a Pokémon, or drag the ball!', 900);
        }
      });

      this.input.on('pointermove', (p) => {
        if (this.ballState === 'aiming' && this.aim) {
          this.aim.x = p.x;
          this.aim.y = p.y;
        }
      });

      const release = (p) => {
        if (this.ballState !== 'aiming' || !this.aim) return;
        const pull = this.pullVector(this.aim);
        this.aimGfx.clear();
        this.tweens.killTweensOf(this.ball);
        this.ball.setPosition(CFG.launcher.x, CFG.launcher.y).setAngle(0);
        if (pull.len < CFG.minDrag) {
          this.ballState = 'idle';
          this.aim = null;
          return;
        }
        this.throwBall(pull);
      };
      this.input.on('pointerup', release);
      this.input.on('pointerupoutside', release);

      this.input.keyboard.on('keydown-ESC', () => {
        if (this.ballState !== 'done') this.endRound();
      });
    }

    // distance + direction of the sling pull (ball minus pointer)
    pullVector(aim) {
      const dx = CFG.launcher.x - aim.x;
      const dy = CFG.launcher.y - aim.y;
      const len = Math.min(Math.hypot(dx, dy), CFG.maxDrag);
      return { dx: dx, dy: dy, len: len, nx: dx / (Math.hypot(dx, dy) || 1), ny: dy / (Math.hypot(dx, dy) || 1) };
    }

    // Simulate the arc for this pull. Shared by the aim dots and by the score,
    // so what the player is shown and what they are paid can never disagree.
    traceArc(pull) {
      let vx = pull.nx * pull.len * CFG.launchK;
      let vy = pull.ny * pull.len * CFG.launchK;
      let x = CFG.launcher.x;
      let y = CFG.launcher.y;
      const dt = 1 / 60;
      const pts = [];
      for (let i = 0; i < 90; i++) {
        vy += CFG.gravity * dt;
        x += vx * dt;
        y += vy * dt;
        pts.push({ x: x, y: y, i: i });
        if (y > H + 40 || x < -60 || x > W + 60) break;
      }
      return { pts: pts, x: x, y: y };
    }

    // The cheapest arc that lands on a Pokémon: the same solve the aim dots
    // use, picked to arrive with the least speed (so it never bounces).
    aimPointFor(pk) {
      const dx = pk.box.x - CFG.launcher.x;
      const dy = pk.box.y - CFG.launcher.y;
      let best = null;
      for (let t = 0.15; t <= 1.2; t += 0.01) {
        const vx = dx / t;
        const vy = (dy - 0.5 * CFG.gravity * t * t) / t;
        const sp = Math.hypot(vx, vy);
        if (!best || sp < best.sp) best = { sp: sp, vx: vx, vy: vy };
      }
      if (!best || !isFinite(best.sp) || best.sp < 1) return null;
      const len = Math.min(best.sp / CFG.launchK, CFG.maxDrag);
      return {
        x: CFG.launcher.x - (best.vx / best.sp) * len,
        y: CFG.launcher.y - (best.vy / best.sp) * len,
        len: len,
        speed: best.sp
      };
    }

    // Which Pokémon a point lands on, using the same generous radius the ball
    // collides with - a small child should not have to hit a pixel.
    pokemonUnder(x, y) {
      let best = null;
      let bestD = Infinity;
      this.pokemon.forEach((pk) => {
        if (pk.caught || !pk.box.active) return;
        const d = Phaser.Math.Distance.Between(x, y, pk.box.x, pk.box.y);
        if (d < CFG.hitRadius + CFG.ballRadius && d < bestD) { best = pk; bestD = d; }
      });
      return best;
    }

    // Tap a Pokémon: the game aims for you, for a smaller reward.
    tapThrow(pk) {
      const aim = this.aimPointFor(pk);
      if (!aim) return;
      this.ballState = 'aiming';
      this.aim = { x: aim.x, y: aim.y };
      this.throwBall(this.pullVector(this.aim), 'tap');
    }

    throwBall(pull, kind) {
      this.shotsThrown++;
      this.aim = null;
      this.ballState = 'flying';
      this.ball.setScale(this.ballScale);
      this.throwKind = kind || 'sling';
      // Nice throw: decided at release from the same arc the aim ring showed,
      // so the green ring is a promise, not a hint.
      const arc = this.traceArc(pull);
      this.throwNice = this.throwKind === 'sling' && !!this.pokemonUnder(arc.x, arc.y);
      this.throwScore = this.throwKind === 'tap' ? CFG.tapPoints
        : (this.throwNice ? CFG.nicePoints : CFG.pointsPerCatch);
      this.thrownSpeed = pull.len * CFG.launchK;
      this.bounces = 0;
      this.ballHits.clear();
      // next ball in the cycle goes into your hand once this one lands
      this.ballIndex = (this.ballIndex + 1) % this.ballKeys.length;

      this.ballVX = pull.nx * pull.len * CFG.launchK;
      this.ballVY = pull.ny * pull.len * CFG.launchK;
      this.ballSpin = Phaser.Math.Clamp((pull.len / CFG.maxDrag) * 720, 120, 900) * (pull.nx >= 0 ? 1 : -1);
      this.ballAge = 0;

      // Janbob squashes and springs back as he lets go. He pivots on the hand,
      // so this never moves the ball off his fingers.
      if (this.janbob) {
        this.tweens.killTweensOf(this.janbob);
        this.janbob.setScale(this.janbobScale);
        this.tweens.add({
          targets: this.janbob,
          scaleX: this.janbobScale * 1.07, scaleY: this.janbobScale * 0.93,
          duration: 90, yoyo: true, ease: 'Quad.out'
        });
      }
    }

    drawAim() {
      if (!this.aim) return;
      const pull = this.pullVector(this.aim);
      const g = this.aimGfx;
      g.clear();

      // stretch the ball back on its sling
      const stretch = pull.len / CFG.maxDrag;
      this.ball.setPosition(
        CFG.launcher.x - pull.nx * stretch * 40,
        CFG.launcher.y - pull.ny * stretch * 34
      );

      if (pull.len < CFG.minDrag) return;

      // No slingshot band any more: the ball is in Janbob's hand, not on a
      // sling, so the pulled-back ball and the dotted arc carry the aim.

      // predicted flight: outlined dots so they read on sky and grass. The
      // dots turn red once the throw is hot enough to bounce, so the limit is
      // visible before letting go.
      const hot = pull.len * CFG.launchK >= CFG.bounceSpeed;
      const arc = this.traceArc(pull);
      arc.pts.forEach((pt) => {
        if (pt.i % 6 !== 0) return;
        const t = 1 - pt.i / 100;
        const r = 4.5 + t * 4;
        g.fillStyle(0x22333d, 0.35 + t * 0.25);
        g.fillCircle(pt.x, pt.y, r + 2.5);
        g.fillStyle(hot ? 0xe4572e : 0xffffff, 0.55 + t * 0.4);
        g.fillCircle(pt.x, pt.y, r);
      });

      // The tracking ring sits where the ball will land. Line it up on a
      // Pokémon and it goes green: that throw is worth a nice-throw bonus.
      const lx = arc.x, ly = arc.y;
      this.aimNice = !!this.pokemonUnder(lx, ly);
      if (this.aimNice) {
        g.lineStyle(3, 0x3ddc84, 0.45);
        g.strokeCircle(lx, ly, 27);
        g.lineStyle(5, 0x2fbf5f, 0.95);
        g.strokeCircle(lx, ly, 17);
        g.lineStyle(2, 0x14532d, 0.55);
        g.strokeCircle(lx, ly, 21);
      } else {
        g.lineStyle(4, 0xffffff, 0.85);
        g.strokeCircle(lx, ly, 16);
        g.lineStyle(2, 0x22333d, 0.5);
        g.strokeCircle(lx, ly, 19);
      }
      this.ball.setAngle(0);
    }

    // ------------------------------------------------------------ pokémon
    spawnThree() {
      const n = Math.min(3, CFG.maxOnScreen);
      for (let i = 0; i < n; i++) {
        this.time.delayedCall(i * 130, () => {
          if (this.roundActive || this.ballState !== 'done') this.spawnPokemon();
        });
      }
    }

    spawnPokemon() {
      if (!this.pool.length) return;
      const spec = this.pool[Math.floor(Math.random() * this.pool.length)];

      // Spawn in the first free column: with four columns and at most four
      // Pokémon out, nothing ever lands on top of anything else.
      const cols = CFG.maxOnScreen;
      const span = (CFG.fieldRight - CFG.fieldLeft) / cols;
      const free = [];
      for (let c = 0; c < cols; c++) {
        const cx = CFG.fieldLeft + span * (c + 0.5);
        const taken = this.pokemon.some(function (q) {
          return q.box.active && !q.caught && Math.abs(q.box.x - cx) < span * 0.55;
        });
        if (!taken) free.push(c);
      }

      let x;
      if (free.length) {
        const cx = CFG.fieldLeft + span * (free[Math.floor(Math.random() * free.length)] + 0.5);
        x = Phaser.Math.Clamp(
          cx + Phaser.Math.Between(-span * 0.3, span * 0.3),
          CFG.fieldLeft + 70, CFG.fieldRight - 70
        );
      } else {
        x = Phaser.Math.Between(CFG.fieldLeft + 70, CFG.fieldRight - 70);
      }
      const y = Phaser.Math.Between(this.field.top, this.field.bottom);

      const dir = Math.random() < 0.5 ? -1 : 1;

      // Farther up the field = a bit smaller, so the row does not read as a
      // flat line of stickers.
      const depth = 0.80 + ((y - this.field.top) / (this.field.bottom - this.field.top)) * 0.25;
      const size = Math.round(CFG.spriteSize * depth);

      const halo = this.add.image(0, 0, 'halo')
        .setDisplaySize(size * 1.45, size * 1.45)
        .setAlpha(0.38);
      const shadow = this.add.image(0, size * 0.46, 'shadow').setDisplaySize(size * 0.84, size * 0.22);
      const img = this.add.image(0, 0, 'poke-' + spec.id)
        .setDisplaySize(size, size)
        .setFlipX(dir < 0);

      // A cream outline separates a grey rock Pokémon from the grey mountain it
      // stands on. WebGL only; the halo above is the fallback when FX is absent.
      try {
        if (img.preFX) img.preFX.addGlow(0xfff8e7, 5, 0, false);
      } catch (e) { /* canvas renderer: halo only */ }

      const box = this.add.container(x, y, [halo, shadow, img]).setDepth(10);
      // They appear with a quick pop and then stay put.
      box.setScale(0.01);
      this.tweens.add({ targets: box, scale: 1, duration: 220, ease: 'Back.out' });

      box.setSize(size, size);
      box.setInteractive(new Phaser.Geom.Rectangle(-size / 2, -size / 2, size, size),
        Phaser.Geom.Rectangle.Contains);

      const pk = {
        id: spec.id,
        name: spec.name,
        box: box,
        img: img,
        caught: false
      };
      this.pokemon.push(pk);
      return pk;
    }

    // --------------------------------------------------------------- ball
    // Swap which drawing is in hand. The source art is 320px and the generated
    // fallback is 66px, so the scale is recomputed per texture rather than
    // assumed: a throw must never resize the ball mid-flight.
    setBallArt(index) {
      const name = this.ballKeys[index % this.ballKeys.length];
      const key = 'ball-' + name;
      if (!this.textures.exists(key)) return;
      const src = this.textures.get(key).getSourceImage();
      this.ballScale = BALL_SIZE / Math.max(src.width, src.height, 1);
      this.ball.setTexture(key).setScale(this.ballScale);
      this.ballName = name;
    }

    stepBall(dt) {
      this.ballAge += dt;
      this.ballVY += CFG.gravity * dt;
      this.ball.x += this.ballVX * dt;
      this.ball.y += this.ballVY * dt;
      this.ball.angle += this.ballSpin * dt;

      // Ground: bounce, do not die. Each bounce also takes the heat out of the
      // throw, so a ball that has hit the grass is no longer "too hot" to catch.
      if (this.ball.y > CFG.groundY && this.ballVY > 0) {
        this.ball.y = CFG.groundY;
        this.ballVY = -this.ballVY * CFG.bounceDamp;
        this.ballVX *= CFG.bounceFriction;
        this.ballSpin *= -0.6;
        this.thrownSpeed *= 0.6;
        this.bounces += 1;
        this.dustPuff(this.ball.x, CFG.groundY + 10);

        // lost its bounce: take it back rather than let it roll about forever
        if (Math.abs(this.ballVY) < 170 || this.bounces > 6) {
          this.resetBall(320);
          return;
        }
      }

      for (let i = 0; i < this.pokemon.length; i++) {
        const pk = this.pokemon[i];
        if (pk.caught || !pk.box.active || this.ballHits.has(pk)) continue;
        const d = Phaser.Math.Distance.Between(this.ball.x, this.ball.y, pk.box.x, pk.box.y);
        if (d < CFG.hitRadius + CFG.ballRadius) {
          // Too hot to hold: it bounces off and the Pokémon complains.
          // Tap throws are aimed by the game itself, so they never bounce.
          if (this.throwKind === 'sling' && this.thrownSpeed >= CFG.bounceSpeed) this.bounceOff(pk);
          else this.beginCatch(pk);
          return;
        }
      }

      const gone = this.ball.y > H + 200 || this.ball.x < -80 || this.ball.x > W + 80 || this.ballAge > 8;
      if (gone) this.resetBall(260);
    }

    // A throw that is too hot bounces off: reflect it away from the Pokémon,
    // damp it, and let the Pokémon complain.
    bounceOff(pk) {
      this.ballHits.add(pk);

      const dx = this.ball.x - pk.box.x;
      const dy = this.ball.y - pk.box.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const along = this.ballVX * ux + this.ballVY * uy;

      this.ballVX = (this.ballVX - 2 * along * ux) * 0.55;
      this.ballVY = (this.ballVY - 2 * along * uy) * 0.55 - 140;
      this.ballSpin *= -0.7;

      // the Pokémon flinches
      this.tweens.add({
        targets: pk.box, scaleX: 1.08, scaleY: 0.92,
        duration: 90, yoyo: true, ease: 'Quad.out'
      });

      sayBubble(this, pk.box.x, pk.box.y - pk.box.displayHeight * 0.46,
        Math.random() < 0.5 ? 'Oof!' : 'Oh!', 42);

      // a puff so the hit registers even though there is no sound yet
      this.sparkles.explode(6, this.ball.x, this.ball.y);
    }

    // a small ring of dust where the ball meets the ground
    dustPuff(x, y) {
      const ring = this.add.circle(x, y, 10)
        .setStrokeStyle(4, 0xfff8e7, 0.9)
        .setDepth(31);
      this.tweens.add({
        targets: ring, scale: 2.4, alpha: 0, duration: 380,
        onComplete: () => ring.destroy()
      });
    }

    resetBall(delay) {
      if (this.ballState === 'done') return;
      this.ballState = 'restocking';
      this.time.delayedCall(delay || 300, () => {
        if (this.ballState === 'done') return;
        this.setBallArt(this.ballIndex);
        this.ball.setPosition(CFG.launcher.x, CFG.launcher.y)
          .setAngle(0).setAlpha(1).setScale(this.ballScale * 0.2);
        this.tweens.add({ targets: this.ball, scale: this.ballScale, duration: 240, ease: 'Back.out' });
        this.ballState = 'idle';
        if (!this.hintShown) this.showHint();
      });
    }

    // -------------------------------------------------------------- catch
    beginCatch(pk) {
      pk.caught = true;
      this.ballState = 'catching';
      this.ballSpin = 0;
      this.ballVX = 0;
      this.ballVY = 0;

      const bx = pk.box.x;
      const by = pk.box.y;
      const isNew = this.dex.indexOf(pk.id) === -1;
      if (isNew) { this.dex.push(pk.id); this.newThisRound.push(pk.name); }

      // pokéball snaps shut
      this.tweens.add({
        targets: this.ball, x: bx, y: by, scale: this.ballScale * 1.18, angle: 0,
        duration: 130, ease: 'Quad.out'
      });

      // the Pokémon gets sucked in
      this.tweens.add({
        targets: pk.box, x: bx, y: by, scale: 0.02, alpha: 0,
        delay: 90, duration: 280, ease: 'Back.in'
      });

      // wobble, wobble, wobble ... then it's caught
      this.time.delayedCall(420, () => {
        this.tweens.chain({
          targets: this.ball,
          tweens: [
            { angle: -16, duration: 110 },
            { angle: 16, duration: 150, yoyo: true, repeat: 1 },
            { angle: 0, duration: 90 }
          ],
          onComplete: () => this.finishCatch(pk, bx, by, isNew)
        });
      });
    }

    finishCatch(pk, x, y, isNew) {
      if (this.ballState === 'done') return;
      this.caughtCount += 1;
      this.score += this.throwScore;

      if (this.dex.indexOf(pk.id) === -1) this.dex.push(pk.id);

      // Persist new species right away: a kid that closes the tab mid-round
      // should still keep what they caught.
      if (isNew) {
        const saved = loadState();
        if (saved.caught.indexOf(pk.id) === -1) {
          saved.caught.push(pk.id);
          saved.caughtAt[pk.id] = Date.now();
          saveState(saved);
        }
      }

      this.sparkles.explode(16, x, y);

      // ring
      const ring = this.add.circle(x, y, 30).setStrokeStyle(6, 0xffffff, 0.9).setDepth(36);
      this.tweens.add({
        targets: ring, scale: 2.6, alpha: 0, duration: 520,
        onComplete: () => ring.destroy()
      });

      // One line, never two stacked: a separate NICE THROW! label collided with
      // the +points above it and both became unreadable. White with a thick
      // dark-green stroke is the only fill that survives both the green meadow
      // and the brown dark path; gold stays for an ordinary catch.
      const popText = this.throwNice ? 'NICE THROW!  +' + this.throwScore : '+' + this.throwScore;
      const pop = label(this, x, y - 40, popText, this.throwNice ? 38 : 44,
                        this.throwNice ? C.white : C.yellow, true)
        .setStroke(this.throwNice ? 0x14532d : C.ink, this.throwNice ? 9 : 7)
        .setDepth(38);
      this.tweens.add({
        targets: pop, y: y - 128, alpha: 0, duration: 950, ease: 'Quad.out',
        onComplete: () => pop.destroy()
      });

      if (isNew) {
        const tag = label(this, x, y - 96, 'NEW!', 30, C.white, true)
          .setStroke(C.red, 6).setDepth(37);
        this.tweens.add({
          targets: tag, y: y - 160, alpha: 0, duration: 1100, ease: 'Quad.out',
          onComplete: () => tag.destroy()
        });
      }

      // ball fades out, Pokémon is gone
      this.tweens.add({
        targets: this.ball, scale: this.ballScale * 1.6, alpha: 0, duration: 320, delay: 120,
        onComplete: () => {
          this.ball.setAlpha(1);
          if (pk.box.active) pk.box.destroy();
          const idx = this.pokemon.indexOf(pk);
          if (idx !== -1) this.pokemon.splice(idx, 1);
          this.updateHud();
          this.resetBall(180);
        }
      });
    }

    // --------------------------------------------------------------- hint
    // A crayon speech bubble just above Janbob's head: he is the one telling
    // you how to play, and it stays clear of his body and the ball.
    showHint(text, ms) {
      if (this.hint) { this.hint.destroy(); this.hint = null; }
      if (this.ballState === 'done') return;
      const t = label(this, 0, 0,          text || 'Drag the ball down, or tap a Pokémon!', 24, C.ink, true);
      const bw = t.width + 48, bh = 56;
      const bubble = this.add.container(CFG.launcher.x, CFG.launcher.y - 100).setDepth(38);
      const g = this.add.graphics();
      g.fillStyle(C.creamNum, 0.94);
      g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 20);
      g.lineStyle(4, C.inkNum, 1);
      g.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 20);
      // tail pointing down at his head
      g.fillStyle(C.creamNum, 0.94);
      g.fillTriangle(-16, bh / 2 - 4, 20, bh / 2 - 4, -22, bh / 2 + 26);
      g.lineStyle(4, C.inkNum, 1);
      g.beginPath();
      g.moveTo(-16, bh / 2 - 4);
      g.lineTo(-22, bh / 2 + 26);
      g.lineTo(20, bh / 2 - 4);
      g.strokePath();
      bubble.add([g, t]);
      if (!REDUCED) {
        this.tweens.add({
          targets: bubble, y: bubble.y + 8, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut'
        });
      }
      this.hint = bubble;
      if (ms) this.time.delayedCall(ms, () => { if (this.hint === bubble) { bubble.destroy(); this.hint = null; } });
    }

    hideHint() {
      this.hintShown = true;
      if (this.hint) { this.hint.destroy(); this.hint = null; }
    }

    // ------------------------------------------------------------ endgame
    endRound() {
      if (this.ballState === 'done') return;
      this.ballState = 'done';
      this.roundActive = false;
      if (this.clock) this.clock.remove();
      if (this.spawnTimer) this.spawnTimer.remove();
      this.hideHint();
      this.aimGfx.clear();
      this.tweens.killTweensOf(this.ball);
      this.ball.setAlpha(0);
      this.pokemon.forEach(pk => {
        if (pk.box.active) this.tweens.add({ targets: pk.box, alpha: 0.25, duration: 500 });
      });

      const st = loadState();
      this.dex.forEach(id => { if (st.caught.indexOf(id) === -1) st.caught.push(id); });
      saveState(st);

      const big = label(this, W / 2, H / 2 - 20, "TIME'S UP!", 92, C.white, true)
        .setStroke(C.ink, 14).setDepth(60);
      this.tweens.add({ targets: big, scale: { from: 0.6, to: 1 }, duration: 320, ease: 'Back.out' });

      this.input.removeAllListeners('pointerdown');
      this.input.removeAllListeners('pointermove');
      this.input.removeAllListeners('pointerup');

      const score = this.score;
      const caught = this.caughtCount;
      const fresh = this.newThisRound.slice();
      this.time.delayedCall(1100, () => {
        window.PokeCatch.showResults({ score: score, caught: caught, newNames: fresh });
      });
    }

    clearUi() {
      [this.scoreText, this.caughtText, this.timerText, this.bar, this.barBg, this.hint]
        .forEach(o => { if (o && o.destroy) o.destroy(); });
    }
  }

  // ------------------------------------------------------------ update hook
  const proto = GameScene.prototype;
  proto.update = function (time, delta) {
    const dt = Math.min(delta, 48) / 1000;
    if (this.ballState === 'flying') this.stepBall(dt);
    else if (this.ballState === 'aiming') this.drawAim();
    // a slow lean so Janbob is not a sticker. He pivots on his hand, so the
    // ball he is holding stays exactly where the throw says it is.
    if (this.janbob && !REDUCED) this.janbob.setAngle(Math.sin(time / 640) * 1.4);
    if (this.ballShadow) {
      const held = this.ballState === 'idle' || this.ballState === 'aiming' ||
        this.ballState === 'restocking';
      this.ballShadow.setPosition(this.ball.x + 3, this.ball.y + 5).setVisible(held);
    }
  };

  // ======================================================== boot + DOM glue
  let game = null;

  const overlay = document.getElementById('endOverlay');
  const endScore = document.getElementById('endScore');
  const endRecord = document.getElementById('endRecord');
  const endCount = document.getElementById('endCount');
  const endNew = document.getElementById('endNew');
  const nameForm = document.getElementById('nameForm');
  const nameInput = document.getElementById('nameInput');
  const boardEl = document.getElementById('board');
  const lastScore = { value: 0 };

  function nameOf(id) {
    const spec = ROSTER.find(p => p.id === id);
    return spec ? spec.name : '???';
  }

  function renderBoard(highlight) {
    const st = loadState();
    boardEl.innerHTML = '';
    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = 'Best scores';
    boardEl.appendChild(title);

    if (!st.board.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'No scores yet — you are the first!';
      boardEl.appendChild(li);
      return;
    }
    st.board.forEach((row, i) => {
      const li = document.createElement('li');
      if (highlight && row.name === highlight.name && row.score === highlight.score) li.className = 'me';
      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = (i + 1) + '.';
      const who = document.createElement('span');
      who.className = 'who';
      who.textContent = row.name;
      const pts = document.createElement('span');
      pts.className = 'pts';
      pts.textContent = String(row.score);
      li.append(rank, who, pts);
      boardEl.appendChild(li);
    });
  }

  function hideOverlay() {
    overlay.classList.remove('show');
    nameInput.blur();
  }

  window.PokeCatch = {
    showResults: function (data) {
      lastScore.value = data.score;
      endScore.textContent = String(data.score);
      endCount.textContent = String(data.caught);
      // Read the board *before* this run is saved, so "new high score" means
      // "beat everything that was already there".
      const bestBefore = loadState().board.reduce((m, e) => Math.max(m, e.score), 0);
      const isRecord = data.score > 0 && data.score > bestBefore;
      endRecord.classList.toggle('show', isRecord);
      endRecord.textContent = isRecord
        ? (bestBefore > 0 ? 'New high score! (was ' + bestBefore + ')' : 'First score on the board!')
        : '';
      endNew.textContent = data.newNames && data.newNames.length
        ? 'New in your Pokédex: ' + data.newNames.join(', ')
        : '';

      const st = loadState();
      const lowest = st.board.length < CFG.maxBoard ? -1 : st.board[st.board.length - 1].score;
      const qualifies = data.score > 0 && data.score >= lowest;

      nameForm.style.display = qualifies ? '' : 'none';
      // The last player's name is a *placeholder*: the field starts empty and
      // saving with it untouched reuses that name.
      nameInput.value = '';
      nameInput.placeholder = (localStorage.getItem('pokecatch.lastname') || 'Your name').slice(0, 10);
      renderBoard(null);

      overlay.classList.add('show');
      if (qualifies) {
        setTimeout(() => { nameInput.focus(); nameInput.select(); }, 80);
      }
    },
    startGame: function () {
      hideOverlay();
      if (!game) return;
      game.scene.stop('Menu');
      game.scene.stop('Dex');
      game.scene.stop('Game');
      game.scene.start('Game');
    },
    toMenu: function () {
      hideOverlay();
      if (!game) return;
      game.scene.stop('Game');
      game.scene.stop('Dex');
      game.scene.start('Menu');
    },
    debug: function () {
      const s = game && game.scene.getScene('Game');
      if (!s || !s.scene.isActive()) return { active: false };
      return {
        active: true,
        score: s.score,
        caught: s.caughtCount,
        timeLeft: s.timeLeft,
        ballState: s.ballState,
        onScreen: s.pokemon.length,
        dex: s.dex.length,
        state: s.ballState === 'done' ? 'done' : 'running'
      };
    },
    // Where would you pull to hit a Pokémon? Uses the cheapest arc that
    // lands on it, so the ball always arrives with power to spare.
    aimAt: function (index) {
      const s = game && game.scene.getScene('Game');
      if (!s || !s.pokemon.length) return null;
      const live = s.pokemon.filter(p => !p.caught && p.box.active);
      const pk = live[index || 0];
      if (!pk) return null;
      return s.aimPointFor(pk);
    },
    // test helper: throw at a Pokémon through the exact same path a drag uses
    autoThrow: function (index) {
      const s = game && game.scene.getScene('Game');
      const aim = this.aimAt(index);
      if (!s || !aim || s.ballState !== 'idle') return false;
      s.ballState = 'aiming';
      s.aim = { x: aim.x, y: aim.y };
      s.throwBall(s.pullVector(s.aim));
      return true;
    }
  };

  nameForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const typed = nameInput.value.trim();
    const remembered = (localStorage.getItem('pokecatch.lastname') || '').trim();
    const name = (typed || remembered || 'PLAYER').toUpperCase().slice(0, 10) || 'PLAYER';
    localStorage.setItem('pokecatch.lastname', name);
    const st = addScore(name, lastScore.value);
    nameForm.style.display = 'none';
    endNew.textContent = 'Saved as ' + name + '!';
    renderBoard({ name: name, score: lastScore.value });
  });

  document.getElementById('againBtn').addEventListener('click', () => window.PokeCatch.startGame());
  document.getElementById('menuBtn').addEventListener('click', () => window.PokeCatch.toMenu());
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('show')) window.PokeCatch.toMenu();
  });

  // ------------------------------------------------------------- fullscreen
  // iPhone Safari has no Fullscreen API at all, and iPad Safari has it but can
  // refuse. A button that silently does nothing is the worst answer, so when
  // the API is missing the same button explains how to get a chrome-less game:
  // Add to Home Screen. Launched that way the page reports standalone, and the
  // apple-mobile-web-app-capable tags in the head do the rest.
  (function () {
    const el = document.documentElement;
    const btn = document.getElementById('fsBtn');
    const help = document.getElementById('fsHelp');
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

    const openHelp = () => { help.classList.add('show'); };
    const closeHelp = () => { help.classList.remove('show'); };

    if (standalone) {
      // already takes the whole screen: nothing to toggle
      btn.hidden = true;
    } else if (!req) {
      btn.textContent = isIOS ? 'Full screen?' : 'Fullscreen';
      btn.setAttribute('aria-label', 'How to play fullscreen');
    }

    btn.addEventListener('click', function () {
      const shown = document.fullscreenElement || document.webkitFullscreenElement;
      if (shown) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) exit.call(document);
        return;
      }
      if (!req) { openHelp(); return; }
      try {
        const out = req.call(el);
        if (out && out.catch) out.catch(openHelp);
      } catch (e) { openHelp(); }
    });

    document.getElementById('fsHelpClose').addEventListener('click', closeHelp);
    help.addEventListener('click', (e) => { if (e.target === help) closeHelp(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeHelp(); });
  })();

  // ------------------------------------------------------------ launch it
  const config = {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#8ecbe8',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: W,
      height: H
    },
    render: { antialias: true, roundPixels: false },
    scene: [BootScene, MenuScene, DexScene, DexEntryScene, GameScene]
  };

  function start() {
    game = new Phaser.Game(config);
    window.__pcGame = game;
  }

  // make sure the chunky font is ready before Phaser measures any text
  const fontsReady = document.fonts && document.fonts.load
    ? document.fonts.load('bold 32px Fredoka').catch(() => {})
    : Promise.resolve();
  fontsReady.then(() => {
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(start);
    else start();
  });

})();
