import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useEffectEvent, useState } from 'react';
import { isAlive, previewCard, validate, type CombatState, type EntityId, type Preview, type Registry } from '../engine/index.ts';
import { enemyBox, enemyHeight, enemyHome, PLAY_LINE, type Point } from '../stage/layout.ts';
import { CardView } from './CardView.tsx';
import { AIM_ORIGIN, AIM_POSE, CARD_H, CARD_W, fanPose, type Pose } from './fan.ts';
import { useFrame } from './Frame.tsx';

/**
 * Input modes. Nothing reaches the engine until a command is complete, so every cancel
 * spends nothing.
 *  press  – pointer down on a card, not yet moved: a click if released here
 *  drag   – the card follows the pointer; above the play line it is armed
 *  aim    – a single-target card is armed and waiting for a target; `held` while still dragging
 *  select – an untargeted card chosen by click or key, waiting for confirm
 */
type Mode =
  | { kind: 'idle' }
  | { kind: 'press'; uid: EntityId; start: Point; grab: Point }
  | { kind: 'drag'; uid: EntityId; pointer: Point; grab: Point }
  | { kind: 'aim'; uid: EntityId; pointer: Point | null; target: EntityId | null; held: boolean }
  | { kind: 'select'; uid: EntityId };

export interface Aim {
  card: EntityId;
  target: EntityId | null;
}

interface Props {
  state: CombatState;
  registry: Registry;
  /** Returns false if the engine rejected the command. */
  onPlay: (card: EntityId, target?: EntityId) => boolean;
  /** The card being readied and its target, for previews. */
  onAim: (aim: Aim | null) => void;
}

const IDLE: Mode = { kind: 'idle' };

const flatten = (previews: Preview[]): Preview[] => previews.flatMap((p) => [p, ...(p.resolves === false ? [] : flatten(p.branch ?? []))]);

/**
 * What a card's first damage hit deals on a crit and the chance of one, from the engine's preview
 * against the enemy aimed at, or the first living one (m6-scaling.md, 4.6). Nothing for a card that can't crit.
 */
function critLine(state: CombatState, uid: EntityId, target: EntityId | null, registry: Registry): string | undefined {
  const at = target ?? state.enemies.find(isAlive)?.id;
  const previews = previewCard(state, { type: 'playCard', card: uid, ...(at ? { target: at } : {}) }, registry) ?? previewCard(state, { type: 'playCard', card: uid }, registry);
  const crit = flatten(previews ?? []).find((p) => p.op === 'damage' && p.crit)?.crit;
  return crit ? `Crit: ${crit.amount} (${Number(crit.rate.toFixed(1))}%)` : undefined;
}
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const DRAG_START = 8;

