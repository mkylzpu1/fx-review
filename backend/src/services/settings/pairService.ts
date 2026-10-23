import { ConflictError, NotFoundError } from "../../lib/errors";
import { currencyPairStore } from "../../stores/currencyPairStore";
import type { CurrencyPair } from "../../types/settings";

export const pairService = {
  list: (userId: string) => currencyPairStore.list(userId),

  async create(
    userId: string,
    input: Omit<CurrencyPair, "id">,
  ): Promise<CurrencyPair> {
    const created = await currencyPairStore.create(userId, input);
    if (!created)
      throw new ConflictError(`${input.symbol} はすでに登録されています`);
    return created;
  },

  async update(
    userId: string,
    id: string,
    patch: Partial<Omit<CurrencyPair, "id" | "symbol">>,
  ): Promise<CurrencyPair> {
    const updated = await currencyPairStore.update(userId, id, patch);
    if (!updated) throw new NotFoundError("通貨ペア");
    return updated;
  },

  async delete(userId: string, id: string): Promise<void> {
    const ok = await currencyPairStore.delete(userId, id);
    if (!ok) throw new NotFoundError("通貨ペア");
  },
};
