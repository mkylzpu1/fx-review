import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { z } from "zod";
import { verifyAuth } from "../../lib/cognito";
import { success, errorResponse } from "../../lib/response";
import { parseBody } from "../../lib/validate";
import { DEFAULT_INCLUDE } from "../../services/export/exportColumns";
import { exportService } from "../../services/export/exportService";

const IncludeSchema = z
  .object({
    result: z.boolean(),
    planDiff: z.boolean(),
    rationale: z.boolean(),
    ruleChecks: z.boolean(),
    reflection: z.boolean(),
    market: z.boolean(),
  })
  .partial();

const IsoDate = (name: string) =>
  z
    .string()
    .datetime({ offset: true, message: `${name}はISO日時で指定してください` })
    .optional();

const BodySchema = z.object({
  from: IsoDate("from"),
  to: IsoDate("to"),
  format: z.enum(["markdown", "csv", "json"], {
    errorMap: () => ({
      message: "formatは markdown / csv / json のいずれかです",
    }),
  }),
  include: IncludeSchema.optional(),
});

/** POST /export */
export const postHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    const body = parseBody(event.body, BodySchema);
    return success(
      await exportService.build(userId, {
        from: body.from,
        to: body.to,
        format: body.format,
        include: { ...DEFAULT_INCLUDE, ...body.include },
      }),
    );
  } catch (e) {
    return errorResponse(e);
  }
};
