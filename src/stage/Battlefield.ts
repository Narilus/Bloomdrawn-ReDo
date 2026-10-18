import { Application, Assets, Container, FillGradient, Graphics, Sprite, Texture } from 'pixi.js';
import { createStreams, nextFloat, PARTY, type CombatState, type EngineEvent } from '../engine/index.ts';
import { Actor } from './Actor.ts';
import { battleArt } from './art.ts';
import { downscale, sharpen, type Pixels } from './resample.ts';
import { ENEMY_HEIGHT, ENEMY_HOMES, HEIGHT, PARTY_HEIGHT, PARTY_HOMES, WIDTH, type Fit } from './layout.ts';

const COLOURS = {
  damage: '#F6E6DC',
  shield: '#D6B8E8',
};

/**
 * The PixiJS battlefield. It never decides anything: it builds actors from the state it is
 * given and replays engine events as animation through a small event-to-animation map.
 */
export class Battlefield {
  private readonly actors = new Map<string, Actor>();
  private readonly sprites: SizedSprite[] = [];

  static async create(app: Application, state: CombatState): Promise<Battlefield> {
    const field = new Battlefield();
    await document.fonts.load('800 54px "Nunito Sans"');
    const textures = await Promise.all(
      state.members.map((m) => (battleArt[m.character] ? Assets.load<Texture>(battleArt[m.character] as string) : undefined)),
    );

    const cosmetic = createStreams(7, ['idle']);
    const breath = () => ({ duration: 2.8 + nextFloat(cosmetic, 'idle') * 0.9, delay: nextFloat(cosmetic, 'idle') * 1.5 });
    const world = new Container();
    app.stage.addChild(backdrop(), world);

    // Party: back slot first so the front slot is drawn last and hides no one.
    for (let slot = state.members.length - 1; slot >= 0; slot--) {
      const member = state.members[slot];
      const home = PARTY_HOMES[slot];
      if (!member || !home) continue;
      const texture = textures[slot];
      const body = texture ? field.sizedSprite(texture, PARTY_HEIGHT * home.scale) : silhouette();
      world.addChild(shadow(home.x, home.y, 120 * home.scale));
      const actor = new Actor(member.id, home, body, PARTY_HEIGHT, home.scale, breath());
      world.addChild(actor.root);
      field.actors.set(member.id, actor);
    }

    state.enemies.forEach((enemy, slot) => {
      const home = ENEMY_HOMES[slot];
      if (!home) return;
      world.addChild(shadow(home.x, home.y, 100));
      const actor = new Actor(enemy.id, home, trainingDummy(slot), ENEMY_HEIGHT, 1, breath());
      if (enemy.hp <= 0) actor.root.alpha = 0;
      world.addChild(actor.root);
      field.actors.set(enemy.id, actor);
    });
    return field;
  }

  /**
   * Re-renders each sprite at the device-pixel size it is drawn at. Source art is much larger
   * than the screen, and the GPU's own downscale is either aliased (bilinear) or soft (mipmaps);
   * one high-quality resample per size keeps sprites crisp at any window size or pixel ratio.
   */
  fitTo(fit: Fit): void {
    for (const entry of this.sprites) {
      const height = Math.max(1, Math.round(entry.height * fit.scale * fit.dpr));
      if (entry.sprite.texture.height === height) continue;
      const previous = entry.sprite.texture;
      entry.pixels ??= pixelsOf(entry.source);
      entry.sprite.texture = entry.pixels ? resample(entry.pixels, height) : entry.source;
      if (previous !== entry.source) previous.destroy(true);
      // The actor's depth scale is applied by the actor, so undo it here.
      entry.sprite.scale.set(entry.height / entry.depth / height);
    }
  }

  private sizedSprite(source: Texture, height: number): Sprite {
    const sprite = new Sprite(source);
    sprite.anchor.set(0.5, 0.97);
    sprite.scale.set(PARTY_HEIGHT / source.height);
    this.sprites.push({ sprite, source, height, depth: height / PARTY_HEIGHT });
    return sprite;
  }

