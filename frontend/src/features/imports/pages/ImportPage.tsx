import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { ROUTES } from "@/constants/routes";
import { toast } from "@/stores/toastStore";
import { DoneStep } from "../components/DoneStep";
import { FileStep } from "../components/FileStep";
import { PreviewStep } from "../components/PreviewStep";
import { Stepper } from "../components/Stepper";
import { useImportCommit, useImportPreview } from "../hooks/useImportApi";
import type {
  CommitResult,
  DuplicateMode,
  ImportFileInput,
  PreviewResult,
} from "../types";
import { readCsvFiles, type ReadFailure } from "../utils/readCsvFile";

/** 楽天FX証券の約定履歴CSVを複数まとめて取り込む（①選ぶ → ②確認 → ③取り込む） */
export function ImportPage() {
  const navigate = useNavigate();
  const previewApi = useImportPreview();
  const commitApi = useImportCommit();

  const [selected, setSelected] = useState<File[]>([]);
  const [failures, setFailures] = useState<ReadFailure[]>([]);
  const [texts, setTexts] = useState<ImportFileInput[]>([]);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [mode, setMode] = useState<DuplicateMode>("skip");
  const [result, setResult] = useState<CommitResult | null>(null);
  const [reading, setReading] = useState(false);

  const step = result ? 3 : preview ? 2 : 1;

  const onSelect = (files: File[]) => {
    setSelected(files);
    setFailures([]);
    previewApi.reset();
  };

  const onNext = async () => {
    setReading(true);
    const read = await readCsvFiles(selected);
    setReading(false);
    setFailures(read.failures);
    if (read.files.length === 0) return;
    setTexts(read.files);
    previewApi.mutate(read.files, {
      onSuccess: (p) => {
        setPreview(p);
        setMode("skip");
      },
    });
  };

  const onCommit = () =>
    commitApi.mutate(
      { files: texts, duplicateMode: mode },
      {
        onSuccess: (r) => {
          setResult(r);
          toast.success(
            `${r.imported}件を取り込みました。取り込み済み${r.skipped}件は除きました`,
            {
              label: "入力を続ける",
              onClick: () => navigate(ROUTES.TRADE_QUEUE),
            },
          );
        },
      },
    );

  const back = () => {
    setPreview(null);
    commitApi.reset();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">CSV取り込み</h1>
        <p className="mt-1 text-sm text-ink-sub">
          約定履歴から、トレードをまとめて登録します。
        </p>
      </div>
      <Stepper current={step} />

      {previewApi.isError && (
        <ErrorAlert
          message="内容を確認できませんでした。通信を確認して、もう一度試してください。選んだファイルは残っています。"
          onRetry={() => void onNext()}
        />
      )}

      {step === 1 && (
        <FileStep
          files={selected}
          failures={failures}
          busy={reading || previewApi.isPending}
          onSelect={onSelect}
          onNext={() => void onNext()}
        />
      )}
      {step === 2 && preview && (
        <PreviewStep
          preview={preview}
          mode={mode}
          committing={commitApi.isPending}
          commitError={commitApi.isError}
          onModeChange={setMode}
          onBack={back}
          onCommit={onCommit}
        />
      )}
      {step === 3 && result && <DoneStep result={result} />}
    </div>
  );
}
