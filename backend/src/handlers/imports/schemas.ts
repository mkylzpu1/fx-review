import { z } from "zod";
import { MAX_FILES } from "../../services/import/importService";

const FileSchema = z.object({
  name: z.string().trim().min(1, "ファイル名がありません").max(255),
  text: z.string(),
});

const FilesSchema = z
  .array(FileSchema)
  .min(1, "ファイルがありません")
  .max(MAX_FILES, `ファイルは${MAX_FILES}個までです`);

/** POST /imports/preview */
export const PreviewBodySchema = z.object({ files: FilesSchema });

/** POST /imports/commit。重複の扱いは必ず指定させる（取り違えて上書きしないため） */
export const CommitBodySchema = z.object({
  files: FilesSchema,
  duplicateMode: z.enum(["skip", "overwrite"], {
    errorMap: () => ({
      message: "duplicateModeは skip / overwrite のいずれかです",
    }),
  }),
});
