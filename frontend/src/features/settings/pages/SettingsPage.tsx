import { useEffect, useState } from "react";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { UnsavedChangesGuard } from "@/components/common/UnsavedChangesGuard";
import { toast } from "@/stores/toastStore";
import { AccountRiskSection } from "../components/AccountRiskSection";
import { ChartEmaSection } from "../components/ChartEmaSection";
import { CurrencyPairsSection } from "../components/CurrencyPairsSection";
import { TagsSection } from "../components/TagsSection";
import { DataSection } from "../components/DataSection";
import { useSaveSettings, useSettings } from "../hooks/useSettingsApi";
import { isSameSettings, validateSettings } from "../utils/settingsForm";
import type { AccountSettings } from "../types";

const SECTIONS = [
  { id: "account", label: "口座とリスク" },
  { id: "pairs", label: "通貨ペア" },
  { id: "chart", label: "チャートとEMA" },
  { id: "tags", label: "根拠・感情タグ" },
  { id: "data", label: "データ" },
];

export function SettingsPage() {
  const { data: saved, isLoading, isError, refetch } = useSettings();
  const save = useSaveSettings();
  const [draft, setDraft] = useState<AccountSettings | null>(null);

  useEffect(() => {
    if (saved) setDraft(saved);
  }, [saved]);

  if (isLoading) return <LoadingSpinner fullScreen={false} />;
  if (isError) return <ErrorAlert onRetry={() => void refetch()} />;
  if (!saved || !draft) return null;

  const dirty = !isSameSettings(saved, draft);
  const errors = validateSettings(draft);
  const hasErrors = Object.keys(errors).length > 0;

  const onSave = () =>
    save.mutate(draft, {
      onSuccess: () => toast.success("設定を保存しました"),
      onError: () =>
        toast.error(
          "保存できませんでした。通信を確認して、もう一度試してください。入力内容は残っています。",
        ),
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
      <UnsavedChangesGuard dirty={dirty} />
      <div>
        <h1 className="text-2xl font-bold">設定</h1>
        <nav
          aria-label="設定の項目"
          className="mt-4 hidden flex-col gap-1 lg:flex"
        >
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="flex min-h-touch items-center rounded-btn px-3 text-sm text-ink-sub hover:bg-surface"
            >
              {s.label}
            </a>
          ))}
        </nav>
      </div>
      <div className="space-y-6 pb-24">
        <AccountRiskSection
          value={draft}
          errors={errors}
          onChange={(p) => setDraft({ ...draft, ...p })}
        />
        <CurrencyPairsSection />
        <ChartEmaSection
          value={draft}
          errors={errors}
          onChange={(p) => setDraft({ ...draft, ...p })}
        />
        <TagsSection />
        <DataSection />
      </div>
      {dirty && (
        <div
          role="region"
          aria-label="未保存の変更"
          className="fixed bottom-20 left-1/2 z-20 flex w-[min(60rem,calc(100vw-2rem))] -translate-x-1/2 items-center justify-between gap-3 rounded-card border border-accent bg-card px-4 py-3 lg:bottom-4"
        >
          <span className="text-sm">未保存の変更があります</span>
          <div className="flex gap-2">
            <button className="btn" onClick={() => setDraft(saved)}>
              元に戻す
            </button>
            <button
              className="btn-primary"
              onClick={onSave}
              disabled={hasErrors || save.isPending}
            >
              変更を保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
