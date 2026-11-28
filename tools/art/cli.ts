// Art pipeline: generate battle sprite, weapon icon and battle background options with `codex exec`,
// cut them out, and lay them out for the owner to pick. Run `npm run art` for usage.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { cutout, iconise, standardise } from './cutout.ts';
import { splitKit, type Kit } from './kit.ts';
import { blank, composite, crop, fill, readPng, scaleArea, scaleBilinear, scaleNearest, shade, writePng, type Rgba } from './image.ts';
import { enemyDepth, enemyHeight, enemyHome, HEIGHT, PARTY_HEIGHT, PARTY_HOMES, WIDTH, type EnemySize } from '../../src/stage/layout.ts';
import { composePrompt, promptProblems, stemFrom, type Background } from './prompt.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const CODEX_HOME = process.env.CODEX_HOME ?? join(homedir(), '.codex');
const USAGE = `Usage:
  npm run art -- gen <character> [--n 3] [--bg transparent|blue|green] [--ref <png>] [--stem battle|enemy|icon|scene]
      Stem from DESIGN.md + art/briefs/<character>.txt -> art/raw/<character>/<character>-NN.png
      (--stem enemy: the enemy sprite stem, for the creatures from Depth 11 down; --stem icon: a weapon icon;
      --stem scene: a battle background, wide and opaque, from the prompt stem)
  npm run art -- gen portrait-<character> --stem portrait --like src/assets/battle/<character>.png [--n 4]
      A square painted bust from art/briefs/portrait-<character>.txt, with her battle sprite attached as the
      likeness to keep (face, hair, costume, colours, props) -> art/raw/portrait-<character>/
  npm run art -- faces <out.png> <character> <png...>
      Each portrait option (or her battle sprite itself) beside her battle sprite: whole, its head square from
      art/heads.json, and as the game shows it: the combat ring (at 2× and 1×) and the card's medallion, raised
      (at 2× and 1×) and in the hand (out: art/cut/portrait-<character>-faces.png)
  npm run art -- stage <out.png> <raw.png...> [--boss hollow-abbess]
      Each background at 1920×1080 with the real sprites at their in-game feet positions: the party with
      three enemies, and the party facing a Boss alone, by default the Hollow Abbess (out: art/cut/<name>-stage.png)
  npm run art -- cut <raw.png...>
      Background removal and trim -> art/cut/<character>/<name>.png
  npm run art -- sheet <out.png> <cut.png...> [--height 400]
      The cut sprites side by side at in-game height on the stage colour (out: art/cut/<character>-sheet.png)
  npm run art -- pick <raw.png> [--icon] [--scene <name>]
      The owner's pick, cut and stored at the standard height -> src/assets/battle/<character>.png
      (--icon: fitted in a square instead -> src/assets/weapons/<weapon>.png;
      --scene: a background, framed to 1920×1080 as WebP -> src/assets/scenes/<name>.webp, where <name> is
      band<N>-<n> for a band's pool or a Boss's enemy ID without "enemy.";
      --portrait <character>: a portrait or battle sprite, cropped to its head square in art/heads.json, 256px as WebP -> src/assets/portraits/<character>.webp;
      --frame <frame>: a frame kit's corner, crest and side -> src/assets/frames/<frame>-<piece>.png;
      --transcend <frame>: a Transcend crest -> src/assets/frames/<frame>-transcend.png)
  npm run art -- gen frame-<frame> --stem ornament [--n 4]
      A card-frame kit (a corner, a crest and a border strip, set apart on a transparent canvas) from
      art/briefs/frame-<frame>.txt and the shared layout in art/briefs/frame-layout.txt -> art/raw/frame-<frame>/
  npm run art -- gen transcend-<frame> --stem ornament --ref art/raw/frame-<frame>/<picked kit>.png [--n 4]
      A Transcend card's raised crest, matched to the picked kit, from art/briefs/transcend-<frame>.txt and
      the shared shape in art/briefs/transcend-layout.txt -> art/raw/transcend-<frame>/
  npm run art -- frames <raw.png...>
      Each kit cut into its pieces, or each Transcend crest cut out (art/cut/frames/<name>/), then shown on
      sample cards in the game's own card gallery, one sheet per frame (out: art/cut/frames-<frame>.png,
      or art/cut/transcend-<frame>.png)
  npm run art -- gen card-<name> --stem card [--n 4]
      Card art from art/briefs/card-<name>.txt, wide and opaque -> art/raw/card-<name>/, where <name> is
      strike-<domain> or defense-<domain> (one picture a Domain), or the card's ID with a dash for the dot
  npm run art -- cards <raw.png...>
      Each card-art option on its card in the game's own card gallery, at the hand's size and raised
      (out: art/cut/card-<name>.png)
  npm run art -- pick <raw.png> --card
      Card art cropped to the art window's shape as WebP -> src/assets/cards/<name>.webp
  npm run art -- gen map-floor-band<N> --stem floor [--n 4]   |   gen map-icon-<kind> --stem mapicon [--n 2]
      A band's Labyrinth floor, square and opaque, from art/briefs/map-floor-band<N>.txt; or a tile's symbol
      (<kind>: fight, elite, boss, event, shop, camp, symptom, collapsing, bloom, entrance) or the party's
      marker (party), on a transparent canvas -> art/raw/map-floor-band<N>/ or art/raw/map-icon-<kind>/
  npm run art -- maptiles <raw.png...>
      Every kind of tile on each floor option, one sheet per band (art/cut/map-floor-band<N>.png), and each
      round of symbol options on a floor (art/cut/map-icons.png), in the game's own map gallery
  npm run art -- pick <raw.png> --map <floor-band<N>|kind|party>
      A floor squared to 1024px as WebP -> src/assets/map/floor-band<N>.webp, or a symbol cut out and
      fitted in a square -> src/assets/map/<kind>.png`;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      n: { type: 'string', default: '3' },
      bg: { type: 'string', default: 'transparent' },
      ref: { type: 'string' },
      like: { type: 'string' },
      portrait: { type: 'string' },
      height: { type: 'string', default: '400' },
      stem: { type: 'string', default: 'battle' },
      icon: { type: 'boolean', default: false },
      scene: { type: 'string' },
      boss: { type: 'string', default: 'hollow-abbess' },
      frame: { type: 'string' },
      transcend: { type: 'string' },
      card: { type: 'boolean', default: false },
      map: { type: 'string' },
    },
  });
  const [command, ...rest] = positionals;
  if (command === 'gen' && rest[0]) {
    const background = values.bg as Background;
    if (!['transparent', 'blue', 'green'].includes(background)) throw new Error(`--bg must be transparent, blue or green`);
    const stem = STEMS[values.stem as keyof typeof STEMS];
    if (!stem) throw new Error('--stem must be battle, enemy, icon, scene, portrait, ornament, card, floor or mapicon');
    if (values.ref && values.like) throw new Error('--ref and --like are different references; give one');
    const shape = values.stem === 'scene' || values.stem === 'card' ? 'landscape' : values.stem === 'portrait' || values.stem === 'ornament' || values.stem === 'floor' ? 'square' : 'sprite';
    // Ornament is a kit of pieces cut apart by their transparency, so it is always transparent.
    const kept = shape === 'sprite' ? background : values.stem === 'ornament' ? 'transparent' : undefined;
    // With the ornament stem, an attached image is the frame kit a new piece joins.
    const refKind = values.stem === 'ornament' ? ('set' as const) : ('style' as const);
    const reference = values.like ? { path: values.like, kind: 'likeness' as const } : values.ref ? { path: values.ref, kind: refKind } : undefined;
    await generate(rest[0], Number(values.n), kept, stem, shape, reference);
  } else if (command === 'cut' && rest.length > 0) {
    for (const file of rest) cut(file);
  } else if (command === 'cards' && rest.length > 0) {
    await cards(rest);
  } else if (command === 'maptiles' && rest.length > 0) {
    await maptiles(rest);
  } else if (command === 'pick' && rest[0] && values.map) {
    pickMap(rest[0], values.map);
  } else if (command === 'pick' && rest[0] && values.card) {
    pickCard(rest[0]);
  } else if (command === 'frames' && rest.length > 0) {
    await frames(rest);
  } else if (command === 'pick' && rest[0] && values.frame) {
    pickFrame(rest[0], values.frame);
  } else if (command === 'pick' && rest[0] && values.transcend) {
    pickTranscend(rest[0], values.transcend);
  } else if (command === 'pick' && rest[0] && values.portrait) {
    pickPortrait(rest[0], values.portrait);
  } else if (command === 'faces' && rest.length > 2) {
    faces(rest[0] as string, rest[1] as string, rest.slice(2));
  } else if (command === 'pick' && rest[0] && values.scene) {
    pickScene(rest[0], values.scene);
  } else if (command === 'pick' && rest[0]) {
    pick(rest[0], values.icon);
  } else if (command === 'stage' && rest.length > 1) {
    stage(rest[0] as string, rest.slice(1), values.boss);
  } else if (command === 'sheet' && rest.length > 1) {
    sheet(rest[0] as string, rest.slice(1), Number(values.height));
  } else {
    console.log(USAGE);
    process.exitCode = 1;
  }
}

