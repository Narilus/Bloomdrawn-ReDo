// Art pipeline: generate battle sprite options with `codex exec`, cut them out, and lay them out
// for the owner to pick. Run `npm run art` for usage.
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { cutout, standardise } from './cutout.ts';
import { blank, composite, fill, readPng, scaleArea, scaleNearest, writePng, type Rgba } from './image.ts';
import { composePrompt, promptProblems, stemFrom, type Background } from './prompt.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const CODEX_HOME = process.env.CODEX_HOME ?? join(homedir(), '.codex');
const USAGE = `Usage:
  npm run art -- gen <character> [--n 3] [--bg transparent|blue|green] [--ref <png>]
      Stem from DESIGN.md + art/briefs/<character>.txt -> art/raw/<character>/<character>-NN.png
  npm run art -- cut <raw.png...>
      Background removal and trim -> art/cut/<character>/<name>.png
  npm run art -- sheet <out.png> <cut.png...> [--height 400]
      The cut sprites side by side at in-game height on the stage colour (out: art/cut/<character>-sheet.png)
  npm run art -- pick <raw.png>
      The owner's pick, cut and stored at the standard height -> src/assets/battle/<character>.png`;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      n: { type: 'string', default: '3' },
      bg: { type: 'string', default: 'transparent' },
      ref: { type: 'string' },
      height: { type: 'string', default: '400' },
    },
  });
  const [command, ...rest] = positionals;
  if (command === 'gen' && rest[0]) {
    const background = values.bg as Background;
    if (!['transparent', 'blue', 'green'].includes(background)) throw new Error(`--bg must be transparent, blue or green`);
    await generate(rest[0], Number(values.n), background, values.ref);
  } else if (command === 'cut' && rest.length > 0) {
    for (const file of rest) cut(file);
  } else if (command === 'pick' && rest[0]) {
    pick(rest[0]);
  } else if (command === 'sheet' && rest.length > 1) {
    sheet(rest[0] as string, rest.slice(1), Number(values.height));
  } else {
    console.log(USAGE);
    process.exitCode = 1;
  }
}

async function generate(character: string, count: number, background: Background, reference?: string) {
  if (count < 1 || count > 4) throw new Error('--n must be 1 to 4');
  const stem = stemFrom(readFileSync(join(ROOT, 'docs/DESIGN.md'), 'utf8'), 'Battle sprite stem');
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
  console.log(`Generating ${names.join(', ')} (${background} background${reference ? `, style reference ${reference}` : ''})…`);

  await Promise.all(
    names.map(async (name) => {
      try {
        // A run occasionally ends without calling the image tool; one retry covers it.
        const run = () => codexImage(prompt, background === 'transparent', referencePath);
        const { image, thread } = await run().catch(run);
        copyFileSync(image, join(dir, `${name}.png`));
        const header = [`Background: ${background}`, ...(reference ? [`Reference: ${reference}`] : []), `Codex thread: ${thread}`];
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
function codexImage(prompt: string, transparent: boolean, reference?: string): Promise<{ image: string; thread: string }> {
  const references = reference
    ? `referenced_image_paths = ["${reference}"] (a style reference)`
    : 'no referenced_image_paths and no num_last_images_to_include';
  const instruction = [
    'Make exactly one call to your image generation tool, then stop. Do not edit, copy or create any files.',
    `Arguments: transparent_background = ${transparent}; ${references}; prompt = the text between <prompt> and </prompt> below, verbatim.`,
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

function pick(file: string) {
  save(join(ROOT, 'src/assets/battle', `${basename(dirname(file))}.png`), standardise(cutout(readPng(file))));
}

function save(out: string, image: Rgba) {
  mkdirSync(dirname(out), { recursive: true });
  writePng(out, image);
  console.log(`${relative(ROOT, out)} (${image.width}×${image.height})`);
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