  /** Animates one command's events. Results are already final; this only shows them. */
  play(events: readonly EngineEvent[]): void {
    let impact = 0;
    for (const event of events) {
      switch (event.type) {
        case 'cardPlayed': {
          const actor = this.actor(event.source);
          const target = this.actor(event.target);
          impact = actor ? actor.lunge(target?.home, 1) : 0;
          break;
        }
        case 'damageDealt': {
          const hpLoss = (event.amount ?? 0) - (event.absorbed ?? 0);
          for (const target of this.targets(event.target)) {
            target.recoil(event.target === PARTY ? -1 : 1, impact);
            if (event.absorbed) target.popup(`−${event.absorbed}`, COLOURS.shield, impact);
            target.popup(String(hpLoss), COLOURS.damage, impact);
          }
          break;
        }
        case 'shieldGained': {
          const [holder] = this.targets(event.target);
          holder?.popup(`+${event.amount ?? 0}`, COLOURS.shield, impact);
          break;
        }
        case 'enemyDefeated':
          this.actor(event.target)?.fall(impact);
          break;
        default:
          break;
      }
    }
  }

  /** Every actor's position against its home point (used by the settle check). */
  snapshot() {
    return [...this.actors.values()].map((a) => a.snapshot());
  }

  destroy(): void {
    for (const { sprite, source } of this.sprites) if (sprite.texture !== source) sprite.texture.destroy(true);
    for (const actor of this.actors.values()) actor.destroy();
    this.actors.clear();
  }

  private actor(id: string | undefined): Actor | undefined {
    return id === undefined ? undefined : this.actors.get(id);
  }

  /** The party as a target is its front member; otherwise the named actor. */
  private targets(id: string | undefined): Actor[] {
    if (id === PARTY) {
      const front = this.actors.get('m0');
      return front ? [front] : [];
    }
    const actor = this.actor(id);
    return actor ? [actor] : [];
  }
}

interface SizedSprite {
  sprite: Sprite;
  source: Texture;
  /** Logical on-screen height, including the actor's depth scale. */
  height: number;
  depth: number;
  /** The full-size source pixels, read once. */
  pixels?: Pixels | null;
}

/** How hard to sharpen after downscaling: enough to restore edges, short of ringing. */
const SHARPEN = 0.7;

function pixelsOf(source: Texture): Pixels | null {
  const image = source.source.resource as CanvasImageSource & { width: number; height: number };
  const context = canvasOf(image.width, image.height);
  if (!context) return null;
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, image.width, image.height);
}

function resample(pixels: Pixels, height: number): Texture {
  const width = Math.max(1, Math.round((pixels.width * height) / pixels.height));
  const small = height < pixels.height ? sharpen(downscale(pixels, width, height), SHARPEN) : pixels;
  const context = canvasOf(small.width, small.height);
  context?.putImageData(new ImageData(new Uint8ClampedArray(small.data), small.width, small.height), 0, 0);
  return Texture.from(context?.canvas ?? document.createElement('canvas'));
}

function canvasOf(width: number, height: number): CanvasRenderingContext2D | null {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas.getContext('2d', { willReadFrequently: true });
}

function shadow(x: number, y: number, radius: number): Graphics {
  return new Graphics().ellipse(x, y, radius, radius * 0.22).fill({ color: '#120C10', alpha: 0.45 });
}

/** Placeholder for a character without art: a travelling-coat silhouette with a gold rim. */
function silhouette(): Container {
  const g = new Graphics();
  g.moveTo(-70, 0).lineTo(-52, -230).lineTo(-40, -290).lineTo(40, -290).lineTo(52, -230).lineTo(78, 0).closePath();
  g.circle(0, -325, 34);
  g.fill({ color: '#5A3A4E', alpha: 0.95 }).stroke({ color: '#B8955A', width: 3, alpha: 0.7 });
  g.rect(48, -150, 34, 6).fill({ color: '#B8955A', alpha: 0.8 });
  g.moveTo(65, -150).lineTo(65, -120).stroke({ color: '#B8955A', width: 3, alpha: 0.8 });
  return g;
}

