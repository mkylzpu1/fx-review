import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { UnsavedChangesGuard } from "@/components/common/UnsavedChangesGuard";
import { ROUTES } from "@/constants/routes";
import { useRules } from "@/features/rules/hooks/useRulesApi";
import {
  usePairs,
  useSettings,
  useTags,
} from "@/features/settings/hooks/useSettingsApi";
import type { AccountSettings } from "@/features/settings/types";
import { ApiError } from "@/services/apiClient";
import {
  consumeLoginDraft,
  peekLoginDraft,
  registerDraft,
} from "@/features/session/draftStore";
import { useHotkeys } from "@/hooks/useHotkeys";
import { toast } from "@/stores/toastStore";
import { isoToJstInput, SIDE_LABEL, formatJst } from "@/utils/format";
import { ChartPanel } from "../components/ChartPanel";
import { TradeFormBody } from "../components/TradeFormBody";
import { useChartUiStore } from "../chartUiStore";
import {
  findNextUnfilledId,
  useSaveTrade,
  useTrade,
} from "../hooks/useTradesApi";
import { buildPlanPreview } from "../utils/planPreview";
import {
  emptyForm,
  fromTrade,
  isDirty,
  parseNum,
  toPayload,
  validateForm,
  type FormErrors,
  type TradeFormState,
} from "../utils/tradeForm";
import type { Trade } from "../types";

const FIELD_IDS: Record<keyof FormErrors, string> = {
  pair: "pair",
  lots: "lots",
  entryAt: "entry-at",
  entryPrice: "entry-price",
  slPrice: "sl-price",
  tpPrice: "tp-price",
  exitAt: "exit-at",
  exitPrice: "exit-price",
};

const SAVE_ERROR =
  "保存できませんでした。通信を確認して、もう一度試してください。入力内容は残っています。";

/** 新規記録（/trades/new）と、編集・決済入力（/trades/:id/edit）の両方を担当する */
export function TradeFormPage() {
  const { id } = useParams();
  const trade = useTrade(id);
  const settings = useSettings();
  const pairs = usePairs();
  const tags = useTags();
  const rules = useRules();

  const queries = [settings, pairs, tags, rules, ...(id ? [trade] : [])];
  if (queries.some((q) => q.isLoading))
    return <LoadingSpinner fullScreen={false} />;
  if (
    queries.some((q) => q.isError) ||
    !pairs.data ||
    !tags.data ||
    !rules.data
  ) {
    return (
      <ErrorAlert onRetry={() => queries.forEach((q) => void q.refetch())} />
    );
  }
  return (
    <TradeFormInner
      key={trade.data?.id ?? "new"}
      trade={trade.data}
      settings={settings.data ?? undefined}
      pairs={pairs.data}
      tags={tags.data}
      rules={rules.data}
    />
  );
}

type InnerProps = {
  trade?: Trade;
  settings: AccountSettings | undefined;
  pairs: NonNullable<ReturnType<typeof usePairs>["data"]>;
  tags: NonNullable<ReturnType<typeof useTags>["data"]>;
  rules: NonNullable<ReturnType<typeof useRules>["data"]>;
};

