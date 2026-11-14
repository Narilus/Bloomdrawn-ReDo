// The left-hand list the character page and the inventory share (owner, 14 Nov: like the main menu).

/** A vertical list of choices, like the main menu's: the chosen one marked. */
export function SideList<T extends string>({ label, items, chosen, onChoose }: { label: string; items: readonly [T, string][]; chosen: T; onChoose: (key: T) => void }) {
  return (
    <div className="side-list" role="tablist" aria-orientation="vertical" aria-label={label}>
      {items.map(([key, text]) => (
        <button key={key} role="tab" aria-selected={chosen === key} className="side-item" onClick={() => onChoose(key)}>
          {text}
        </button>
      ))}
    </div>
  );
}
