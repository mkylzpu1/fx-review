import { Callout, Code, CodeBlock, Step, StepList } from "./GuideParts";

export const LOCAL_STEPS = [
  "local-tools",
  "local-clone",
  "local-setup",
  "local-dev",
];

/** 1-A. ローカルで起動する */
export function SetupLocal() {
  return (
    <div className="space-y-4">
      <h3 className="text-base font-bold">A. パソコンで起動する</h3>
      <Callout title="このアプリは、自分のパソコンの中だけで動かします">
        <p>
          インターネット上には置きません。データベース・画面・MT5のデータを読む部品は、すべて手元で動きます。
        </p>
        <p>
          そのため、
          <b>
            「足を更新」と「公開してURLを作る」は、下の手順で起動した画面でしか使えません。
          </b>
        </p>
      </Callout>
      <StepList>
        <Step id="local-tools" no={1} title="必要なソフトを入れる">
          <p>次の4つを、先にインストールしておきます。</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Git</li>
            <li>Node.js（20以上）と npm</li>
            <li>Docker</li>
            <li>AWS SAM CLI</li>
          </ul>
        </Step>
        <Step
          id="local-clone"
          no={2}
          title="アプリをパソコンにダウンロードする（クローン）"
        >
          <p>
            ターミナルを開いて、アプリを置きたい場所（例:
            書類フォルダ）で実行します。
          </p>
          <CodeBlock>
            git clone https://github.com/mkylzpu1/fx-review.git
          </CodeBlock>
          <p>終わったら、できたフォルダに移動します。</p>
          <CodeBlock>cd fx-review</CodeBlock>
          <p className="text-ink-sub">
            以降のコマンドは、すべてこの <Code>fx-review</Code>{" "}
            フォルダの中で実行します。Git を使わない場合は、GitHub のページの{" "}
            <Code>Code</Code> → <Code>Download ZIP</Code>{" "}
            で取得して解凍し、そのフォルダに移動しても構いません。
          </p>
        </Step>
        <Step id="local-setup" no={3} title="初回の準備をする（1回だけ）">
          <p>同じターミナルで、次を実行します。</p>
          <CodeBlock>make setup</CodeBlock>
        </Step>
        <Step id="local-dev" no={4} title="起動して、ブラウザで開く（毎回）">
          <CodeBlock>make dev</CodeBlock>
          <p>
            起動したら、ブラウザで <Code>http://localhost:5173</Code>{" "}
            を開きます。ログインの設定は要りません。
          </p>
          <p className="text-ink-sub">
            止めるときは、ターミナルで <Code>Ctrl + C</Code>、そのあと{" "}
            <Code>make stop</Code>。止める前に、自動でバックアップが取られます。
            次に使うときは、<Code>fx-review</Code> フォルダに移動して{" "}
            <Code>make dev</Code> だけで起動できます。
          </p>
        </Step>
      </StepList>
    </div>
  );
}
