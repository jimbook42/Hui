import { runPlanningCycleCron } from "@/lib/groups/planning-cycle-cron";
import { createSecretSupabaseClient } from "@/lib/supabase/admin";
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
    const supabase = createSecretSupabaseClient();
    const asOf = request.headers.get("x-planning-as-of")?.trim();
    const summary = await runPlanningCycleCron(supabase, asOf || undefined);
    return Response.json(summary);
  } catch {
    return Response.json({ error: "planning_cycle_cron_failed" }, { status: 500 });
  }
}

export function GET(request: Request): Promise<Response> {
  return handle(request);
}

export function POST(request: Request): Promise<Response> {
  return handle(request);
}
