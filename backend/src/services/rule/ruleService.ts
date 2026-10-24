import { NotFoundError } from "../../lib/errors";
import {
  ruleStore,
  type RuleCreate,
  type RulePatch,
} from "../../stores/ruleStore";
import type { Rule } from "../../types/trade";
import { tradeService } from "../trade/tradeService";
import { todayJst } from "../weekly/weeklyCalc";
import { buildRuleDetail, type RuleDetail } from "./ruleDetailCalc";

export const ruleService = {
  list: (userId: string) => ruleStore.list(userId),

  async get(userId: string, id: string): Promise<Rule> {
    const rule = await ruleStore.findById(userId, id);
    if (!rule) throw new NotFoundError("ルール");
    return rule;
  },

  /** 遵守率の推移・破ったトレード・守った/破った時の平均R（ルール詳細画面用） */
  async detail(userId: string, id: string): Promise<RuleDetail> {
    const rule = await this.get(userId, id);
    const views = await tradeService.listAll(userId, {});
    return buildRuleDetail(rule, views, todayJst());
  },

  /** 並び順は常に末尾に追加する */
  async create(userId: string, input: RuleCreate): Promise<Rule> {
    const next = (await ruleStore.maxSortOrder(userId)) + 1;
    return ruleStore.create(userId, input, next);
  },

  async update(userId: string, id: string, patch: RulePatch): Promise<Rule> {
    const updated = await ruleStore.update(userId, id, patch);
    if (!updated) throw new NotFoundError("ルール");
    return updated;
  },

  async delete(userId: string, id: string): Promise<void> {
    const ok = await ruleStore.delete(userId, id);
    if (!ok) throw new NotFoundError("ルール");
  },
};
