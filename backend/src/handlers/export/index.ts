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

const BodySchema = z.object({
  range: z.enum(["all", "30d", "month"], {
    errorMap: () => ({ message: "rangeは all / 30d / month のいずれかです" }),
  }),
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
        range: body.range,
        format: body.format,
        include: { ...DEFAULT_INCLUDE, ...body.include },
      }),
    );
  } catch (e) {
    return errorResponse(e);
  }
};
