import { httpRouter } from "convex/server";
import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { MOCK_PRICING_PATH, renderMockPricingHtml } from "./mockHtml";

const http = httpRouter();

http.route({
  path: MOCK_PRICING_PATH,
  method: "GET",
  handler: httpAction(async (ctx) => {
    const { variant } = await ctx.runQuery(api.mock.state, {});
    return new Response(renderMockPricingHtml(variant), {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }),
});

export default http;
