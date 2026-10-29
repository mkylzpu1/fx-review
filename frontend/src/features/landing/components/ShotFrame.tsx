/** 実アプリの画面のスクリーンショット（public/lp に置いた画像）を、枠つきで見せる */
export function ShotFrame({
  name,
  alt,
  width,
  height,
}: {
  name: string;
  alt: string;
  width: number;
  height: number;
}) {
  return (
    <figure className="lp-win lp-shot">
      <img
        src={`${import.meta.env.BASE_URL}shots/${name}.webp`}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        className="block h-auto w-full"
      />
      <figcaption className="border-t border-line px-4 py-2 text-[11px] text-ink-mute">
        実際の画面です（表示している数字は、使用中のデータです）
      </figcaption>
    </figure>
  );
}