/** The DESIGN.md stem each `--stem` names. */
const STEMS = { battle: 'Battle sprite stem', enemy: 'Enemy sprite stem', icon: 'Weapon icon stem', scene: 'Prompt stem', portrait: 'Prompt stem', ornament: 'Ornament stem', card: 'Card art stem', floor: 'Map floor stem', mapicon: 'Map icon stem' } as const;

/** `background` is absent for a scene: opaque and wide. */
type Shape = 'sprite' | 'landscape' | 'square';
interface Reference {
  path: string;
  kind: 'style' | 'likeness' | 'set';
}

async function generate(character: string, count: number, background: Background | undefined, label: string, shape: Shape, reference?: Reference) {
  if (count < 1 || count > 4) throw new Error('--n must be 1 to 4');
  const stem = stemFrom(readFileSync(join(ROOT, 'docs/DESIGN.md'), 'utf8'), label);
  // A frame kit's brief gives its materials and the layout of its three pieces is shared; so is the
  // shape of a Transcend crest (`transcend-<frame>`), the one piece added to a picked frame.
  const shared = label !== 'Ornament stem' ? undefined : character.startsWith('frame-') ? 'frame-layout' : character.startsWith('transcend-') ? 'transcend-layout' : undefined;
  const layout = shared ? `\n\n${readFileSync(join(ROOT, 'art/briefs', `${shared}.txt`), 'utf8')}` : '';
  const brief = readFileSync(join(ROOT, 'art/briefs', `${character}.txt`), 'utf8') + layout;
  const prompt = composePrompt({ stem, brief, background, reference: reference?.kind });
  const problems = promptProblems(prompt, background);
  if (problems.length > 0) throw new Error(`Prompt refused:\n- ${problems.join('\n- ')}`);
  const referencePath = reference ? join(process.cwd(), reference.path) : undefined;
  if (referencePath && !existsSync(referencePath)) throw new Error(`No reference image at ${reference?.path}`);

  const dir = join(ROOT, 'art/raw', character);
  mkdirSync(dir, { recursive: true });
  const taken = readdirSync(dir).map((f) => Number(/-(\d+)\.png$/.exec(f)?.[1] ?? 0));
  const first = Math.max(0, ...taken) + 1;
  const names = Array.from({ length: count }, (_, i) => `${character}-${String(first + i).padStart(2, '0')}`);
  console.log(`Generating ${names.join(', ')} (${background ? `${background} background` : 'scene'}${reference ? `, ${reference.kind} reference ${reference.path}` : ''})…`);

  await Promise.all(
    names.map(async (name) => {
      try {
        // A run occasionally ends without calling the image tool; one retry covers it.
        const run = () => codexImage(prompt, background === 'transparent', shape, referencePath && reference ? { path: referencePath, kind: reference.kind } : undefined);
        const { image, thread } = await run().catch(run);
        copyFileSync(image, join(dir, `${name}.png`));
        const header = [`Background: ${background ?? 'scene'}`, ...(reference ? [`Reference (${reference.kind}): ${reference.path}`] : []), `Codex thread: ${thread}`];
        writeFileSync(join(dir, `${name}.prompt.txt`), `${header.join('\n')}\n\n${prompt}`);
        console.log(`  ${relative(ROOT, join(dir, `${name}.png`))}`);
      } catch (error) {
        console.error(`  ${name} failed: ${(error as Error).message}`);
        process.exitCode = 1;
      }
    }),
  );
}

