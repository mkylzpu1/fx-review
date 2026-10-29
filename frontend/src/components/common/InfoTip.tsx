import { useId, useState, type ReactNode } from "react";

/** 見出しの横に置く「?」。ホバー・フォーカス・タップで説明をポップアップする */
export function InfoTip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-field text-[11px] font-bold text-ink-sub hover:bg-surface"
      >
        ?
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-0 top-full z-20 mt-1 w-72 max-w-[80vw] rounded-btn border border-line bg-surface px-3 py-2 text-xs font-normal leading-relaxed text-ink shadow-lg"
        >
          {children}
        </span>
      )}
    </span>
  );
}
