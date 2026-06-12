import { NextResponse } from "next/server";
import { generateCampaignSignal } from "@/lib/market-campaign";
import { requireApiUser } from "@/lib/server-auth";
import { getMarketSignals } from "@/lib/workflows/market";

export async function POST() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const pulse = await getMarketSignals();
  const campaignSignal = await generateCampaignSignal(pulse);
  return NextResponse.json({ campaignSignal });
}