/**
 * One `codex exec` run that makes one image_gen call. The image is found through the run's own
 * thread ID (generated_images/<thread>/), because the agent's reply can name another run's file
 * when several run at once.
 */
function codexImage(prompt: string, transparent: boolean, shape: Shape, reference?: Reference): Promise<{ image: string; thread: string }> {
  const references = reference
    ? `referenced_image_paths = ["${reference.path}"] (${reference.kind === 'likeness' ? 'the character to portray' : 'a style reference'})`
    : 'no referenced_image_paths and no num_last_images_to_include';
  const size = shape === 'landscape' ? ' if the tool takes a size or aspect ratio, the widest landscape one (1536x1024);' : shape === 'square' ? ' if the tool takes a size or aspect ratio, the square one (1024x1024);' : '';
  const instruction = [
    'Make exactly one call to your image generation tool, then stop. Do not edit, copy or create any files.',
    `Arguments: transparent_background = ${transparent}; ${references};${size} prompt = the text between <prompt> and </prompt> below, verbatim.`,
    `<prompt>\n${prompt}</prompt>`,
  ].join('\n\n');
  return new Promise((resolve, reject) => {
    // stdin must be closed: codex exec reads piped stdin until EOF (CLAUDE.md, Known traps).
    const child = spawn('codex', ['exec', '--json', '-s', 'read-only', '--skip-git-repo-check', instruction], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let thread = '';
    let log = '';
    child.stdout.on('data', (chunk: Buffer) => {
      log += chunk.toString();
      thread ||= /"thread_id":"([^"]+)"/.exec(log)?.[1] ?? '';
    });
    child.stderr.on('data', (chunk: Buffer) => (log += chunk.toString()));
    const timer = setTimeout(() => child.kill(), 15 * 60_000);
    child.on('close', (code) => {
      clearTimeout(timer);
      const folder = join(CODEX_HOME, 'generated_images', thread);
      const png = thread && existsSync(folder) ? readdirSync(folder).find((f) => f.endsWith('.png')) : undefined;
      if (png) resolve({ image: join(folder, png), thread });
      else reject(new Error(`codex exited ${code} without an image.\n${log.slice(-1500)}`));
    });
  });
}

