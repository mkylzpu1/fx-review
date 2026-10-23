/** 後続フェーズで実装する画面の仮置き */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="card">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-ink-sub">準備中</p>
    </div>
  );
}
