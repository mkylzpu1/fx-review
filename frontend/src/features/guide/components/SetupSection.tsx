import { GuideSection } from "./GuideParts";
import { SetupCloudflare } from "./SetupCloudflare";
import { LOCAL_STEPS, SetupLocal } from "./SetupLocal";
import { MT5_STEPS, SetupMt5 } from "./SetupMt5";

/** 1. セットアップ: ローカル起動 → MT5 → Cloudflare（任意） */
export function SetupSection() {
  return (
    <GuideSection
      id="setup"
      eyebrow="STEP 1"
      title="セットアップ"
      lead="最初に1回だけ行います。A・Bは必須、Cは「公開してURLを作る」を使う人だけです。上から順に、できたら「できた」を押していきましょう。"
      stepIds={[...LOCAL_STEPS, ...MT5_STEPS]}
    >
      <SetupLocal />
      <SetupMt5 />
      <SetupCloudflare />
    </GuideSection>
  );
}