function cut(file: string) {
  const out = join(ROOT, 'art/cut', basename(dirname(file)), basename(file));
  save(out, cutout(readPng(file)));
}

function pick(file: string, icon = false) {
  const name = `${basename(dirname(file))}.png`;
  if (icon) save(join(ROOT, 'src/assets/weapons', name), iconise(cutout(readPng(file))));
  else save(join(ROOT, 'src/assets/battle', name), standardise(cutout(readPng(file))));
}

/** A background framed to 1920×1080 and stored as WebP (a PNG that size is several megabytes). */
function pickScene(file: string, name: string) {
  if (!/^(band\d-\d+|[a-z]+(-[a-z]+)*(-\d+)?)$/.test(name)) throw new Error('--scene must be band<N>-<n>, or a Boss ID such as hollow-abbess, alone or with -<n>');
  const scratch = mkdtempSync(join(tmpdir(), 'scene-'));
  const png = join(scratch, 'frame.png');
  writePng(png, frame(readPng(file)));
  const out = join(ROOT, 'src/assets/scenes', `${name}.webp`);
  mkdirSync(dirname(out), { recursive: true });
  const run = spawnSync('ffmpeg', ['-nostdin', '-y', '-loglevel', 'error', '-i', png, '-c:v', 'libwebp', '-quality', '88', out], { stdio: 'inherit' });
  rmSync(scratch, { recursive: true, force: true });
  if (run.status !== 0) throw new Error('ffmpeg failed');
  console.log(`${relative(ROOT, out)} (from ${relative(ROOT, file)})`);
}

/** Card art cropped from its centre to the art window's shape (14 × 9.3 em) and stored as WebP. */
function pickCard(file: string) {
  const dir = basename(dirname(file));
  const name = /^card-([a-z0-9]+(-[a-z0-9]+)*)$/.exec(dir)?.[1];
  if (!name) throw new Error(`${file} is not card art (art/raw/card-<name>/card-<name>-NN.png)`);
  const image = readPng(file);
  const width = Math.min(image.width, Math.round((image.height * CARD_PICTURE.width) / CARD_PICTURE.height));
  const height = Math.round((width * CARD_PICTURE.height) / CARD_PICTURE.width);
  const cut = scaleArea(crop(image, Math.round((image.width - width) / 2), Math.round((image.height - height) / 2), width, height), CARD_PICTURE.width, CARD_PICTURE.height);
  const scratch = mkdtempSync(join(tmpdir(), 'card-'));
  const png = join(scratch, 'card.png');
  writePng(png, cut);
  const out = join(ROOT, 'src/assets/cards', `${name}.webp`);
  mkdirSync(dirname(out), { recursive: true });
  const run = spawnSync('ffmpeg', ['-nostdin', '-y', '-loglevel', 'error', '-i', png, '-c:v', 'libwebp', '-quality', '88', out], { stdio: 'inherit' });
  rmSync(scratch, { recursive: true, force: true });
  if (run.status !== 0) throw new Error('ffmpeg failed');
  console.log(`${relative(ROOT, out)} (from ${relative(ROOT, file)})`);
}

/** The art window is 14 × 9.3 em; a raised hand card shows it about 270px wide, so this covers 2× screens. */
const CARD_PICTURE = { width: 720, height: 478 };

