import type { Tag } from "@/features/settings/types";

interface TagPickerProps {
  label: string;
  tags: Tag[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

/** タグのチップ選択（複数選択可。色だけに頼らず選択中は✓を付ける） */
export function TagPicker({ label, tags, selected, onChange }: TagPickerProps) {
  const toggle = (id: string) =>
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  return (
    <fieldset>
      <legend className="text-xs text-ink-sub">{label}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {tags.map((t) => {
          const on = selected.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(t.id)}
              className={`min-h-touch rounded-full border px-3 text-sm ${
                on
                  ? "border-accent bg-accent/10 text-accent-link"
                  : "border-field text-ink-sub hover:bg-surface"
              }`}
            >
              {on && "✓ "}
              {t.name}
            </button>
          );
        })}
        {tags.length === 0 && (
          <p className="text-sm text-ink-mute">設定でタグを追加できます</p>
        )}
      </div>
    </fieldset>
  );
}
