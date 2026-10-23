import { NotFoundError, ValidationError } from "../../lib/errors";
import { settingsStore } from "../../stores/settingsStore";
import { currencyPairStore } from "../../stores/currencyPairStore";
import { tagStore } from "../../stores/tagStore";
import { DEFAULT_PAIRS, DEFAULT_TAGS } from "../../constants/settingsDefaults";
import type {
  AccountSettings,
  AccountSettingsPatch,
  TagKind,
} from "../../types/settings";

export const settingsService = {
  /** 未作成なら NotFoundError（フロントはこれでオンボーディングへ誘導する） */
  async get(userId: string): Promise<AccountSettings> {
    const settings = await settingsStore.get(userId);
    if (!settings) throw new NotFoundError("設定");
    return settings;
  },

  /** 未作成なら作成（balanceJpy 必須）して初期データを投入し、作成済みなら更新する */
  async save(
    userId: string,
    patch: AccountSettingsPatch,
  ): Promise<AccountSettings> {
    const existing = await settingsStore.get(userId);

    if (!existing) {
      if (patch.balanceJpy === undefined) {
        throw new ValidationError("口座残高を入力してください");
      }
      await settingsStore.create(userId, patch.balanceJpy);
      await this.seedDefaults(userId);
    }

    await settingsStore.update(userId, patch);
    return this.get(userId);
  },

  /** 通貨ペア・タグの初期データ（何度呼んでも重複しない） */
  async seedDefaults(userId: string): Promise<void> {
    for (const pair of DEFAULT_PAIRS) {
      await currencyPairStore.create(userId, pair);
    }
    for (const kind of Object.keys(DEFAULT_TAGS) as TagKind[]) {
      const names = DEFAULT_TAGS[kind];
      for (let i = 0; i < names.length; i++) {
        await tagStore.upsert(userId, kind, names[i], i);
      }
    }
  },
};
