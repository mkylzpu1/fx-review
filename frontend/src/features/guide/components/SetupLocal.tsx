import { Callout, Code, CodeBlock, Step, StepList } from "./GuideParts";

export const LOCAL_STEPS = ["local-tools", "local-setup", "local-dev"];

/** 1-A. ローカルで起動する */
export function SetupLocal() {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">A. パソコンで起動する</h3>
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
          <p>次の3つを、先にインストールしておきます。</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Node.js（20以上）と npm</li>
            <li>Docker</li>
            <li>AWS SAM CLI</li>
          </ul>
        </Step>
        <Step id="local-setup" no={2} title="初回の準備をする（1回だけ）">
          <p>ターミナルで、アプリのフォルダに移動して実行します。</p>
          <CodeBlock>make setup</CodeBlock>
        </Step>
        <Step id="local-dev" no={3} title="起動して、ブラウザで開く（毎回）">
          <CodeBlock>make dev</CodeBlock>
          <p>
            起動したら、ブラウザで <Code>http://localhost:5173</Code>{" "}
            を開きます。ログインの設定は要りません。
          </p>
          <p className="text-ink-sub">
            止めるときは、ターミナルで <Code>Ctrl + C</Code>、そのあと{" "}
            <Code>make stop</Code>。止める前に、自動でバックアップが取られます。
          </p>
        </Step>
      </StepList>
    </div>
  );
}
