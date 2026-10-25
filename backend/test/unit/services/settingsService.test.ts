import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/stores/settingsStore", () => ({
  settingsStore: { get: vi.fn(), create: vi.fn(), update: vi.fn() },
}));
vi.mock("../../../src/stores/currencyPairStore", () => ({
  currencyPairStore: { create: vi.fn() },
}));
vi.mock("../../../src/stores/tagStore", () => ({
  tagStore: { upsert: vi.fn() },
}));

import { settingsService } from "../../../src/services/settings/settingsService";
import { settingsStore } from "../../../src/stores/settingsStore";
import { currencyPairStore } from "../../../src/stores/currencyPairStore";
import { tagStore } from "../../../src/stores/tagStore";
import { DEFAULT_TAGS } from "../../../src/constants/settingsDefaults";

const SETTINGS = {
  balanceJpy: 750000,
  maxRiskPct: 1,
  minRr: 2,
  timezone: "Asia/Tokyo",
  chartDefaultTf: "1h" as const,
  chartBarsBefore: 120,
  chartBarsAfter: 60,
  emaSettings: [],
};

describe("settingsService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("get: 未作成なら NotFound（オンボーディング判定）", async () => {
    vi.mocked(settingsStore.get).mockResolvedValue(null);
    await expect(settingsService.get("u")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("save: 未作成で口座残高が無ければ ValidationError", async () => {
    vi.mocked(settingsStore.get).mockResolvedValue(null);
    await expect(settingsService.save("u", { minRr: 2 })).rejects.toMatchObject(
      {
        statusCode: 400,
      },
    );
    expect(settingsStore.create).not.toHaveBeenCalled();
  });

  it("save: 初回作成時に USDJPY と既定タグを投入する", async () => {
    vi.mocked(settingsStore.get)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(SETTINGS);
    await settingsService.save("u", { balanceJpy: 750000 });
    expect(settingsStore.create).toHaveBeenCalledWith("u", 750000);
    expect(currencyPairStore.create).toHaveBeenCalledWith(
      "u",
      expect.objectContaining({
        symbol: "USDJPY",
        pipSize: 0.01,
        pipValueJpyPerLot: 100,
      }),
    );
    const tagCount =
      DEFAULT_TAGS.rationale.length + DEFAULT_TAGS.emotion.length;
    expect(tagStore.upsert).toHaveBeenCalledTimes(tagCount);
  });

  it("save: 作成済みなら投入せず更新だけ行う", async () => {
    vi.mocked(settingsStore.get).mockResolvedValue(SETTINGS);
    await settingsService.save("u", { minRr: 1.5 });
    expect(settingsStore.create).not.toHaveBeenCalled();
    expect(currencyPairStore.create).not.toHaveBeenCalled();
    expect(settingsStore.update).toHaveBeenCalledWith("u", { minRr: 1.5 });
  });
});
