import { NotFoundError } from "../../lib/errors";
import {
  ruleStore,
  type RuleCreate,
  type RulePatch,
} from "../../stores/ruleStore";
import type { Rule } from "../../types/trade";

export const ruleService = {
  list: (userId: string) => ruleStore.list(userId),

  async get(userId: string, id: string): Promise<Rule> {
    const rule = await ruleStore.findById(userId, id);
    if (!rule) throw new NotFoundError("ルール");
    return rule;
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
