import { redirect } from "next/navigation";
import Topbar from "@/components/Topbar";
import Popup from "@/components/Popup";
import { getSession, requireAuth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import BookingForm from "@/components/BookingForm";
import { addHours, formatManilaDateTime, formatManilaInput, parseManilaLocal } from "@/lib/time";

type BookingsPageProps = {
  searchParams?: Promise<{ error?: string; success?: string; edit?: string }>;
};

type Message = {
  tone: "success" | "warning" | "error";
  text: string;
};

function getMessage(error?: string, success?: string): Message | null {
  if (success === "added") return { tone: "success", text: "Booking created." };
  if (success === "updated") return { tone: "success", text: "Booking updated." };
  if (success === "deleted") return { tone: "success", text: "Booking deleted." };
  if (success === "requested") return { tone: "success", text: "Delete request sent to admin." };
  if (success === "status") return { tone: "success", text: "Booking updated." };
  if (error === "missing") return { tone: "warning", text: "Fill out all fields." };
  if (error === "past") return { tone: "error", text: "Check-in must be today or later." };
  if (error === "conflict") return { tone: "error", text: "Room is not available for those dates." };
  if (error === "pax") return { tone: "error", text: "Pax exceeds room capacity." };
  if (error === "forbidden") return { tone: "warning", text: "Admin approval required for delete." };
  return null;
}

export default async function BookingsPage({ searchParams }: BookingsPageProps) {
  const params = (await searchParams) ?? {};
  const user = await requireAuth();
  const isAdmin = user.role === "admin";
  const supabase = getSupabaseAdmin();

  const now = new Date();
  const nowIso = now.toISOString();

  const { data: autoCheckins } = await supabase
    .from("bookings")
    .select("id, room_id")
    .eq("status", "reserved")
    .lte("check_in", nowIso);

  if (autoCheckins && autoCheckins.length > 0) {
    const ids = autoCheckins.map((booking) => booking.id);
    const roomIds = autoCheckins.map((booking) => booking.room_id);
    await supabase.from("bookings").update({ status: "checked_in" }).in("id", ids);
    await supabase.from("rooms").update({ status: "occupied" }).in("id", roomIds);
  }

  const [{ data: bookings }, { data: guests }, { data: rooms }] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, check_in, check_out, status, stay_hours, pax, guest_id, room_id, guests(full_name), rooms(room_number, id)"
      )
      .order("check_in", { ascending: false }),
    supabase.from("guests").select("id, full_name").order("full_name"),
    supabase
      .from("rooms")
      .select("id, room_number, status")
      .neq("status", "maintenance")
      .order("room_number"),
  ]);

  const editId = params.edit ? Number(params.edit) : null;
  const bookingToEdit = editId ? bookings?.find((booking) => booking.id === editId) : null;

  const message = getMessage(params.error, params.success);

  async function addBookingAction(formData: FormData) {
    "use server";
    const guestId = Number(formData.get("guest_id"));
    const roomId = Number(formData.get("room_id"));
    const checkInRaw = String(formData.get("check_in") || "");
    const stayHours = Number(formData.get("stay_hours"));
    const pax = Number(formData.get("pax"));

    if (!guestId || !roomId || !checkInRaw || !stayHours || !pax) {
      redirect("/bookings?error=missing");
    }

    if (![3, 5, 8, 12, 24].includes(stayHours)) {
      redirect("/bookings?error=missing");
    }

    const checkIn = parseManilaLocal(checkInRaw);
    if (!checkIn) {
      redirect("/bookings?error=missing");
    }
    const checkOut = addHours(checkIn, stayHours);
    const now = new Date();
    if (checkIn < now) {
      redirect("/bookings?error=past");
    }

    const supabase = getSupabaseAdmin();
    const { data: room } = await supabase
      .from("rooms")
      .select("capacity")
      .eq("id", roomId)
      .maybeSingle();
    if (room?.capacity && pax > room.capacity) {
      redirect("/bookings?error=pax");
    }
    const { data: conflicts } = await supabase
      .from("bookings")
      .select("id")
      .eq("room_id", roomId)
      .in("status", ["reserved", "checked_in"])
      .lt("check_in", checkOut.toISOString())
      .gt("check_out", checkIn.toISOString())
      .limit(1);

    if (conflicts && conflicts.length > 0) {
      redirect("/bookings?error=conflict");
    }

    const status = checkIn <= now ? "checked_in" : "reserved";
    await supabase.from("bookings").insert({
      guest_id: guestId,
      room_id: roomId,
      check_in: checkIn.toISOString(),
      check_out: checkOut.toISOString(),
      stay_hours: stayHours,
      pax,
      status,
    });
    if (status === "checked_in") {
      await supabase.from("rooms").update({ status: "occupied" }).eq("id", roomId);
    }
    redirect("/bookings?success=added");
  }

  async function updateBookingStatusAction(formData: FormData) {
    "use server";
    const bookingId = Number(formData.get("booking_id"));
    const roomId = Number(formData.get("room_id"));
    const action = String(formData.get("action"));
    const supabase = getSupabaseAdmin();

    if (action === "checkin") {
      const { data: booking } = await supabase
        .from("bookings")
        .select("stay_hours")
        .eq("id", bookingId)
        .maybeSingle();
      const now = new Date();
      const checkOut = addHours(now, booking?.stay_hours ?? 3);
      await supabase
        .from("bookings")
        .update({ status: "checked_in", check_in: now.toISOString(), check_out: checkOut.toISOString() })
        .eq("id", bookingId);
      await supabase.from("rooms").update({ status: "occupied" }).eq("id", roomId);
    }
    if (action === "checkout") {
      await supabase.from("bookings").update({ status: "checked_out" }).eq("id", bookingId);
      await supabase.from("rooms").update({ status: "vacant" }).eq("id", roomId);
    }

    redirect("/bookings?success=status");
  }

  async function updateBookingAction(formData: FormData) {
    "use server";
    const bookingId = Number(formData.get("booking_id"));
    const guestId = Number(formData.get("guest_id"));
    const roomId = Number(formData.get("room_id"));
    const checkInRaw = String(formData.get("check_in") || "");
    const stayHours = Number(formData.get("stay_hours"));
    const pax = Number(formData.get("pax"));

    if (!bookingId || !guestId || !roomId || !checkInRaw || !stayHours || !pax) {
      redirect(`/bookings?edit=${bookingId}&error=missing`);
    }

    if (![3, 5, 8, 12, 24].includes(stayHours)) {
      redirect(`/bookings?edit=${bookingId}&error=missing`);
    }

    const checkIn = parseManilaLocal(checkInRaw);
    if (!checkIn) {
      redirect(`/bookings?edit=${bookingId}&error=missing`);
    }
    const checkOut = addHours(checkIn, stayHours);

    const supabase = getSupabaseAdmin();
    const { data: room } = await supabase
      .from("rooms")
      .select("capacity")
      .eq("id", roomId)
      .maybeSingle();
    if (room?.capacity && pax > room.capacity) {
      redirect(`/bookings?edit=${bookingId}&error=pax`);
    }
    const { data: conflicts } = await supabase
      .from("bookings")
      .select("id")
      .eq("room_id", roomId)
      .in("status", ["reserved", "checked_in"])
      .neq("id", bookingId)
      .lt("check_in", checkOut.toISOString())
      .gt("check_out", checkIn.toISOString())
      .limit(1);

    if (conflicts && conflicts.length > 0) {
      redirect(`/bookings?edit=${bookingId}&error=conflict`);
    }

    await supabase
      .from("bookings")
      .update({
        guest_id: guestId,
        room_id: roomId,
        check_in: checkIn.toISOString(),
        check_out: checkOut.toISOString(),
        stay_hours: stayHours,
        pax,
      })
      .eq("id", bookingId);

    redirect("/bookings?success=updated");
  }

  const minDateTime = formatManilaInput(now);

  async function deleteBookingAction(formData: FormData) {
    "use server";
    const bookingId = Number(formData.get("booking_id"));
    const roomId = Number(formData.get("room_id"));
    const user = await getSession();
    if (!user) {
      redirect("/bookings?error=forbidden");
    }

    const supabase = getSupabaseAdmin();
    if (user.role === "admin") {
      await supabase.from("bookings").delete().eq("id", bookingId);
      await supabase.from("rooms").update({ status: "vacant" }).eq("id", roomId);
      redirect("/bookings?success=deleted");
    }

    await supabase.from("approval_requests").insert({
      request_type: "booking_delete",
      entity_id: bookingId,
      requested_by: user.id,
    });
    redirect("/bookings?success=requested");
  }

  async function extendBookingAction(formData: FormData) {
    "use server";
    const bookingId = Number(formData.get("booking_id"));
    const roomId = Number(formData.get("room_id"));
    const extendHours = Number(formData.get("extend_hours"));
    if (!bookingId || !roomId || !extendHours || extendHours < 1 || extendHours > 24) {
      redirect("/bookings?error=missing");
    }

    const supabase = getSupabaseAdmin();
    const { data: booking } = await supabase
      .from("bookings")
      .select("check_out, stay_hours")
      .eq("id", bookingId)
      .maybeSingle();

    if (!booking) {
      redirect("/bookings?error=missing");
    }

    const currentCheckOut = new Date(booking.check_out);
    const newCheckOut = addHours(currentCheckOut, extendHours);

    const { data: conflicts } = await supabase
      .from("bookings")
      .select("id")
      .eq("room_id", roomId)
      .in("status", ["reserved", "checked_in"])
      .neq("id", bookingId)
      .lt("check_in", newCheckOut.toISOString())
      .gt("check_out", currentCheckOut.toISOString())
      .limit(1);

    if (conflicts && conflicts.length > 0) {
      redirect("/bookings?error=conflict");
    }

    await supabase
      .from("bookings")
      .update({
        check_out: newCheckOut.toISOString(),
        stay_hours: (booking.stay_hours ?? 0) + extendHours,
      })
      .eq("id", bookingId);

    redirect("/bookings?success=updated");
  }

  return (
    <div className="space-y-8">
      <Topbar
        title="Bookings"
        subtitle="Manage reservations, check-ins, and check-outs."
      />

      {message ? (
        <Popup
          tone={message.tone}
          title={
            message.tone === "success"
              ? "Success"
              : message.tone === "error"
                ? "Error"
                : "Notice"
          }
          message={message.text}
        />
      ) : null}

      <section className="surface p-6">
        <h2 className="text-xl text-[var(--plum)]">
          {bookingToEdit ? "Edit Booking" : "Create Booking"}
        </h2>
        {bookingToEdit ? (
          <form action={updateBookingAction} className="mt-5 grid gap-4 md:grid-cols-2">
            <input type="hidden" name="booking_id" value={bookingToEdit.id} />
            <select
              name="guest_id"
              defaultValue={bookingToEdit.guest_id ?? ""}
              className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
            >
              <option value="">Select guest</option>
              {guests?.map((guest) => (
                <option key={guest.id} value={guest.id}>
                  {guest.full_name}
                </option>
              ))}
            </select>
            <select
              name="room_id"
              className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
              defaultValue={bookingToEdit.room_id ?? ""}
            >
              <option value="">Select room</option>
              {rooms?.map((room) => (
                <option key={room.id} value={room.id}>
                  Room {room.room_number} ({room.status})
                </option>
              ))}
            </select>
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--mauve)]">
              Check In
              <input
                name="check_in"
                type="datetime-local"
                defaultValue={formatManilaInput(bookingToEdit.check_in)}
                className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--mauve)]">
              Stay (hours)
              <select
                name="stay_hours"
                defaultValue={bookingToEdit.stay_hours ?? 3}
                className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
              >
                <option value="3">3 hours</option>
                <option value="5">5 hours</option>
                <option value="8">8 hours</option>
                <option value="12">12 hours</option>
                <option value="24">24 hours</option>
              </select>
            </label>
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--mauve)]">
              Pax
              <input
                name="pax"
                type="number"
                min={1}
                defaultValue={bookingToEdit.pax ?? 1}
                className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
              />
            </label>
            <div className="flex flex-wrap gap-3 md:col-span-2">
              <button className="rounded-xl bg-[var(--plum)] px-6 py-3 text-sm font-semibold text-white">
                Update Booking
              </button>
              <a
                href="/bookings"
                className="button-link rounded-xl border border-[var(--border)] px-6 py-3 text-sm font-semibold text-[var(--plum)]"
              >
                Cancel
              </a>
            </div>
          </form>
        ) : (
          <BookingForm guests={guests ?? []} minDateTime={minDateTime} action={addBookingAction} />
        )}
      </section>

      <section className="surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl text-[var(--plum)]">Booking List</h2>
          <span className="text-xs uppercase tracking-[0.2em] text-[var(--mauve)]">
            {bookings?.length ?? 0} bookings
          </span>
        </div>
        <div className="mt-6 overflow-auto">
          <table className="w-full min-w-[860px] border-separate border-spacing-y-2 text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.2em] text-[var(--mauve)]">
              <tr>
                <th className="px-3 pb-3">Guest</th>
                <th className="px-3 pb-3">Room</th>
                <th className="px-3 pb-3">Pax</th>
                <th className="px-3 pb-3">Check In</th>
                <th className="px-3 pb-3">Check Out</th>
                <th className="px-3 pb-3">Status</th>
                <th className="px-3 pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-[var(--ink)]">
              {bookings?.map((booking) => (
                <tr key={booking.id} className="bg-white/70">
                  <td className="px-3 py-4 font-semibold">
                    {Array.isArray(booking.guests)
                      ? booking.guests?.[0]?.full_name ?? "-"
                      : (booking.guests as { full_name?: string } | undefined)?.full_name ?? "-"}
                  </td>
                  <td className="px-3 py-4">
                    {Array.isArray(booking.rooms)
                      ? booking.rooms?.[0]?.room_number ?? "-"
                      : (booking.rooms as { room_number?: string } | undefined)?.room_number ?? "-"}
                  </td>
                  <td className="px-3 py-4">{booking.pax}</td>
                  <td className="px-3 py-4">
                    {formatManilaDateTime(booking.check_in)}
                  </td>
                  <td className="px-3 py-4">
                    {formatManilaDateTime(booking.check_out)}
                    <div className="muted text-xs">{booking.stay_hours} hrs</div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex flex-wrap items-center gap-2 whitespace-nowrap">
                      <span className="rounded-full bg-[rgba(235,211,248,0.7)] px-3 py-1 text-xs uppercase tracking-[0.2em] text-[var(--plum)]">
                        {booking.status.replace("_", " ")}
                      </span>
                      {booking.status === "reserved" ? (
                        <form action={updateBookingStatusAction} className="inline-block">
                          <input type="hidden" name="booking_id" value={booking.id} />
                          <input type="hidden" name="room_id" value={booking.rooms?.id ?? 0} />
                          <button
                            name="action"
                            value="checkin"
                            className="rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.2em]"
                          >
                            Check In
                          </button>
                        </form>
                      ) : (
                        <form action={updateBookingStatusAction} className="inline-block">
                          <input type="hidden" name="booking_id" value={booking.id} />
                          <input type="hidden" name="room_id" value={booking.rooms?.id ?? 0} />
                          <button
                            name="action"
                            value="checkout"
                            disabled={booking.status !== "checked_in"}
                            className="rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.2em]"
                          >
                            Check Out
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-4 text-right">
                    <div className="flex flex-wrap justify-end gap-2 whitespace-nowrap">
                      <a
                        href={
                          !isAdmin &&
                          (booking.status === "checked_out" || booking.status === "cancelled")
                            ? "#"
                            : `/bookings?edit=${booking.id}`
                        }
                        className={`button-link rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.2em] ${
                          !isAdmin &&
                          (booking.status === "checked_out" || booking.status === "cancelled")
                            ? "pointer-events-none opacity-60"
                            : ""
                        }`}
                      >
                        Update
                      </a>
                      <form action={deleteBookingAction} className="inline-block">
                        <input type="hidden" name="booking_id" value={booking.id} />
                        <input type="hidden" name="room_id" value={booking.rooms?.id ?? 0} />
                        <button
                          type="submit"
                          disabled={
                            !isAdmin &&
                            (booking.status === "checked_out" || booking.status === "cancelled")
                          }
                          className="rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.2em]"
                        >
                          Delete
                        </button>
                      </form>
                      <form action={extendBookingAction} className="inline-flex items-center gap-2">
                        <input type="hidden" name="booking_id" value={booking.id} />
                        <input type="hidden" name="room_id" value={booking.rooms?.id ?? 0} />
                        <select
                          name="extend_hours"
                          className="rounded-full border border-[var(--border)] px-2 py-1 text-xs uppercase tracking-[0.2em]"
                          defaultValue="1"
                          disabled={
                            !isAdmin &&
                            (booking.status === "checked_out" || booking.status === "cancelled")
                          }
                        >
                          {Array.from({ length: 24 }, (_, i) => i + 1).map((hour) => (
                            <option key={hour} value={hour}>
                              +{hour}h
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          disabled={
                            !isAdmin &&
                            (booking.status === "checked_out" || booking.status === "cancelled")
                          }
                          className="rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.2em]"
                        >
                          Extend
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