function TradeFormInner({ trade, settings, pairs, tags, rules }: InnerProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const save = useSaveTrade(trade?.id);
  const isEdit = !!trade;

  const pickerPairs = pairs.filter(
    (p) => p.showInPicker || p.symbol === trade?.pair,
  );
  const initial = useMemo<TradeFormState>(
    () =>
      trade
        ? fromTrade(trade)
        : emptyForm(
            pickerPairs[0]?.symbol ?? "",
            isoToJstInput(new Date().toISOString()),
          ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trade?.id],
  );
  const draftKey = `trade-form:${trade?.id ?? "new"}`;
  // ログイン切れから戻ったときは、退避しておいた入力を戻す
  const [form, setForm] = useState<TradeFormState>(
    () => peekLoginDraft<TradeFormState>(draftKey) ?? initial,
  );
  useEffect(() => consumeLoginDraft(draftKey), [draftKey]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const exitOpen = useRef(isEdit || !!initial.exitAt).current;

  // 編集中は、フォームとチャートを同じ画面の中で切り替えて見られる（入力はフォームを隠すだけで保たれる）
  const [view, setView] = useState<"form" | "chart">("form");
  const showChart = isEdit && view === "chart";
  const toggleView = () => {
    if (!isEdit) return;
    useChartUiStore.getState().setFullscreen(false);
    setView((v) => (v === "form" ? "chart" : "form"));
  };
  // C: 切り替え（入力欄の中では効かない）。Alt+C は入力欄の中でも効く
  useHotkeys({ c: toggleView }, isEdit);
  const toggleRef = useRef(toggleView);
  toggleRef.current = toggleView;
  useEffect(() => {
    if (!isEdit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || !e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.code !== "KeyC") return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]'))
        return;
      e.preventDefault();
      toggleRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isEdit]);
  // 画面を離れるとき、チャートの全画面を解除する
  useEffect(() => () => useChartUiStore.getState().setFullscreen(false), []);

  const dirty = isDirty(form, initial) && leaveTo === null;
  const formRef = useRef({ form, dirty });
  formRef.current = { form, dirty };
  useEffect(
    () =>
      registerDraft(draftKey, () =>
        formRef.current.dirty ? formRef.current.form : null,
      ),
    [draftKey],
  );
  // 保存後の移動はガードに止められないよう、dirty が外れてから行う
  useEffect(() => {
    if (leaveTo !== null) navigate(leaveTo);
  }, [leaveTo, navigate]);

  const preview = buildPlanPreview(
    form,
    pairs.find((p) => p.symbol === form.pair),
    settings,
    rules,
  );

  const onChange = (patch: Partial<TradeFormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    const touched = Object.keys(patch);
    if (touched.some((k) => k in errors)) {
      setErrors((e) => {
        const next = { ...e };
        touched.forEach((k) => delete next[k as keyof FormErrors]);
        return next;
      });
    }
  };

  /** 検証 → 保存。成功したら保存済みのIDを返す。失敗は null */
  const submit = async (draft: boolean): Promise<string | null> => {
    const found = validateForm(form);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      const first = (Object.keys(found) as (keyof FormErrors)[])[0];
      // チャート表示中はフォームが隠れているので、先にフォームへ戻してからフォーカスする
      setView("form");
      setTimeout(() => document.getElementById(FIELD_IDS[first])?.focus(), 0);
      return null;
    }
    try {
      const saved = await save.mutateAsync(toPayload(form, draft));
      return saved.id;
    } catch (e) {
      toast.error(
        e instanceof ApiError && e.status === 400
          ? `${e.message} 入力内容は残っています。`
          : SAVE_ERROR,
      );
      return null;
    }
  };

  const saveAndOpen = async () => {
    const savedId = await submit(false);
    if (!savedId) return;
    toast.success("保存しました");
    setLeaveTo(ROUTES.TRADE_DETAIL.replace(":id", savedId));
  };

  /** 下書き保存。ガードから呼ばれたときの移動はガード側が行う */
  const saveAsDraft = async (fromGuard = false) => {
    const savedId = await submit(true);
    if (!savedId) return false;
    toast.success("下書きとして保存しました");
    if (!fromGuard) setLeaveTo(ROUTES.TRADES);
    return true;
  };

  const saveAndNext = async () => {
    // 保存するとキューから外れることがあるため、先に「次」を求めておく
    const nextId = trade
      ? await findNextUnfilledId(qc, trade.id).catch(() => null)
      : null;
    const savedId = await submit(false);
    if (!savedId) return;
    if (nextId) {
      toast.success("保存しました。次の未入力トレードを開きます");
      setLeaveTo(ROUTES.TRADE_EDIT.replace(":id", nextId));
    } else {
      toast.success("保存しました。入力のないトレードはもうありません");
      setLeaveTo(ROUTES.TRADE_QUEUE);
    }
  };

  const cancel = () =>
    navigate(
      trade ? ROUTES.TRADE_DETAIL.replace(":id", trade.id) : ROUTES.TRADES,
    );

  const canDraft = !trade || trade.status === "draft";

  return (
    <div className="space-y-4">
      <UnsavedChangesGuard
        dirty={dirty}
        onSaveDraft={canDraft ? () => saveAsDraft(true) : undefined}
      />
      <div>
        <h1 className="text-xl font-bold">
          {trade ? "トレード編集・決済入力" : "トレードを記録"}
        </h1>
        {trade && (
          <p className="mt-1 text-sm text-ink-sub">
            {trade.pair} {SIDE_LABEL[trade.side]} ・ {formatJst(trade.entryAt)}{" "}
            エントリー ・ {trade.lots} lot
            {trade.source === "rakuten_csv" && " ・ 取り込み済み"}
          </p>
        )}
      </div>

      {trade && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="btn min-h-touch"
            aria-pressed={showChart}
            onClick={toggleView}
          >
            {showChart ? "フォームに戻る" : "チャートを見る"}
            <kbd className="ml-2 rounded border border-line px-1 text-xs text-ink-sub">
              C
            </kbd>
          </button>
        </div>
      )}

      {showChart && trade && (
        // 入力中のSL・TPをチャートの線にも反映する（保存前の値）
        <ChartPanel
          trade={{
            ...trade,
            slPrice: parseNum(form.slPrice),
            tpPrice: parseNum(form.tpPrice),
          }}
          pipSize={pairs.find((p) => p.symbol === trade.pair)?.pipSize ?? 0.01}
          settings={settings ?? null}
        />
      )}

      {/* チャート表示中もフォームは消さず隠すだけにして、入力内容とスクロール位置を保つ */}
      <div hidden={showChart}>
        <TradeFormBody
          form={form}
          errors={errors}
          preview={preview}
          pairs={pickerPairs}
          tags={tags}
          rules={rules}
          exitOpen={exitOpen}
          onChange={onChange}
        />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button className="btn" onClick={cancel}>
          キャンセル
        </button>
        {canDraft && (
          <button
            className="btn"
            disabled={save.isPending}
            onClick={() => void saveAsDraft()}
          >
            下書き保存
          </button>
        )}
        <button
          className="btn-primary"
          disabled={save.isPending}
          onClick={() => void saveAndOpen()}
        >
          保存
        </button>
        {isEdit && (
          <button
            className="btn-primary"
            disabled={save.isPending}
            onClick={() => void saveAndNext()}
          >
            保存して次の未入力へ
          </button>
        )}
      </div>
    </div>
  );
}
