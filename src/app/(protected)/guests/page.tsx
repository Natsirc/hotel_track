import { redirect } from "next/navigation";
import Topbar from "@/components/Topbar";
import Popup from "@/components/Popup";
import { getSession, requireAuth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type GuestsPageProps = {
  searchParams?: Promise<{ error?: string; success?: string; edit?: string }>;
};

type Message = {
  tone: "success" | "warning" | "error";
  text: string;
};

function getMessage(error?: string, success?: string): Message | null {
  if (success === "added") return { tone: "success", text: "Guest added." };
  if (success === "updated") return { tone: "success", text: "Guest updated." };
  if (success === "deleted") return { tone: "success", text: "Guest deleted." };
  if (success === "requested") return { tone: "success", text: "Delete request sent to admin." };
  if (error === "age") return { tone: "error", text: "Guest must be 18+." };
  if (error === "missing") return { tone: "warning", text: "Name and age are required." };
  if (error === "contact") return { tone: "error", text: "Contact must be 11 digits and start with 09." };
  if (error === "forbidden") return { tone: "warning", text: "Admin approval required for delete." };
  if (error === "notfound") return { tone: "warning", text: "Guest not found for editing." };
  return null;
}

export default async function GuestsPage({ searchParams }: GuestsPageProps) {
  const params = (await searchParams) ?? {};
  const user = await requireAuth();
  const isAdmin = user.role === "admin";
  const supabase = getSupabaseAdmin();
  const { data: guests } = await supabase
    .from("guests")
    .select("*")
    .order("created_at", { ascending: false });

  const editId = params.edit ? String(params.edit) : null;
  const guestToEdit = editId
    ? guests?.find((guest) => String(guest.id) === editId)
    : null;
  const missingEdit = editId && !guestToEdit;

  const message = getMessage(missingEdit ? "notfound" : params.error, params.success);

  async function addGuestAction(formData: FormData) {
    "use server";
    const fullName = String(formData.get("full_name") || "").trim();
    const age = Number(formData.get("age"));
    const contact = String(formData.get("contact") || "").trim();
    const email = String(formData.get("email") || "").trim();

    if (!fullName || !age) {
      redirect("/guests?error=missing");
    }
    if (age < 18) {
      redirect("/guests?error=age");
    }
    if (contact && !/^09\d{9}$/.test(contact)) {
      redirect("/guests?error=contact");
    }

    const supabase = getSupabaseAdmin();
    await supabase.from("guests").insert({
      full_name: fullName,
      age,
      contact: contact || null,
      email: email || null,
    });
    redirect("/guests?success=added");
  }

  async function updateGuestAction(formData: FormData) {
    "use server";
    const id = Number(formData.get("guest_id"));
    const fullName = String(formData.get("full_name") || "").trim();
    const age = Number(formData.get("age"));
    const contact = String(formData.get("contact") || "").trim();
    const email = String(formData.get("email") || "").trim();

    if (!fullName || !age) {
      redirect(`/guests?edit=${id}&error=missing`);
    }
    if (age < 18) {
      redirect(`/guests?edit=${id}&error=age`);
    }
    if (contact && !/^09\d{9}$/.test(contact)) {
      redirect(`/guests?edit=${id}&error=contact`);
    }

    const supabase = getSupabaseAdmin();
    await supabase
      .from("guests")
      .update({
        full_name: fullName,
        age,
        contact: contact || null,
        email: email || null,
      })
      .eq("id", id);
    redirect("/guests?success=updated");
  }

  async function deleteGuestAction(formData: FormData) {
    "use server";
    const guestId = Number(formData.get("guest_id"));
    const user = await getSession();
    if (!user) {
      redirect("/guests?error=forbidden");
    }

    const supabase = getSupabaseAdmin();
    if (user.role === "admin") {
      const { data: activeBookings } = await supabase
        .from("bookings")
        .select("room_id, status")
        .eq("guest_id", guestId)
        .in("status", ["reserved", "checked_in"]);

      const roomsToFree = (activeBookings || [])
        .filter((booking) => booking.status === "checked_in")
        .map((booking) => booking.room_id);

      if (activeBookings && activeBookings.length > 0) {
        await supabase
          .from("bookings")
          .update({ status: "checked_out" })
          .eq("guest_id", guestId)
          .eq("status", "checked_in");
        await supabase
          .from("bookings")
          .update({ status: "cancelled" })
          .eq("guest_id", guestId)
          .eq("status", "reserved");
      }

      if (roomsToFree.length > 0) {
        await supabase.from("rooms").update({ status: "vacant" }).in("id", roomsToFree);
      }

      await supabase.from("guests").delete().eq("id", guestId);
      redirect("/guests?success=deleted");
    }

    await supabase.from("approval_requests").insert({
      request_type: "guest_delete",
      entity_id: guestId,
      requested_by: user.id,
    });
    redirect("/guests?success=requested");
  }

  return (
    <div className="space-y-8">
      <Topbar
        title="Guests"
        subtitle="Register guest profiles and keep contact details tidy."
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
        <div id="guest-form" />
        <h2 className="text-xl text-[var(--plum)]">
          {guestToEdit ? "Edit Guest" : "Add Guest"}
        </h2>
        <form
          action={guestToEdit ? updateGuestAction : addGuestAction}
          className="mt-5 grid gap-4 md:grid-cols-2"
        >
          {guestToEdit ? (
            <input type="hidden" name="guest_id" value={guestToEdit.id} />
          ) : null}
          <input
            name="full_name"
            placeholder="Full Name"
            defaultValue={guestToEdit?.full_name ?? ""}
            className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
          />
          <input
            name="age"
            type="number"
            min={18}
            placeholder="Age"
            defaultValue={guestToEdit?.age ?? ""}
            className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
          />
          <input
            name="contact"
            placeholder="Contact Number"
            inputMode="numeric"
            pattern="09[0-9]{9}"
            maxLength={11}
            defaultValue={guestToEdit?.contact ?? ""}
            className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
          />
          <input
            name="email"
            type="email"
            placeholder="Email (optional)"
            defaultValue={guestToEdit?.email ?? ""}
            className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
          />
          <div className="flex flex-wrap gap-3 md:col-span-2">
            <button className="rounded-xl bg-[var(--plum)] px-6 py-3 text-sm font-semibold text-white">
              {guestToEdit ? "Update Guest" : "Save Guest"}
            </button>
            {guestToEdit ? (
              <a
                href="/guests"
                className="button-link rounded-xl border border-[var(--border)] px-6 py-3 text-sm font-semibold text-[var(--plum)]"
              >
                Cancel
              </a>
            ) : null}
          </div>
        </form>
      </section>

      <section className="surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl text-[var(--plum)]">Guest List</h2>
          <span className="text-xs uppercase tracking-[0.2em] text-[var(--mauve)]">
            {guests?.length ?? 0} guests
          </span>
        </div>
        <div className="mt-6 overflow-auto">
          <table className="w-full min-w-[540px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.2em] text-[var(--mauve)]">
              <tr>
                <th className="pb-3">Guest</th>
                <th className="pb-3">Age</th>
                <th className="pb-3">Contact</th>
                <th className="pb-3">Email</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-[var(--ink)]">
              {guests?.map((guest) => (
                <tr key={guest.id} className="border-t border-[var(--border)]">
                  <td className="py-4 font-semibold">{guest.full_name}</td>
                  <td className="py-4">{guest.age}</td>
                  <td className="py-4">{guest.contact || "-"}</td>
                  <td className="py-4">{guest.email || "-"}</td>
                  <td className="py-4 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <a
                        href={`/guests?edit=${guest.id}#guest-form`}
                        className="button-link rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.2em]"
                      >
                        Edit
                      </a>
                      <form action={deleteGuestAction}>
                        <input type="hidden" name="guest_id" value={guest.id} />
                        <button
                          type="submit"
                          className="rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.2em]"
                        >
                          Delete
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
