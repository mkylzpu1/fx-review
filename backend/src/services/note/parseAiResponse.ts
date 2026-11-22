/**
 * 貼り付けられたAIの回答から、改善案を1行ずつ取り出す簡易パース（LLMは呼ばない）。
 * 番号付き行・箇条書きだけを拾い、パースできない部分は原文表示にフォールバックする。
 */
import type { ParsedSection } from "../../types/note";

export interface ParsedImprovement {
  text: string;
  sampleN: number | null;
}

export interface ParsedResponse {
  sections: ParsedSection[];
  improvements: ParsedImprovement[];
}

export const MAX_IMPROVEMENTS = 30;
export const MAX_IMPROVEMENT_CHARS = 300;

// セクション分割は「## 見出し」(レベル2)だけで行う。「### 小見出し」はカード内の
// 小見出しとして raw にそのまま残し、Markdown描画側の見出しに任せる（指示書で ### を指定している）。
const HEADING = /^\s{0,3}#{2}(?!#)\s+(.+?)\s*#*\s*$/;
// 「1.」「1)」「1．」「（1）」「①」と、「-」「*」「・」「•」
const ITEM =
  /^\s*(?:(?:[0-9０-９]{1,2}\s*[.)）．、]|[（(][0-9０-９]{1,2}[)）]|[①-⑳])|[-*・•●○])\s*(.+?)\s*$/;
/** 見出しや節の名前が「改善案」を指すか */
const IMPROVEMENT_HEADING = /改善|ルール|提案|次の|アクション|やること/;

const stripMarkdown = (s: string) =>
  s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();

const toHalfWidthDigits = (s: string) =>
  s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

/** 「n=12」「（12件）」から件数を読む */
export function sampleNOf(text: string): number | null {
  const t = toHalfWidthDigits(text);
  const m =
    /\bn\s*=\s*(\d{1,5})/i.exec(t) ?? /[（(]\s*(\d{1,5})\s*件\s*[)）]/.exec(t);
  return m ? Number(m[1]) : null;
}

/** 回答を見出しごとに分ける。見出しの無い先頭部分は heading が空の節になる */
export function splitSections(raw: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  let current: ParsedSection = { heading: "", lines: [], raw: "" };
  let rawLines: string[] = [];
  const push = () => {
    if (current.heading || current.lines.length > 0) {
      sections.push({ ...current, raw: rawLines.join("\n").trim() });
    }
  };
  for (const line of raw.replace(/\r\n?/g, "\n").split("\n")) {
    const h = HEADING.exec(line);
    if (h) {
      push();
      current = { heading: stripMarkdown(h[1]), lines: [], raw: "" };
      rawLines = [];
    } else if (line.trim() !== "") {
      current.lines.push(line.trim());
      rawLines.push(line);
    } else if (rawLines.length > 0) {
      rawLines.push(""); // 空行は段落・表の区切りとして原文側には残す
    }
  }
  push();
  return sections;
}

function itemsOf(lines: string[]): ParsedImprovement[] {
  const out: ParsedImprovement[] = [];
  for (const line of lines) {
    const m = ITEM.exec(line);
    if (!m) continue;
    const text = stripMarkdown(m[1]);
    if (text.length < 4) continue; // 「はい」などの短い箇条書きは改善案にしない
    out.push({
      text: text.slice(0, MAX_IMPROVEMENT_CHARS),
      sampleN: sampleNOf(text),
    });
  }
  return out;
}

export function parseAiResponse(raw: string): ParsedResponse {
  const sections = splitSections(raw);
  // 「改善」「ルール」「提案」などの見出しの節があれば、そこだけから拾う。無ければ全体から拾う
  const focused = sections.filter((s) => IMPROVEMENT_HEADING.test(s.heading));
  const source = focused.length > 0 ? focused : sections;
  const seen = new Set<string>();
  const improvements = source
    .flatMap((s) => itemsOf(s.lines))
    .filter((i) => (seen.has(i.text) ? false : (seen.add(i.text), true)))
    .slice(0, MAX_IMPROVEMENTS);
  const hasStructure =
    sections.some((s) => s.heading) || improvements.length > 0;
  return { sections: hasStructure ? sections : [], improvements };
}