/** A portrait cropped to its head square (art/heads.json) and stored as WebP, keeping any transparency: the combat ring and the card's medallion show it. */
function pickPortrait(file: string, name: string) {
  if (!/^[a-z]+(-[a-z]+)*$/.test(name)) throw new Error('--portrait must be a character ID such as maelia');
  const head = headCrop(file);
  // A small head (a battle sprite's) is kept at its own size: the browser scales it up more cleanly than a resample with transparency.
  const square = head.width > PORTRAIT ? scaleArea(head, PORTRAIT, PORTRAIT) : head;
  const scratch = mkdtempSync(join(tmpdir(), 'portrait-'));
  const png = join(scratch, 'square.png');
  writePng(png, square);
  const out = join(ROOT, 'src/assets/portraits', `${name}.webp`);
  mkdirSync(dirname(out), { recursive: true });
  const run = spawnSync('ffmpeg', ['-nostdin', '-y', '-loglevel', 'error', '-i', png, '-c:v', 'libwebp', '-quality', '90', out], { stdio: 'inherit' });
  rmSync(scratch, { recursive: true, force: true });
  if (run.status !== 0) throw new Error('ffmpeg failed');
  console.log(`${relative(ROOT, out)} (from ${relative(ROOT, file)})`);
}

/** The raised medallion's face is 116px; this covers it on 2× screens. */
const PORTRAIT = 256;
/** The combat ring (`.portrait-ring` in global.css): 82px with a 5px gold band round a 72px face. */
const RING = 82;
const FACE = 72;
/** The card's medallion (`.card-medal`, 3.3 em with a 0.16 em rim): [outer, face] px in the hand (15px a unit) and raised (×1.3). */
const MEDALS: readonly (readonly [number, number])[] = [
  [128, 116],
  [64, 58],
  [50, 44],
];
const GOLD: [number, number, number] = [184, 149, 90];
/** `--mauve-shadow`, behind the ring's face. */
const MAUVE: [number, number, number] = [90, 58, 78];
/**
 * Each image's head square, [centre x, centre y, side] in its own pixels, keyed by its path from the repo root.
 * The ring and the medallion are small circles, so the head sits in the middle and the weapon and hood may be cut.
 */
function headCrop(file: string): Rgba {
  const heads = JSON.parse(readFileSync(join(ROOT, 'art/heads.json'), 'utf8')) as Record<string, [number, number, number]>;
  const key = relative(ROOT, resolve(file));
  const head = heads[key];
  if (!head) throw new Error(`art/heads.json has no head square for ${key}: add [centre x, centre y, side] in its pixels`);
  const [cx, cy, side] = head;
  return crop(readPng(file), Math.round(cx - side / 2), Math.round(cy - side / 2), side, side);
}

/** `image` over a solid colour, so a cut-out sprite reads as it does on the ring's and medallion's own backing. */
function backed(image: Rgba): Rgba {
  const out = blank(image.width, image.height);
  fill(out, MAUVE);
  composite(out, image, 0, 0);
  return out;
}

/** An opaque square resized to `size`: area-averaged down, bilinear up (a sprite's small head would go blocky). */
function sized(image: Rgba, size: number): Rgba {
  return size > image.width ? scaleBilinear(image, size, size) : scaleArea(image, size, size);
}

/** `image` drawn into a circle of radius r centred at (cx, cy), over whatever is there. */
function disc(canvas: Rgba, image: Rgba, cx: number, cy: number, r: number) {
  const face = sized(image, r * 2);
  for (let y = 0; y < r * 2; y++) {
    for (let x = 0; x < r * 2; x++) {
      if ((x + 0.5 - r) ** 2 + (y + 0.5 - r) ** 2 > r * r) continue;
      const px = cx - r + x;
      const py = cy - r + y;
      if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) continue;
      canvas.data.set(face.data.subarray((y * face.width + x) * 4, (y * face.width + x) * 4 + 4), (py * canvas.width + px) * 4);
    }
  }
}

/** A solid disc of one colour. */
function ring(canvas: Rgba, cx: number, cy: number, r: number) {
  const solid = blank(1, 1);
  solid.data.set([...GOLD, 255]);
  disc(canvas, scaleNearest(solid, 2, 2), cx, cy, r);
}

