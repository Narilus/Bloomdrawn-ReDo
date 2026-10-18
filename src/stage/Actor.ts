import { animate, type AnimationPlaybackControls } from 'motion';
import { Container, Text, type ContainerChild } from 'pixi.js';
import type { Point } from './layout.ts';

/**
 * One battlefield figure. Each motion lives on its own layer so none of them can accumulate:
 *   root    – sits at the fixed home point; lunges animate it and always end at home
 *   recoil  – hit shake, offset from 0
 *   breath  – endless idle scale and bob, pivoting at the feet
 *   body    – the sprite or placeholder art, feet at (0, 0)
 */
export class Actor {
  readonly root = new Container();
  private readonly recoilLayer = new Container();
  private readonly breathLayer = new Container();
  private lungeAnim: AnimationPlaybackControls | undefined;
  private recoilAnim: AnimationPlaybackControls | undefined;
  private readonly breathAnims: AnimationPlaybackControls[] = [];
  private popups = 0;

  constructor(
    readonly id: string,
    readonly home: Point,
    body: ContainerChild,
    /** Height of the body above the feet, for placing numbers. */
    readonly height: number,
    scale: number,
    breath: { duration: number; delay: number },
  ) {
    this.root.position.set(home.x, home.y);
    this.root.scale.set(scale);
    this.breathLayer.addChild(body);
    this.recoilLayer.addChild(this.breathLayer);
    this.root.addChild(this.recoilLayer);

    const loop = { duration: breath.duration, delay: breath.delay, repeat: Infinity, ease: 'easeInOut' as const };
    this.breathAnims.push(
      animate(this.breathLayer.scale, { y: [1, 1.018, 1], x: [1, 0.995, 1] }, loop),
      animate(this.breathLayer, { y: [0, -3, 0] }, loop),
    );
  }

  /**
   * Jumps toward a point and back. Always starts from home; a new lunge cancels the one in flight.
   * Returns the delay in seconds until the moment of impact.
   */
  lunge(toward: Point | undefined, direction: 1 | -1): number {
    this.lungeAnim?.stop();
    this.root.position.set(this.home.x, this.home.y);

    const reach = 95;
    let dx = reach * direction;
    let dy = -10;
    if (toward) {
      const vx = toward.x - this.home.x;
      const vy = toward.y - this.home.y;
      const len = Math.hypot(vx, vy) || 1;
      dx = (vx / len) * reach;
      dy = (vy / len) * reach;
    }
    const { x, y } = this.home;
    this.lungeAnim = animate(
      this.root,
      { x: [x, x + dx, x + dx * 0.9, x], y: [y, y + dy - 22, y + dy, y] },
      { duration: 0.42, times: [0, 0.32, 0.5, 1], ease: ['easeOut', 'linear', 'easeInOut'] },
    );
    return 0.13;
  }

  /** A short shake away from the hit. Restarts from rest if already shaking. */
  recoil(direction: 1 | -1, delay = 0): void {
    this.recoilAnim?.stop();
    this.recoilLayer.position.set(0, 0);
    this.recoilAnim = animate(
      this.recoilLayer,
      { x: [0, 18 * direction, -6 * direction, 0] },
      { duration: 0.32, delay, times: [0, 0.25, 0.6, 1], ease: 'easeOut' },
    );
  }

  /** Floats a number up from above the actor's head. */
  popup(text: string, colour: string, delay = 0): void {
    const label = new Text({
      text,
      style: {
        fontFamily: 'Nunito Sans',
        fontWeight: '800',
        fontSize: 54,
        fill: colour,
        stroke: { color: '#1E1519', width: 7, join: 'round' },
      },
    });
    const parent = this.root.parent;
    if (!parent) return;
    const stagger = this.popups++ % 4;
    label.anchor.set(0.5);
    label.alpha = 0;
    label.position.set(this.home.x + (stagger - 1.5) * 22, this.home.y - this.height * this.root.scale.y * 0.8);
    parent.addChild(label);
    const y0 = label.y;
    animate(label, { alpha: [0, 1, 1, 0], y: [y0 + 10, y0 - 40, y0 - 70, y0 - 90] }, { duration: 1.1, delay, times: [0, 0.15, 0.7, 1] })
      .then(() => {
        label.destroy();
        this.popups = Math.max(0, this.popups - 1);
      });
    animate(label.scale, { x: [0.6, 1.15, 1], y: [0.6, 1.15, 1] }, { duration: 0.3, delay });
  }

  /** Sinks and fades out a defeated actor. */
  fall(delay = 0): void {
    animate(this.root, { alpha: [1, 0] }, { duration: 0.6, delay: delay + 0.25 });
  }

  /** Current offset from home, for the settle check. */
  snapshot() {
    return {
      id: this.id,
      x: this.root.x,
      y: this.root.y,
      homeX: this.home.x,
      homeY: this.home.y,
      recoilX: this.recoilLayer.x,
    };
  }

  destroy(): void {
    this.lungeAnim?.stop();
    this.recoilAnim?.stop();
    for (const a of this.breathAnims) a.stop();
  }
}
