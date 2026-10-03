import { drainPushOutbox } from "@/lib/push/drain";
import { isPushDrainAuthorized } from "@/lib/push/subscription";

export const runtime = "nodejs";

async function handle(request: Request): Promise<Response> {
  if (
    !isPushDrainAuthorized(request.headers.get("authorization"), {
      PUSH_DELIVERY_SECRET: process.env.PUSH_DELIVERY_SECRET,
      CRON_SECRET: process.env.CRON_SECRET,
    })
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const summary = await drainPushOutbox();
    return Response.json(summary);
  } catch {
    return Response.json({ error: "push_drain_failed" }, { status: 500 });
  }
}

export function GET(request: Request): Promise<Response> {
  return handle(request);
}

export function POST(request: Request): Promise<Response> {
  return handle(request);
}
