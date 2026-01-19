import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { addHours, parseManilaLocal } from "@/lib/time";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const checkIn = searchParams.get("check_in");
  const stayHoursParam = searchParams.get("stay_hours");
  const paxParam = searchParams.get("pax");

  if (!checkIn || !stayHoursParam || !paxParam) {
    return NextResponse.json({ error: "Missing dates." }, { status: 400 });
  }

  const stayHours = Number(stayHoursParam);
  const pax = Number(paxParam);
  const checkInDate = parseManilaLocal(checkIn);
  if (!checkInDate || Number.isNaN(stayHours) || stayHours <= 0 || Number.isNaN(pax) || pax <= 0) {
    return NextResponse.json({ error: "Invalid dates." }, { status: 400 });
  }

  const checkOutDate = addHours(checkInDate, stayHours);

  const supabase = getSupabaseAdmin();
  const { data: conflicts } = await supabase
    .from("bookings")
    .select("room_id")
    .in("status", ["reserved", "checked_in"])
    .lt("check_in", checkOutDate.toISOString())
    .gt("check_out", checkInDate.toISOString());

  const conflictIds = (conflicts || []).map((row) => row.room_id);
  let roomsQuery = supabase
    .from("rooms")
    .select("id, room_number, status, capacity")
    .neq("status", "maintenance")
    .gte("capacity", pax)
    .order("room_number", { ascending: true });

  if (conflictIds.length > 0) {
    roomsQuery = roomsQuery.not("id", "in", `(${conflictIds.join(",")})`);
  }

  const { data: rooms } = await roomsQuery;
  return NextResponse.json({ rooms: rooms ?? [] });
}