/** Placeholder enemy: a straw training dummy with a skin-petal flower on its head. */
function trainingDummy(slot: number): Container {
  const g = new Graphics();
  const lean = (slot - 1) * 0.04;
  g.rect(-9, -230, 18, 230).fill('#4A3628');
  g.roundRect(-82, -195, 164, 16, 6).fill('#5A4230');
  g.roundRect(-56, -210, 112, 130, 34).fill('#8A6A70').stroke({ color: '#5A3A4E', width: 4 });
  for (let i = 0; i < 4; i++) g.moveTo(-40 + i * 26, -195).lineTo(-40 + i * 26, -95).stroke({ color: '#6E4E58', width: 2 });
  g.circle(0, -250, 40).fill('#9A7A80').stroke({ color: '#5A3A4E', width: 4 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.ellipse(Math.cos(a) * 26, -268 + Math.sin(a) * 26, 18, 12).fill('#F2C4C4').stroke({ color: '#F6E6DC', width: 2 });
  }
  g.circle(0, -268, 11).fill('#8E2C3A');
  g.rotation = lean;
  return g;
}

function backdrop(): Container {
  const layer = new Container();
  const sky = new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: '#2E1E2A' },
      { offset: 0.5, color: '#3D2838' },
      { offset: 1, color: '#1E1519' },
    ],
  });
  layer.addChild(new Graphics().rect(0, 0, WIDTH, HEIGHT).fill(sky));

  // Gothic arches: a darker recess with a lit rim.
  const arches = new Graphics();
  for (const x of [380, 960, 1540]) {
    arches.moveTo(x - 190, 560).lineTo(x - 190, 300).arc(x, 300, 190, Math.PI, 0).lineTo(x + 190, 560).closePath();
  }
  arches.fill({ color: '#1E1519', alpha: 0.45 }).stroke({ color: '#6E4A62', width: 14, alpha: 0.8 });
  layer.addChild(arches);

  const floor = new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: '#3A2533' },
      { offset: 1, color: '#1E1519' },
    ],
  });
  layer.addChild(new Graphics().rect(0, 540, WIDTH, HEIGHT - 540).fill(floor));

  for (const [x, y, r] of [
    [600, 640, 520],
    [1480, 600, 460],
  ] as const) {
    const glow = new FillGradient({
      type: 'radial',
      center: { x: 0.5, y: 0.5 },
      innerRadius: 0,
      outerCenter: { x: 0.5, y: 0.5 },
      outerRadius: 0.5,
      colorStops: [
        { offset: 0, color: 'rgba(232,160,168,0.3)' },
        { offset: 1, color: 'rgba(232,160,168,0)' },
      ],
    });
    layer.addChild(new Graphics().ellipse(x, y, r, r * 0.55).fill(glow));
  }

  const vines = new Graphics();
  vines.moveTo(0, 140).bezierCurveTo(300, 60, 520, 260, 820, 170).bezierCurveTo(1100, 90, 1300, 230, 1920, 120);
  vines.moveTo(0, 980).bezierCurveTo(200, 900, 160, 700, 60, 560);
  vines.moveTo(1920, 900).bezierCurveTo(1800, 820, 1860, 640, 1780, 520);
  vines.stroke({ color: '#D9767A', width: 10, alpha: 0.55, cap: 'round' });
  layer.addChild(new Graphics().rect(0, 538, WIDTH, 4).fill({ color: '#6E4A62', alpha: 0.6 }));
  layer.addChild(vines);

  const vignette = new FillGradient({
    type: 'radial',
    center: { x: 0.5, y: 0.5 },
    innerRadius: 0.35,
    outerCenter: { x: 0.5, y: 0.5 },
    outerRadius: 0.8,
    colorStops: [
      { offset: 0, color: 'rgba(30,21,25,0)' },
      { offset: 1, color: 'rgba(18,12,16,0.7)' },
    ],
  });
  layer.addChild(new Graphics().rect(0, 0, WIDTH, HEIGHT).fill(vignette));
  return layer;
}
