import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/** 見出し末尾の「（仮説, n=8）」「（仮説）」を検出する。パーサー側では外さないので表示側で分ける */
const HYPOTHESIS = /(仮説[^）)]*)/;

function HeadingText({ children }: { children: React.ReactNode }) {
  const text = typeof children === "string" ? children : null;
  if (!text) return <>{children}</>;
  const m = HYPOTHESIS.exec(text);
  if (!m) return <>{text}</>;
  const before = text.slice(0, m.index).trim();
  return (
    <>
      {before}
      <span className="ml-2 inline-block rounded-chip bg-caution/20 px-2 py-0.5 align-middle text-xs font-normal text-caution">
        {m[1]}
      </span>
    </>
  );
}

const components: Components = {
  h1: ({ children }) => (
    <h3 className="text-base font-bold">
      <HeadingText>{children}</HeadingText>
    </h3>
  ),
  h2: ({ children }) => (
    <h3 className="text-base font-bold">
      <HeadingText>{children}</HeadingText>
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="mt-3 text-sm font-bold first:mt-0">
      <HeadingText>{children}</HeadingText>
    </h4>
  ),
  h4: ({ children }) => (
    <h5 className="mt-2 text-sm font-bold first:mt-0">
      <HeadingText>{children}</HeadingText>
    </h5>
  ),
  p: ({ children }) => (
    <p className="text-sm text-ink-sub">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-bold text-ink">{children}</strong>
  ),
  ul: ({ children }) => (
    <ul className="list-disc space-y-1 pl-5 text-sm text-ink-sub">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-sub">
      {children}
    </ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  table: ({ children }) => (
    <div className="overflow-x-auto rounded-btn border border-line">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-surface text-xs text-ink-mute">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border-b border-line px-3 py-2 text-left font-bold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="num border-b border-line px-3 py-2 text-ink-sub">
      {children}
    </td>
  ),
  code: ({ children }) => (
    <code className="rounded bg-tag px-1 py-0.5 font-mono text-xs">
      {children}
    </code>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-accent-link underline"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="border-line" />,
};

/**
 * AIの回答（Markdown）を、アプリのダークテーマに合わせて描画する。
 * 太字・表・見出し階層・ネストした箇条書きを崩さずに表示するための共通部品。
 */
export function MarkdownBlock({ children }: { children: string }) {
  return (
    <div className="space-y-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
