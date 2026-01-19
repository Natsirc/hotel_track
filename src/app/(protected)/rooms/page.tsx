import { redirect } from "next/navigation";
import Topbar from "@/components/Topbar";
import Popup from "@/components/Popup";
import RoomForm from "@/components/RoomForm";
import { getSession, requireAuth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

type RoomsPageProps = {
  searchParams?: Promise<{ error?: string; success?: string; edit?: string }>;
};

function getMessage(error?: string, success?: string) {
  if (success === "added") return { tone: "success", text: "Room added." };
  if (success === "status") return { tone: "success", text: "Room updated." };
  if (success === "updated") return { tone: "success", text: "Room updated." };
  if (success === "deleted") return { tone: "success", text: "Room deleted." };
  if (error === "duplicate") return { tone: "error", text: "Room already exists." };
  if (error === "missing") return { tone: "warning", text: "Fill out all fields." };
  if (error === "forbidden") return { tone: "warning", text: "Admin access required." };
  if (error === "inuse") return { tone: "error", text: "Room has active bookings." };
  return null;
}

export default async function RoomsPage({ searchParams }: RoomsPageProps) {
  const params = (await searchParams) ?? {};
  const user = await requireAuth();
  const isAdmin = user.role === "admin";
  const supabase = getSupabaseAdmin();
  const { data: rooms } = await supabase
    .from("rooms")
    .select("*")
    .order("room_number", { ascending: true });

  const sortedRooms = [...(rooms ?? [])].sort((a, b) => {
    const aNum = Number(a.room_number);
    const bNum = Number(b.room_number);
    if (Number.isNaN(aNum) || Number.isNaN(bNum)) {
      return String(a.room_number).localeCompare(String(b.room_number));
    }
    return aNum - bNum;
  });

  const editId = params.edit ? Number(params.edit) : null;
  const roomToEdit = editId ? sortedRooms.find((room) => room.id === editId) : null;

  const message = getMessage(params.error, params.success);

  async function addRoomAction(formData: FormData) {
    "use server";
    const user = await getSession();
    if (!user || user.role !== "admin") {
      redirect("/rooms?error=forbidden");
    }
    const roomNumber = String(formData.get("room_number") || "").trim();
    const roomType = String(formData.get("room_type") || "").trim();
    if (!roomNumber || !roomType) {
      redirect("/rooms?error=missing");
    }

    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from("rooms")
      .select("id")
      .eq("room_number", roomNumber)
      .maybeSingle();

    if (existing) {
      redirect("/rooms?error=duplicate");
    }

    await supabase.from("rooms").insert({
      room_number: roomNumber,
      room_type: roomType,
      capacity: roomType === "Family" ? 4 : roomType === "Double" ? 2 : 1,
      status: "vacant",
    });
    redirect("/rooms?success=added");
  }

  async function updateRoomAction(formData: FormData) {
    "use server";
    const user = await getSession();
    if (!user || user.role !== "admin") {
      redirect("/rooms?error=forbidden");
    }
    const roomId = Number(formData.get("room_id"));
    const roomNumber = String(formData.get("room_number") || "").trim();
    const roomType = String(formData.get("room_type") || "").trim();
    const status = String(formData.get("status") || "").trim();
    if (!roomId || !roomNumber || !roomType || !status) {
      redirect(`/rooms?edit=${roomId}&error=missing`);
    }

    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from("rooms")
      .select("id")
      .eq("room_number", roomNumber)
      .neq("id", roomId)
      .maybeSingle();

    if (existing) {
      redirect(`/rooms?edit=${roomId}&error=duplicate`);
    }

    await supabase
      .from("rooms")
      .update({
        room_number: roomNumber,
        room_type: roomType,
        capacity: roomType === "Family" ? 4 : roomType === "Double" ? 2 : 1,
        status,
      })
      .eq("id", roomId);
    redirect("/rooms?success=updated");
  }

  async function deleteRoomAction(formData: FormData) {
    "use server";
    const user = await getSession();
    if (!user || user.role !== "admin") {
      redirect("/rooms?error=forbidden");
    }
    const roomId = Number(formData.get("room_id"));
    const supabase = getSupabaseAdmin();
    const { data: active } = await supabase
      .from("bookings")
      .select("id")
      .eq("room_id", roomId)
      .in("status", ["reserved", "checked_in"])
      .limit(1);

    if (active && active.length > 0) {
      redirect("/rooms?error=inuse");
    }

    await supabase.from("rooms").delete().eq("id", roomId);
    redirect("/rooms?success=deleted");
  }

  async function updateStatusAction(formData: FormData) {
    "use server";
    const user = await getSession();
    if (!user || user.role !== "admin") {
      redirect("/rooms?error=forbidden");
    }
    const roomId = Number(formData.get("room_id"));
    const status = String(formData.get("status") || "vacant");
    const supabase = getSupabaseAdmin();
    await supabase.from("rooms").update({ status }).eq("id", roomId);
    redirect("/rooms?success=status");
  }

  return (
    <div className="space-y-8">
      <Topbar
        title="Rooms"
        subtitle="Add rooms and update availability at a glance."
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

      {isAdmin ? (
        <section className="surface p-6">
          <h2 className="text-xl text-[var(--plum)]">
            {roomToEdit ? "Edit Room" : "Add Room"}
          </h2>
          <RoomForm
            action={roomToEdit ? updateRoomAction : addRoomAction}
            room={roomToEdit ?? null}
          />
        </section>
      ) : null}

      <section className="surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl text-[var(--plum)]">Room List</h2>
          <span className="text-xs uppercase tracking-[0.2em] text-[var(--mauve)]">
            {rooms?.length ?? 0} rooms
          </span>
        </div>
        <div className="mt-6 overflow-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.2em] text-[var(--mauve)]">
              <tr>
                <th className="pb-3">Room</th>
                <th className="pb-3">Type</th>
                <th className="pb-3">Pax</th>
                <th className="pb-3">Status</th>
                {isAdmin ? <th className="pb-3 text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="text-[var(--ink)]">
              {sortedRooms?.map((room) => (
                <tr key={room.id} className="border-t border-[var(--border)]">
                  <td className="py-4 font-semibold">{room.room_number}</td>
                  <td className="py-4">{room.room_type}</td>
                  <td className="py-4">{room.capacity}</td>
                  <td className="py-4 capitalize">{room.status}</td>
                  {isAdmin ? (
                    <td className="py-4 text-right">
                      <form action={updateStatusAction} className="flex flex-wrap justify-end gap-2">
                        <input type="hidden" name="room_id" value={room.id} />
                        <button
                          name="status"
                          value="vacant"
                          className="rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.2em]"
                        >
                          Vacant
                        </button>
                        <button
                          name="status"
                          value="occupied"
                          className="rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.2em]"
                        >
                          Occupied
                        </button>
                        <button
                          name="status"
                          value="maintenance"
                          className="rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.2em]"
                        >
                          Maintenance
                        </button>
                      </form>
                      <div className="mt-2 flex flex-wrap justify-end gap-2">
                        <a
                          href={`/rooms?edit=${room.id}`}
                          className="button-link rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.2em]"
                        >
                          Edit
                        </a>
                        <form action={deleteRoomAction}>
                          <input type="hidden" name="room_id" value={room.id} />
                          <button
                            type="submit"
                            className="rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.2em]"
                          >
                            Delete
                          </button>
                        </form>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
