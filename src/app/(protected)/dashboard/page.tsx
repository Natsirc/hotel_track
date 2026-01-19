import Topbar from "@/components/Topbar";
import StatCard from "@/components/StatCard";
import { getSupabaseAdmin } from "@/lib/supabase";
import { formatManilaDateTime } from "@/lib/time";

export default async function DashboardPage() {
  const supabase = getSupabaseAdmin();

  const [{ count: totalRooms }, { count: vacantRooms }, { count: occupiedRooms }] =
    await Promise.all([
      supabase.from("rooms").select("*", { count: "exact", head: true }),
      supabase
        .from("rooms")
        .select("*", { count: "exact", head: true })
        .eq("status", "vacant"),
      supabase
        .from("rooms")
        .select("*", { count: "exact", head: true })
        .eq("status", "occupied"),
    ]);

  const { count: activeStays } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("status", "checked_in");

  const { data: upcoming } = await supabase
    .from("bookings")
    .select(
      "id, check_in, check_out, status, stay_hours, pax, guests(full_name), rooms(room_number)"
    )
    .in("status", ["reserved", "checked_in"])
    .order("check_in", { ascending: true })
    .limit(6);

  return (
    <div className="space-y-8">
      <Topbar
        title="Hotel Dashboard"
        subtitle="Track room availability, active stays, and upcoming arrivals."
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Rooms" value={totalRooms ?? 0} tone="sand" />
        <StatCard label="Vacant" value={vacantRooms ?? 0} tone="mint" />
        <StatCard label="Occupied" value={occupiedRooms ?? 0} tone="rose" />
        <StatCard label="Active Stays" value={activeStays ?? 0} tone="sand" />
      </section>

      <section className="surface p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--mauve)]">
              Next Arrivals
            </p>
            <h2 className="text-2xl text-[var(--plum)]">Upcoming Bookings</h2>
          </div>
          <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.2em] text-[var(--mauve)]">
            {upcoming?.length ?? 0} listed
          </span>
        </div>
        <div className="mt-6 space-y-3">
          {upcoming?.length ? (
            upcoming.map((booking) => (
              <div
                key={booking.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] px-4 py-3 text-sm"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--plum)]">
                    {booking.guests?.full_name ?? "Guest"}
                  </p>
                  <p className="muted text-xs">
                    Room {booking.rooms?.room_number ?? "-"} - {formatManilaDateTime(booking.check_in)} to {formatManilaDateTime(booking.check_out)} - {booking.stay_hours} hrs - {booking.pax} pax
                  </p>
                </div>
                <span className="rounded-full bg-[var(--fog)] px-3 py-1 text-xs uppercase tracking-[0.2em] text-[var(--mauve)]">
                  {booking.status.replace("_", " ")}
                </span>
              </div>
            ))
          ) : (
            <p className="muted text-sm">
              No upcoming bookings yet. Create one in the booking page.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

