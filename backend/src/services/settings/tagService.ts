import { ConflictError, NotFoundError } from "../../lib/errors";
import { tagStore } from "../../stores/tagStore";
import type { Tag, TagKind } from "../../types/settings";

/** PostgreSQL の一意制約違反 */
function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { code?: string }).code === "23505"
  );
}

export const tagService = {
  list: (userId: string, kind?: TagKind) => tagStore.list(userId, kind),

  async create(userId: string, kind: TagKind, name: string): Promise<Tag> {
    if (await tagStore.existsActive(userId, kind, name)) {
      throw new ConflictError(`「${name}」はすでに登録されています`);
    }
    const next = (await tagStore.maxSortOrder(userId, kind)) + 1;
    return tagStore.upsert(userId, kind, name, next);
  },

  async update(
    userId: string,
    id: string,
    patch: { name?: string; sortOrder?: number },
  ): Promise<Tag> {
    try {
      const updated = await tagStore.update(userId, id, patch);
      if (!updated) throw new NotFoundError("タグ");
      return updated;
    } catch (e) {
      if (isUniqueViolation(e))
        throw new ConflictError("同じ名前のタグがあります");
      throw e;
    }
  },

  async delete(userId: string, id: string): Promise<void> {
    const ok = await tagStore.softDelete(userId, id);
    if (!ok) throw new NotFoundError("タグ");
  },
};