function faces(out: string, character: string, files: string[]) {
  const sprite = fitHeight(readPng(join(ROOT, 'src/assets/battle', `${character}.png`)), 480);
  const gap = 24;
  const columns = [400, 480, 480, RING * 2, RING, ...MEDALS.map(([outer]) => outer)];
  const width = columns.reduce((sum, w) => sum + w + gap, gap);
  const canvas = blank(width, (480 + gap) * files.length + gap);
  fill(canvas, STAGE);
  files.forEach((file, row) => {
    const top = gap + row * (480 + gap);
    const image = backed(readPng(file));
    const head = backed(headCrop(file));
    let x = gap;
    const cut = sprite.width > columns[0]! ? crop(sprite, Math.round((sprite.width - columns[0]!) / 2), 0, columns[0]!, sprite.height) : sprite;
    composite(canvas, cut, x + Math.round((columns[0]! - cut.width) / 2), top);
    x += columns[0]! + gap;
    // The source, fitted in a square, then its head square.
    const fit = fitHeight(image, 480);
    const whole = fit.width > 480 ? scaleArea(image, 480, Math.round((480 * image.height) / image.width)) : fit;
    composite(canvas, whole, x + Math.round((480 - whole.width) / 2), top + Math.round((480 - whole.height) / 2));
    x += 480 + gap;
    composite(canvas, sized(head, 480), x, top);
    x += 480 + gap;
    const cy = top + 60 + RING;
    // The combat ring at 2× and 1×, then the card's medallion raised at 2× and 1× and in the hand.
    for (const scale of [2, 1]) {
      const cx = x + (RING * scale) / 2;
      ring(canvas, cx, cy, (RING * scale) / 2);
      disc(canvas, head, cx, cy, (FACE * scale) / 2);
      x += RING * scale + gap;
    }
    for (const [outer, inner] of MEDALS) {
      const cx = x + outer / 2;
      ring(canvas, cx, cy, outer / 2);
      disc(canvas, head, cx, cy, inner / 2);
      x += outer + gap;
    }
  });
  save(out, canvas);
}

const PIECES: readonly (keyof Kit)[] = ['corner', 'crest', 'side'];
/** Kits are generated at about 1250px; half that is still sharper than a raised card on a 4K screen. */
const half = (image: Rgba) => scaleArea(image, Math.max(1, Math.round(image.width / 2)), Math.max(1, Math.round(image.height / 2)));

const FRAMES = ['flesh', 'rapture', 'spirit', 'unbound', 'bloom'];

function pickTranscend(file: string, frame: string) {
  if (!FRAMES.includes(frame)) throw new Error('--transcend must be flesh, rapture, spirit, unbound or bloom');
  save(join(ROOT, 'src/assets/frames', `${frame}-transcend.png`), half(cutout(readPng(file))));
}

function pickFrame(file: string, frame: string) {
  if (!FRAMES.includes(frame)) throw new Error('--frame must be flesh, rapture, spirit, unbound or bloom');
  const kit = splitKit(readPng(file));
  for (const piece of PIECES) save(join(ROOT, 'src/assets/frames', `${frame}-${piece}.png`), half(kit[piece]));
}

/** Cuts each kit or crest into art/cut/frames/<name>/, then photographs the dev card gallery with each frame's options. */
async function frames(files: string[]) {
  const groups = new Map<string, string[]>();
  for (const file of files) {
    const name = basename(file, '.png');
    const [, kind, frame] = /^(frame|transcend)-([a-z]+)-\d+$/.exec(name) ?? [];
    if (!kind || !frame) throw new Error(`${file} is neither a frame kit (frame-<frame>-NN.png) nor a Transcend crest (transcend-<frame>-NN.png)`);
    if (kind === 'transcend') save(join(ROOT, 'art/cut/frames', name, 'transcend.png'), half(cutout(readPng(file))));
    else {
      const kit = splitKit(readPng(file));
      for (const piece of PIECES) save(join(ROOT, 'art/cut/frames', name, `${piece}.png`), half(kit[piece]));
    }
    const sheet = `${kind === 'transcend' ? 'transcend' : 'frames'}-${frame}`;
    groups.set(sheet, [...(groups.get(sheet) ?? []), name]);
  }
  await shootGallery([...groups].map(([sheet, names]) => [`cards&kit=${names.join(',')}`, sheet]));
}

/** Shows each card-art option on its card in the dev gallery, one sheet per picture. */
async function cards(files: string[]) {
  const groups = new Map<string, string[]>();
  for (const file of files) {
    const name = basename(file, '.png');
    const dir = /^(card-[a-z0-9-]+)-\d+$/.exec(name)?.[1];
    if (!dir || basename(dirname(file)) !== dir) throw new Error(`${file} is not card art (art/raw/card-<name>/card-<name>-NN.png)`);
    groups.set(dir, [...(groups.get(dir) ?? []), name]);
  }
  await shootGallery([...groups].map(([dir, names]) => [`cards&art=${names.join(',')}`, dir]));
}

/** Photographs the dev card gallery (`?cards&<query>`) into art/cut/<sheet>.png for each pair. */
const MAP_ICONS = ['fight', 'elite', 'boss', 'event', 'shop', 'camp', 'symptom', 'collapsing', 'bloom', 'entrance', 'party'];

/** A map symbol cut out of its canvas and fitted in a square. */
const mapIcon = (file: string) => iconise(cutout(readPng(file)));

