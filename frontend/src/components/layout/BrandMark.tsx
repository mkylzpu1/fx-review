/** ロゴのマーク。上昇の緑と下降の赤、2本のローソク足 */
export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <g stroke="#6EE7C8">
        <path d="M7 3v3M7 17v4" />
        <rect
          x="4"
          y="6"
          width="6"
          height="11"
          rx="1.5"
          fill="#6EE7C8"
          fillOpacity="0.25"
        />
      </g>
      <g stroke="#FF7A8A">
        <path d="M17 3v5M17 15v6" />
        <rect
          x="14"
          y="8"
          width="6"
          height="7"
          rx="1.5"
          fill="#FF7A8A"
          fillOpacity="0.25"
        />
      </g>
    </svg>
  );
}
