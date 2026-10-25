import { CandleSection } from "../components/CandleSection";
import { SetupSection } from "../components/SetupSection";
import { UsageSection } from "../components/UsageSection";

const TOC = [
  { href: "#setup", label: "1. セットアップ（MT5・Cloudflare・ローカル起動）" },
  { href: "#usage", label: "2. 使い方" },
  { href: "#candles", label: "3. ローソク足の更新" },
];

/** ご利用ガイド: セットアップ・使い方・ローソク足の更新が必要なこと */
export function GuidePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-bold">ご利用ガイド</h1>
        <p className="mt-1 text-sm text-ink-sub">
          はじめに、セットアップと使い方、ローソク足の更新を説明します。このアプリは手元のPCでだけ動かします。
        </p>
      </div>

      <nav aria-label="ガイドの目次" className="card space-y-1 p-4">
        <p className="text-sm font-bold">目次</p>
        <ul className="space-y-1 text-sm">
          {TOC.map((t) => (
            <li key={t.href}>
              <a href={t.href} className="text-accent-link underline">
                {t.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <SetupSection />
      <UsageSection />
      <CandleSection />
    </div>
  );
}
