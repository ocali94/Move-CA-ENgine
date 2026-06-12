import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server-auth";
import { getMarketSignals } from "@/lib/workflows/market";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const pulse = await getMarketSignals();
  return NextResponse.json({
    history: pulse.signals.map((signal) => ({
      id: signal.id,
      name: signal.name,
      history: signal.history,
    })),
  });
}
