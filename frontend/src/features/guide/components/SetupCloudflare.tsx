import { Callout, Code, CodeBlock, Step, StepList } from "./GuideParts";

export const CF_STEPS = ["cf-kv", "cf-worker", "cf-token", "cf-env"];

/** 1-C. Cloudflareを設定する（任意） */
export function SetupCloudflare() {
  return (
    <div className="space-y-4">
      <h3 className="text-base font-bold">
        C. Cloudflareを設定する
        <span className="ml-3 rounded-full border border-line px-3 py-0.5 align-middle text-xs font-normal text-ink-sub">
          使う人だけ
        </span>
      </h3>
      <p className="text-sm leading-relaxed text-ink-sub">
        トレード画面の「公開してURLを作る」を使うための設定です。評価用のファイルが、24時間で自動的に消えるURLになります。
        <b className="text-ink">使わないなら、ここは飛ばして大丈夫です。</b>
        他の機能は、設定なしで動きます。無料の範囲で使えます。
      </p>
      <StepList>
        <Step id="cf-kv" no={1} title="Cloudflareに登録して、KVを作る">
          <p>
            無料アカウントを作ります。左のメニュー「Storage &amp; Databases →
            KV」から、
            <Code>fx-review-share</Code> という名前で作り、表示される{" "}
            <b>Namespace ID</b> をメモします。
          </p>
        </Step>
        <Step id="cf-worker" no={2} title="Workerを作って、KVにつなぐ">
          <p>
            「Workers &amp; Pages」で <Code>fx-review-share</Code>{" "}
            というWorkerを作り、アプリの{" "}
            <Code>cloudflare/share-worker/src/index.js</Code>{" "}
            の中身を貼ってデプロイします。
          </p>
          <p>
            Workerの「Settings → Bindings」で、変数名を <Code>SHARES</Code>{" "}
            にして、手順1のKVを選びます。WorkerのURLもメモします。
          </p>
        </Step>
        <Step id="cf-token" no={3} title="APIトークンを作る">
          <p>
            右上のアイコン →「My Profile → API Tokens」で作ります。権限は{" "}
            <b>「Workers KV Storage: 編集」だけ</b>にします。
          </p>
          <p className="text-caution">
            トークンは、作った画面でしか見られません。閉じる前に必ずメモしてください。
          </p>
        </Step>
        <Step id="cf-env" no={4} title="4つの値を、アプリに書く">
          <p>
            <Code>backend/.env.local</Code> に書いて、<Code>make dev</Code>{" "}
            を起動し直します。
          </p>
          <CodeBlock>{`CF_ACCOUNT_ID=（アカウントID）
CF_KV_NAMESPACE_ID=（手順1のID）
CF_API_TOKEN=（手順3のトークン）
SHARE_BASE_URL=（手順2のWorkerのURL）`}</CodeBlock>
          <p>
            起動したときに「評価用の公開: 使えます」と出れば、準備完了です。
          </p>
        </Step>
      </StepList>
      <Callout
        tone="caution"
        title="公開したURLは、知っている人なら誰でも見られます"
      >
        <p>
          ログインはありません。LINEなどで転送されると、誰にでも見られます。人に見せてよい内容か確かめてから公開してください。
        </p>
        <p>APIトークンは、人に見せない・Gitに入れないでください。</p>
      </Callout>
    </div>
  );
}