/** Floors one sheet per band with every kind of tile on each option, and each round of symbols (all the 01s, all the 02s…) on a floor. */
async function maptiles(files: string[]) {
  const floors = new Map<number, string[]>();
  const icons = new Map<string, string[]>();
  for (const file of files) {
    const name = basename(file, '.png');
    const floor = /^map-floor-band(\d)-\d+$/.exec(name);
    const icon = /^map-icon-([a-z]+)-\d+$/.exec(name);
    if (floor) floors.set(Number(floor[1]), [...(floors.get(Number(floor[1])) ?? []), `/${relative(ROOT, resolve(file))}`]);
    else if (icon && MAP_ICONS.includes(icon[1]!)) {
      const out = join('art/cut', basename(dirname(file)), `${name}.png`);
      save(join(ROOT, out), mapIcon(file));
      icons.set(icon[1]!, [...(icons.get(icon[1]!) ?? []), `/${out}`]);
    } else throw new Error(`${file} is neither a map floor (map-floor-band<N>-NN.png) nor a map symbol (map-icon-<kind>-NN.png)`);
  }
  // The first option of each symbol given, so the floors are judged with symbols on them.
  const firsts = Object.fromEntries([...icons].map(([kind, urls]) => [kind, urls[0]!]));
  const shots: [string, string][] = [];
  const row = (label: string, floor: string | undefined, set: Record<string, string>) => ({ label, ...(floor && { floor }), icons: set });
  for (const [band, urls] of floors) {
    const rows = urls.map((url) => row(basename(url, '.png').replace(/^map-floor-/, ''), url, firsts));
    shots.push([`maptiles&rows=${encodeURIComponent(JSON.stringify(rows))}`, `map-floor-band${band}`]);
  }
  if (icons.size > 0) {
    const floor = [...floors.values()][0]?.[0];
    const rounds = Math.max(...[...icons.values()].map((urls) => urls.length));
    const rows = Array.from({ length: rounds }, (_, i) => {
      const set = Object.fromEntries([...icons].filter(([, urls]) => urls[i]).map(([kind, urls]) => [kind, urls[i]!]));
      return row(`symbols ${String(i + 1).padStart(2, '0')}`, floor, set);
    });
    shots.push([`maptiles&rows=${encodeURIComponent(JSON.stringify(rows))}`, 'map-icons']);
  }
  await shootGallery(shots, '.map-gallery-row');
}

/** The owner's pick of a floor (`floor-band<N>`) or a symbol (a tile kind, or `party`). */
function pickMap(file: string, name: string) {
  const floor = /^floor-band[1-9]$/.test(name);
  if (!floor && !MAP_ICONS.includes(name)) throw new Error(`--map must be floor-band<N> or one of ${MAP_ICONS.join(', ')}`);
  if (!floor) {
    save(join(ROOT, 'src/assets/map', `${name}.png`), mapIcon(file));
    return;
  }
  const image = readPng(file);
  const side = Math.min(image.width, image.height);
  const square = scaleArea(crop(image, Math.round((image.width - side) / 2), Math.round((image.height - side) / 2), side, side), FLOOR, FLOOR);
  const scratch = mkdtempSync(join(tmpdir(), 'floor-'));
  const png = join(scratch, 'floor.png');
  writePng(png, square);
  const out = join(ROOT, 'src/assets/map', `${name}.webp`);
  mkdirSync(dirname(out), { recursive: true });
  const run = spawnSync('ffmpeg', ['-nostdin', '-y', '-loglevel', 'error', '-i', png, '-c:v', 'libwebp', '-quality', '88', out], { stdio: 'inherit' });
  rmSync(scratch, { recursive: true, force: true });
  if (run.status !== 0) throw new Error('ffmpeg failed');
  console.log(`${relative(ROOT, out)} (from ${relative(ROOT, file)})`);
}

/** A floor is drawn about 440px across (4.5 hexes); 1024 covers 2× screens. */
const FLOOR = 1024;

