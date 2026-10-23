import { sql } from "../lib/db";
import type { AccountSettings, AccountSettingsPatch } from "../types/settings";

const COLUMNS = sql`
  balance_jpy::float8 as "balanceJpy", max_risk_pct::float8 as "maxRiskPct",
  min_rr::float8 as "minRr", timezone, chart_default_tf as "chartDefaultTf",
  chart_bars_before as "chartBarsBefore", chart_bars_after as "chartBarsAfter",
  ema_settings as "emaSettings"
`;

export const settingsStore = {
  async get(userId: string): Promise<AccountSettings | null> {
    const rows = await sql<AccountSettings[]>`
      SELECT ${COLUMNS} FROM account_settings WHERE user_id = ${userId}
    `;
    return rows[0] ?? null;
  },

  /** 初回作成（未指定の列はDBの既定値） */
  async create(userId: string, balanceJpy: number): Promise<void> {
    await sql`
      INSERT INTO account_settings (user_id, balance_jpy)
      VALUES (${userId}, ${balanceJpy})
      ON CONFLICT (user_id) DO NOTHING
    `;
  },

  /** 指定された項目だけ更新する（undefined は変更しない） */
  async update(userId: string, p: AccountSettingsPatch): Promise<void> {
    await sql`
      UPDATE account_settings SET
        balance_jpy       = COALESCE(${p.balanceJpy ?? null}, balance_jpy),
        max_risk_pct      = COALESCE(${p.maxRiskPct ?? null}, max_risk_pct),
        min_rr            = COALESCE(${p.minRr ?? null}, min_rr),
        timezone          = COALESCE(${p.timezone ?? null}, timezone),
        chart_default_tf  = COALESCE(${p.chartDefaultTf ?? null}, chart_default_tf),
        chart_bars_before = COALESCE(${p.chartBarsBefore ?? null}, chart_bars_before),
        chart_bars_after  = COALESCE(${p.chartBarsAfter ?? null}, chart_bars_after),
        ema_settings      = COALESCE(${p.emaSettings ? JSON.stringify(p.emaSettings) : null}::jsonb, ema_settings),
        updated_at        = NOW()
      WHERE user_id = ${userId}
    `;
  },
};