export function Hand({ state, registry, onPlay, onAim }: Props) {
  const { toLogical } = useFrame();
  const [rawMode, setMode] = useState<Mode>(IDLE);
  const [hovered, setHovered] = useState<number | null>(null);
  const hand = state.piles.hand;
  // A card that left the hand (played, discarded) can't stay readied.
  const mode = rawMode.kind !== 'idle' && !hand.some((c) => c.uid === rawMode.uid) ? IDLE : rawMode;

  const living = state.enemies.filter(isAlive);
  const targeted = (uid: EntityId) => {
    const card = hand.find((c) => c.uid === uid);
    return card ? registry.cards[card.card]?.target === 'chosenEnemy' : false;
  };
  const enemyAt = (p: Point): EntityId | null => {
    for (const enemy of state.enemies) {
      const home = enemyHome(enemy.slot, state.enemySlots);
      if (!home || !isAlive(enemy)) continue;
      const box = enemyBox(home, enemyHeight(registry.enemies[enemy.enemy]?.size));
      if (p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h) return enemy.id;
    }
    return null;
  };
  const playable = (uid: EntityId) =>
    validate(state, { type: 'playCard', card: uid, ...(targeted(uid) && living[0] ? { target: living[0].id } : {}) }, registry) ===
    undefined;

  const cast = (uid: EntityId, target?: EntityId) => {
    setMode(IDLE);
    setHovered(null);
    onPlay(uid, target);
  };
  const ready = (uid: EntityId, previousTarget?: EntityId | null) => {
    if (targeted(uid)) {
      const keep = previousTarget && living.some((e) => e.id === previousTarget) ? previousTarget : (living[0]?.id ?? null);
      setMode({ kind: 'aim', uid, pointer: null, target: keep, held: false });
    } else {
      setMode({ kind: 'select', uid });
    }
  };

  // Report the readied card and target for previews (primitives, so pointer moves don't re-fire this).
  const readyCard =
    mode.kind === 'aim' || mode.kind === 'select' || (mode.kind === 'drag' && mode.pointer.y < PLAY_LINE) ? mode.uid : null;
  const readyTarget = mode.kind === 'aim' ? mode.target : null;
  useEffect(() => {
    onAim(readyCard ? { card: readyCard, target: readyTarget } : null);
  }, [readyCard, readyTarget, onAim]);

  // Window listeners, so drags and aims keep working wherever the pointer goes.
  const onMove = useEffectEvent((e: PointerEvent) => {
    const m = mode;
    const p = toLogical(e);
    if (m.kind === 'press') {
      if (Math.hypot(p.x - m.start.x, p.y - m.start.y) > DRAG_START) setMode({ kind: 'drag', uid: m.uid, pointer: p, grab: m.grab });
    } else if (m.kind === 'drag') {
      if (targeted(m.uid) && p.y < PLAY_LINE) setMode({ kind: 'aim', uid: m.uid, pointer: p, target: enemyAt(p), held: true });
      else setMode({ ...m, pointer: p });
    } else if (m.kind === 'aim') {
      if (m.held && p.y > PLAY_LINE + 40) setMode({ kind: 'drag', uid: m.uid, pointer: p, grab: { x: 0, y: 0 } });
      // While held, the target follows the pointer; once sticky, it stays until another enemy is hovered.
      else setMode({ ...m, pointer: p, target: enemyAt(p) ?? (m.held ? null : m.target) });
    }
  });

  const onUp = useEffectEvent((e: PointerEvent) => {
    if (e.button !== 0) return;
    const m = mode;
    const p = toLogical(e);
    if (m.kind === 'press') ready(m.uid);
    else if (m.kind === 'drag') {
      if (p.y < PLAY_LINE) cast(m.uid);
      else setMode(IDLE);
    } else if (m.kind === 'aim' && m.held) {
      if (m.target) cast(m.uid, m.target);
      else setMode({ ...m, held: false });
    }
  });

  // Clicks that didn't land on a card: pick the aimed enemy, or cancel.
  const onDown = useEffectEvent((e: PointerEvent) => {
    if (e.button !== 0) return;
    const m = mode;
    if (m.kind === 'aim' && !m.held) {
      const target = enemyAt(toLogical(e));
      if (target) cast(m.uid, target);
      else setMode(IDLE);
    } else if (m.kind === 'select') {
      setMode(IDLE);
    }
  });

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const m = mode;
    if (e.key === 'Escape') setMode(IDLE);
    else if (KEYS.includes(e.key)) {
      const card = hand[KEYS.indexOf(e.key)];
      if (card) ready(card.uid, m.kind === 'aim' ? m.target : null);
    } else if (e.key === 'Enter') {
      if (m.kind === 'aim' && m.target) cast(m.uid, m.target);
      else if (m.kind === 'select') cast(m.uid);
    } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && m.kind === 'aim' && living.length > 0) {
      const index = living.findIndex((en) => en.id === m.target);
      const step = e.key === 'ArrowRight' ? 1 : -1;
      const next = living[(index + step + living.length) % living.length];
      setMode({ ...m, target: next?.id ?? null });
    }
  });

  useEffect(() => {
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      setMode(IDLE);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('contextmenu', onContext);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('contextmenu', onContext);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const fanHover = mode.kind === 'idle' ? hovered : mode.kind === 'select' ? hand.findIndex((c) => c.uid === mode.uid) : null;

  function poseOf(uid: EntityId, index: number): { pose: Pose; instant: boolean } {
    if (mode.kind === 'drag' && mode.uid === uid) {
      return { pose: { x: mode.pointer.x - mode.grab.x, y: mode.pointer.y - mode.grab.y, rotate: 0, scale: 1.05, z: 200 }, instant: true };
    }
    if (mode.kind === 'aim' && mode.uid === uid) return { pose: AIM_POSE, instant: false };
    return { pose: fanPose(index, hand.length, fanHover), instant: false };
  }

  const armed = (uid: EntityId) =>
    (mode.kind === 'drag' && mode.uid === uid && mode.pointer.y < PLAY_LINE) ||
    (mode.kind === 'aim' && mode.uid === uid) ||
    (mode.kind === 'select' && mode.uid === uid);

  return (
    <>
      {mode.kind === 'aim' && <AimArrow mode={mode} state={state} registry={registry} />}
      <div className="hand">
        <AnimatePresence>
          {hand.map((card, index) => {
            const { pose, instant } = poseOf(card.uid, index);
            const raised = index === fanHover || armed(card.uid);
            const crit = raised ? critLine(state, card.uid, mode.kind === 'aim' ? mode.target : null, registry) : undefined;
            return (
              <motion.div
                key={card.uid}
                className="hand-card"
                data-card={card.card}
                style={{ left: -CARD_W / 2, top: -CARD_H / 2, zIndex: pose.z }}
                initial={{ x: 140, y: 1010, rotate: -25, scale: 0.4, opacity: 0 }}
                animate={{ x: pose.x, y: pose.y, rotate: pose.rotate, scale: pose.scale, opacity: 1 }}
                exit={{ opacity: 0, y: pose.y - 90, scale: pose.scale * 0.9, transition: { duration: 0.22 } }}
                transition={instant ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40, mass: 0.8 }}
                onPointerEnter={() => setHovered(index)}
                onPointerLeave={() => setHovered((h) => (h === index ? null : h))}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  if (mode.kind === 'select' && mode.uid === card.uid) return cast(card.uid);
                  const p = toLogical(e);
                  setMode({ kind: 'press', uid: card.uid, start: p, grab: { x: p.x - pose.x, y: p.y - pose.y } });
                }}
              >
                <CardView
                  card={card}
                  state={state}
                  registry={registry}
                  playable={playable(card.uid)}
                  keyHint={KEYS[index]}
                  highlight={armed(card.uid)}
                />
                {crit && <div className="card-crit">{crit}</div>}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </>
  );
}

function AimArrow({ mode, state, registry }: { mode: Extract<Mode, { kind: 'aim' }>; state: CombatState; registry: Registry }) {
  const target = state.enemies.find((e) => e.id === mode.target);
  const home = target ? enemyHome(target.slot, state.enemySlots) : undefined;
  const end = home && target ? { x: home.x, y: home.y - enemyHeight(registry.enemies[target.enemy]?.size) * 0.55 } : mode.pointer;
  if (!end) return null;
  const start = AIM_ORIGIN;
  const control = { x: (start.x + end.x) / 2, y: Math.min(start.y, end.y) - 160 };
  return (
    <svg className="aim-arrow" viewBox="0 0 1920 1080">
      <path
        d={`M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`}
        className={home ? 'locked' : ''}
        markerEnd="url(#aim-head)"
      />
      <defs>
        <marker id="aim-head" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" />
        </marker>
      </defs>
    </svg>
  );
}
