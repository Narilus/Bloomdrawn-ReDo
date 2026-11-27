// Art pipeline: generate battle sprite, weapon icon and battle background options with `codex exec`,
// cut them out, and lay them out for the owner to pick. Run `npm run art` for usage.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { cutout, iconise, standardise } from './cutout.ts';
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
      band<N>-<n> for a band's pool or a Boss's enemy ID without "enemy.")`;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      n: { type: 'string', default: '3' },
      bg: { type: 'string', default: 'transparent' },
      ref: { type: 'string' },
      height: { type: 'string', default: '400' },
      stem: { type: 'string', default: 'battle' },
      icon: { type: 'boolean', default: false },
      scene: { type: 'string' },
      boss: { type: 'string', default: 'hollow-abbess' },
    },
  });
  const [command, ...rest] = positionals;
  if (command === 'gen' && rest[0]) {
    const background = values.bg as Background;
    if (!['transparent', 'blue', 'green'].includes(background)) throw new Error(`--bg must be transparent, blue or green`);
    const stem = STEMS[values.stem as keyof typeof STEMS];
    if (!stem) throw new Error('--stem must be battle, enemy, icon or scene');
    await generate(rest[0], Number(values.n), values.stem === 'scene' ? undefined : background, stem, values.ref);
  } else if (command === 'cut' && rest.length > 0) {
    for (const file of rest) cut(file);
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
const STEMS = { battle: 'Battle sprite stem', enemy: 'Enemy sprite stem', icon: 'Weapon icon stem', scene: 'Prompt stem' } as const;

/** `background` is absent for a scene: opaque and wide. */
async function generate(character: string, count: number, background: Background | undefined, label: string, reference?: string) {
  if (count < 1 || count > 4) throw new Error('--n must be 1 to 4');
  const stem = stemFrom(readFileSync(join(ROOT, 'docs/DESIGN.md'), 'utf8'), label);
  const brief = readFileSync(join(ROOT, 'art/briefs', `${character}.txt`), 'utf8');
  const prompt = composePrompt({ stem, brief, background, styleReference: reference !== undefined });
  const problems = promptProblems(prompt, background);
  if (problems.length > 0) throw new Error(`Prompt refused:\n- ${problems.join('\n- ')}`);
  const referencePath = reference ? join(process.cwd(), reference) : undefined;
  if (referencePath && !existsSync(referencePath)) throw new Error(`No reference image at ${reference}`);

  const dir = join(ROOT, 'art/raw', character);
  mkdirSync(dir, { recursive: true });
  const taken = readdirSync(dir).map((f) => Number(/-(\d+)\.png$/.exec(f)?.[1] ?? 0));
  const first = Math.max(0, ...taken) + 1;
  const names = Array.from({ length: count }, (_, i) => `${character}-${String(first + i).padStart(2, '0')}`);
  console.log(`Generating ${names.join(', ')} (${background ? `${background} background` : 'scene'}${reference ? `, style reference ${reference}` : ''})…`);

  await Promise.all(
    names.map(async (name) => {
      try {
        // A run occasionally ends without calling the image tool; one retry covers it.
        const run = () => codexImage(prompt, background === 'transparent', referencePath, !background);
        const { image, thread } = await run().catch(run);
        copyFileSync(image, join(dir, `${name}.png`));
        const header = [`Background: ${background ?? 'scene'}`, ...(reference ? [`Reference: ${reference}`] : []), `Codex thread: ${thread}`];
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
function codexImage(prompt: string, transparent: boolean, reference?: string, landscape = false): Promise<{ image: string; thread: string }> {
  const references = reference
    ? `referenced_image_paths = ["${reference}"] (a style reference)`
    : 'no referenced_image_paths and no num_last_images_to_include';
  const instruction = [
    'Make exactly one call to your image generation tool, then stop. Do not edit, copy or create any files.',
    `Arguments: transparent_background = ${transparent}; ${references};${landscape ? ' if the tool takes a size or aspect ratio, the widest landscape one (1536x1024);' : ''} prompt = the text between <prompt> and </prompt> below, verbatim.`,
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
