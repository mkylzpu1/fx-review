import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ROUTES } from "@/constants/routes";

const KEY = "fx-review-guide-seen";

function hasSeen(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // 保存できないときは、この画面を開いている間だけ出さない
  }
}

/** はじめて開いたときだけ、ご利用ガイドでの初期設定をすすめるダイアログ */
export function FirstVisitGuideDialog() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(() => !hasSeen());
  const onGuide = pathname === ROUTES.GUIDE;

  // ガイドを開いた時点で「見た」ことにする（次から出さない）
  useEffect(() => {
    if (onGuide) {
      markSeen();
      setOpen(false);
    }
  }, [onGuide]);

  const close = () => {
    markSeen();
    setOpen(false);
  };

  return (
    <ConfirmDialog
      open={open && !onGuide}
      title="はじめに、ご利用ガイドで初期設定を終わらせてください"
      description={
        <div className="space-y-2">
          <p>
            ローカルでの起動、MT5の設定、ローソク足の更新のしかたを、手順どおりに説明しています。5分ほどで終わります。
          </p>
          <p>
            あとで見たいときは、上のメニューの「ガイド」から、いつでも開けます。
          </p>
        </div>
      }
      confirmLabel="ご利用ガイドを開く"
      cancelLabel="あとで見る"
      onConfirm={() => {
        close();
        navigate(ROUTES.GUIDE);
      }}
      onCancel={close}
    />
  );
}
