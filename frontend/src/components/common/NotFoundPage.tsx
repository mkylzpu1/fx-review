import { Link } from "react-router-dom";
import { ROUTES } from "@/constants/routes";

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
      <p className="num text-4xl font-bold text-ink-mute">404</p>
      <h1 className="text-xl font-bold">ページが見つかりません</h1>
      <p className="text-sm text-ink-sub">
        アドレスが違うか、削除されたトレードのページかもしれません。
      </p>
      <div className="mt-4 flex gap-2">
        <Link to={ROUTES.TRADES} className="btn-primary">
          トレード一覧へ
        </Link>
        <Link to={ROUTES.STATS} className="btn">
          統計へ
        </Link>
      </div>
    </div>
  );
}
