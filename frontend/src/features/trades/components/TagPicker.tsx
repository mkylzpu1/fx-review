import { useMemo, useState } from "react";
import type { Tag } from "@/features/settings/types";
import { groupRationaleTags } from "../utils/tagGroups";

interface TagPickerProps {
  label: string;
  tags: Tag[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** 件数が多いタグ（根拠タグなど）はグループ分け＋絞り込みを有効にする */
  groupable?: boolean;
}

function Chip({
  tag,
  on,
  onClick,
}: {
  tag: Tag;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-touch rounded-full border px-3 text-sm ${
        on
          ? "border-accent bg-accent/10 text-accent-link"
          : "border-field text-ink-sub hover:bg-surface"
      }`}
    >
      {on && "✓ "}
      {tag.name}
    </button>
  );
}

/** タグのチップ選択（複数選択可。色だけに頼らず選択中は✓を付ける） */
export function TagPicker({
  label,
  tags,
  selected,
  onChange,
  groupable,
}: TagPickerProps) {
  const [filter, setFilter] = useState("");

  const toggle = (id: string) =>
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );

  const filtered = useMemo(() => {
    if (!filter.trim()) return tags;
    const q = filter.trim();
    return tags.filter((t) => t.name.includes(q));
  }, [tags, filter]);

  // タグ数が多い場合のみ、グループ分け表示＋絞り込み欄を出す
  const useGrouping = groupable && tags.length > 12;
  const groups = useMemo(
    () => (useGrouping ? groupRationaleTags(filtered) : null),
    [useGrouping, filtered],
  );

  return (
    <fieldset>
      <legend className="text-xs text-ink-sub">{label}</legend>

      {useGrouping && (
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="タグを絞り込み"
          aria-label={`${label}を絞り込み`}
          className="input mt-1 font-sans text-sm"
        />
      )}

      {groups ? (
        <div className="mt-2 space-y-3">
          {groups.map((g) => (
            <div key={g.title}>
              <p className="mb-1 text-xs text-ink-mute">{g.title}</p>
              <div className="flex flex-wrap gap-2">
                {g.tags.map((t) => (
                  <Chip
                    key={t.id}
                    tag={t}
                    on={selected.includes(t.id)}
                    onClick={() => toggle(t.id)}
                  />
                ))}
              </div>
            </div>
          ))}
          {groups.length === 0 && (
            <p className="text-sm text-ink-mute">該当するタグがありません</p>
          )}
        </div>
      ) : (
        <div className="mt-1 flex flex-wrap gap-2">
          {filtered.map((t) => (
            <Chip
              key={t.id}
              tag={t}
              on={selected.includes(t.id)}
              onClick={() => toggle(t.id)}
            />
          ))}
        </div>
      )}

      {tags.length === 0 && (
        <p className="text-sm text-ink-mute">設定でタグを追加できます</p>
      )}
    </fieldset>
  );
}
