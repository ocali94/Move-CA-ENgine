import { NextResponse } from "next/server";
import { generateCampaignSignal } from "@/lib/market-campaign";
import { requireApiUser } from "@/lib/server-auth";
import { getMarketSignals } from "@/lib/workflows/market";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  // The Refresh button passes ?refresh=1 to bypass the 24h cache and pull
  // fresh public data on demand.
  const force = new URL(request.url).searchParams.get("refresh") === "1";
  const pulse = await getMarketSignals({ force });
  const campaignSignal = await generateCampaignSignal(pulse);
  return NextResponse.json({ pulse, campaignSignal });
}
