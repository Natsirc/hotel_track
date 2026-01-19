import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { count } = await supabase
    .from("approval_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  return NextResponse.json({ count: count ?? 0 });
}