/** Each query (`cards&…`, `maptiles&…`) photographed from the dev build's gallery once `ready` shows, into art/cut/<sheet>.png. */
async function shootGallery(shots: [query: string, sheet: string][], ready = '.card-gallery-option') {
  const port = 5181;
  const server = spawn(process.execPath, [join(ROOT, 'node_modules/vite/bin/vite.js'), '--port', String(port), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  try {
    const url = `http://localhost:${port}/`;
    for (let tries = 0; ; tries++) {
      if (await fetch(url).then((r) => r.ok, () => false)) break;
      if (tries > 100) throw new Error('the dev server did not start');
      await new Promise((r) => setTimeout(r, 200));
    }
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist'] });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    for (const [query, sheet] of shots) {
      await page.goto(`${url}?${query}`);
      await page.waitForSelector(ready);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(300);
      const out = join(ROOT, 'art/cut', `${sheet}.png`);
      await page.screenshot({ path: out });
      console.log(relative(ROOT, out));
    }
    await browser.close();
  } finally {
    server.kill();
  }
}

function save(out: string, image: Rgba) {
  mkdirSync(dirname(out), { recursive: true });
  writePng(out, image);
  console.log(`${relative(ROOT, out)} (${image.width}×${image.height})`);
}

/** A background cropped to 16:9 from its centre and brought to the 1920×1080 frame. */
export function frame(image: Rgba): Rgba {
  const width = Math.min(image.width, Math.round((image.height * WIDTH) / HEIGHT));
  const height = Math.round((width * HEIGHT) / WIDTH);
  const cut = crop(image, Math.round((image.width - width) / 2), Math.round((image.height - height) / 2), width, height);
  return width >= WIDTH ? scaleArea(cut, WIDTH, HEIGHT) : scaleBilinear(cut, WIDTH, HEIGHT);
}

const SHADOW: [number, number, number] = [18, 12, 16];
/** The starters, front to back, and the enemies each preview stands against a background. */
const PARTY = ['maelia', 'agathe', 'anthe', 'leonora'];
const lineups = (boss: string): readonly (readonly [string, EnemySize | undefined][])[] => [
  [['hound-mother', 'large'], ['garden-husk', undefined], ['petal-horror', undefined]],
  [[boss, 'huge']],
];

/** One actor as the battlefield draws it: a shadow at the feet, the sprite anchored 97% down. */
function place(canvas: Rgba, name: string, x: number, y: number, height: number, shadowRadius: number) {
  shade(canvas, x, y, shadowRadius, shadowRadius * 0.22, SHADOW, 0.45);
  const sprite = fitHeight(readPng(join(ROOT, 'src/assets/battle', `${name}.png`)), Math.round(height));
  composite(canvas, sprite, Math.round(x - sprite.width / 2), Math.round(y - sprite.height * 0.97));
}

function stage(out: string, files: string[], boss: string) {
  const shots = files.flatMap((file) => {
    const scene = frame(readPng(file));
    return lineups(boss).map((enemies) => {
      const canvas = { ...scene, data: new Uint8Array(scene.data) };
      // Back to front, as the battlefield draws them.
      for (let slot = PARTY.length - 1; slot >= 0; slot--) {
        const home = PARTY_HOMES[slot]!;
        place(canvas, PARTY[slot]!, home.x, home.y, PARTY_HEIGHT * home.scale, 120 * home.scale);
      }
      const placed = enemies.map(([name, size], slot) => ({ name, size, home: enemyHome(slot, enemies.length)! }));
      for (const { name, size, home } of placed.sort((a, b) => enemyDepth(a.home, a.size) - enemyDepth(b.home, b.size))) place(canvas, name, home.x, home.y, enemyHeight(size), enemyHeight(size) * 0.5);
      return canvas;
    });
  });
  // Each background is a row: three enemies, then a Boss, at half size.
  const half = (image: Rgba) => scaleArea(image, WIDTH / 2, HEIGHT / 2);
  const gap = 24;
  const canvas = blank(WIDTH + gap * 3, (HEIGHT / 2 + gap) * files.length + gap);
  fill(canvas, STAGE);
  shots.forEach((shot, i) => composite(canvas, half(shot), gap + (i % 2) * (WIDTH / 2 + gap), gap + Math.floor(i / 2) * (HEIGHT / 2 + gap)));
  save(out, canvas);
}

/** Stage colour behind the party (the backdrop's mid plum). */
const STAGE: [number, number, number] = [42, 31, 46];

function sheet(out: string, files: string[], height: number) {
  const sprites = files.map((file) => fitHeight(readPng(file), height));
  const gap = 40;
  const width = sprites.reduce((sum, s) => sum + s.width + gap, gap);
  const canvas = blank(width, height + gap * 2);
  fill(canvas, STAGE);
  let x = gap;
  for (const sprite of sprites) {
    composite(canvas, sprite, x, gap);
    x += sprite.width + gap;
  }
  writePng(out, canvas);
  console.log(`${out} (${canvas.width}×${canvas.height})`);
}

/** Scales to the in-game height: nearest-neighbour when enlarging pixel art, area-average when shrinking. */
function fitHeight(image: Rgba, height: number): Rgba {
  const width = Math.round((image.width * height) / image.height);
  return height > image.height ? scaleNearest(image, width, height) : scaleArea(image, width, height);
}

await main();
