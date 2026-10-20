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
  /** Every one-off animation still running, so destroy() can stop them before Pixi frees their targets. */
  private readonly running = new Set<AnimationPlaybackControls>();
  private popups = 0;
  /** The ground shadow, drawn under everyone and faded with the actor. */
  shadow: Container | undefined;
  /** When a fade-in finishes (performance.now, seconds), so a fall never starts before it. */
  private shownAt = 0;

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
   * Jumps toward a point and back, after `delay` seconds. Always starts from home; a new lunge
   * cancels the one in flight. Returns the delay in seconds until the moment of impact.
   */
  lunge(toward: Point | undefined, direction: 1 | -1, delay = 0): number {
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
      { duration: 0.42, delay, times: [0, 0.32, 0.5, 1], ease: ['easeOut', 'linear', 'easeInOut'] },
    );
    return delay + 0.13;
  }

  /** A swell and settle for an ultimate. Scales the recoil layer, so it never stacks with breathing. */
  burst(delay = 0): void {
    this.track(animate(this.recoilLayer.scale, { x: [1, 1.14, 0.97, 1], y: [1, 1.14, 0.97, 1] }, { duration: 0.6, delay, times: [0, 0.35, 0.7, 1] }));
  }

  private track(controls: AnimationPlaybackControls): AnimationPlaybackControls {
    this.running.add(controls);
    void controls.finished.then(() => this.running.delete(controls));
    return controls;
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

  /** Floats a number or word up from above the actor's head. */
  popup(text: string, colour: string, delay = 0, size = 54): void {
    const label = new Text({
      text,
      style: {
        fontFamily: 'Nunito Sans',
        fontWeight: '800',
        fontSize: size,
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
    const float = this.track(
      animate(label, { alpha: [0, 1, 1, 0], y: [y0 + 10, y0 - 40, y0 - 70, y0 - 90] }, { duration: 1.1, delay, times: [0, 0.15, 0.7, 1] }),
    );
    void float.finished.then(() => {
      if (!label.destroyed) label.destroy();
      this.popups = Math.max(0, this.popups - 1);
    });
    this.track(animate(label.scale, { x: [0.6, 1.15, 1], y: [0.6, 1.15, 1] }, { duration: 0.3, delay }));
  }

  /** Hides the actor and its shadow at once (an enemy already defeated). */
  hide(): void {
    for (const part of this.parts()) part.alpha = 0;
  }

  /** Fades in a summoned actor. */
  appear(delay = 0): void {
    this.hide();
    for (const part of this.parts()) this.track(animate(part, { alpha: [0, 1] }, { duration: 0.5, delay }));
    this.shownAt = performance.now() / 1000 + delay + 0.5;
  }

  /** Sinks and fades out a defeated actor, after any fade-in still under way. */
  fall(delay = 0): void {
    const start = Math.max(delay + 0.25, this.shownAt - performance.now() / 1000);
    for (const part of this.parts()) this.track(animate(part, { alpha: [1, 0] }, { duration: 0.6, delay: start }));
  }

  private parts(): Container[] {
    return this.shadow ? [this.root, this.shadow] : [this.root];
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
    for (const a of this.running) a.stop();
    this.running.clear();
  }
}
