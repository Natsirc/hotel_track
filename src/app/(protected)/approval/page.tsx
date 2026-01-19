import Topbar from "@/components/Topbar";
import Popup from "@/components/Popup";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { formatManilaDateTime } from "@/lib/time";
import { redirect } from "next/navigation";

type ApprovalPageProps = {
  searchParams?: Promise<{ error?: string; success?: string }>;
};

function getMessage(error?: string, success?: string) {
  if (success === "approved") return { tone: "success", text: "Request approved." };
  if (success === "rejected") return { tone: "success", text: "Request rejected." };
  if (error === "missing") return { tone: "warning", text: "Missing request data." };
  return null;
}

export default async function ApprovalPage({ searchParams }: ApprovalPageProps) {
  const params = (await searchParams) ?? {};
  await requireAdmin();
  const supabase = getSupabaseAdmin();

  const { data: requests } = await supabase
    .from("approval_requests")
    .select("id, request_type, entity_id, requested_by, status, created_at, staff_users(full_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const requestDetails = await Promise.all(
    (requests ?? []).map(async (request) => {
      if (request.request_type === "guest_delete") {
        const { data: guest } = await supabase
          .from("guests")
          .select("full_name, contact, email, age")
          .eq("id", request.entity_id)
          .maybeSingle();
        return {
          ...request,
          label: "Guest delete request",
          detail: guest
            ? `${guest.full_name} • ${guest.age} yrs • ${guest.contact || "-"}`
            : "Guest record not found",
        };
      }

      const { data: booking } = await supabase
        .from("bookings")
        .select("check_in, check_out, status, guests(full_name), rooms(room_number)")
        .eq("id", request.entity_id)
        .maybeSingle();

      const guestName = Array.isArray(booking?.guests)
        ? booking?.guests?.[0]?.full_name
        : booking?.guests?.full_name;
      const roomNumber = Array.isArray(booking?.rooms)
        ? booking?.rooms?.[0]?.room_number
        : booking?.rooms?.room_number;

      return {
        ...request,
        label: "Booking delete request",
        detail: booking
          ? `${guestName ?? "Guest"} • Room ${roomNumber ?? "-"} • ${formatManilaDateTime(
              booking.check_in
            )} → ${formatManilaDateTime(booking.check_out)}`
          : "Booking record not found",
      };
    })
  );

  const message = getMessage(params.error, params.success);

  async function approveRequestAction(formData: FormData) {
    "use server";
    const requestId = Number(formData.get("request_id"));
    const requestType = String(formData.get("request_type"));
    const entityId = Number(formData.get("entity_id"));

    if (!requestId || !requestType || !entityId) {
      redirect("/approval?error=missing");
    }

    const supabase = getSupabaseAdmin();
    if (requestType === "guest_delete") {
      const { data: activeBookings } = await supabase
        .from("bookings")
        .select("room_id, status")
        .eq("guest_id", entityId)
        .in("status", ["reserved", "checked_in"]);

      const roomsToFree = (activeBookings || [])
        .filter((booking) => booking.status === "checked_in")
        .map((booking) => booking.room_id);

      if (activeBookings && activeBookings.length > 0) {
        await supabase
          .from("bookings")
          .update({ status: "checked_out" })
          .eq("guest_id", entityId)
          .eq("status", "checked_in");
        await supabase
          .from("bookings")
          .update({ status: "cancelled" })
          .eq("guest_id", entityId)
          .eq("status", "reserved");
      }

      if (roomsToFree.length > 0) {
        await supabase.from("rooms").update({ status: "vacant" }).in("id", roomsToFree);
      }

      await supabase.from("guests").delete().eq("id", entityId);
    }

    if (requestType === "booking_delete") {
      const { data: booking } = await supabase
        .from("bookings")
        .select("room_id, status")
        .eq("id", entityId)
        .maybeSingle();
      await supabase.from("bookings").delete().eq("id", entityId);
      if (booking?.room_id && booking.status === "checked_in") {
        await supabase.from("rooms").update({ status: "vacant" }).eq("id", booking.room_id);
      }
    }

    await supabase
      .from("approval_requests")
      .update({ status: "approved", resolved_at: new Date().toISOString() })
      .eq("id", requestId);
    redirect("/approval?success=approved");
  }

  async function rejectRequestAction(formData: FormData) {
    "use server";
    const requestId = Number(formData.get("request_id"));
    if (!requestId) {
      redirect("/approval?error=missing");
    }
    const supabase = getSupabaseAdmin();
    await supabase
      .from("approval_requests")
      .update({ status: "rejected", resolved_at: new Date().toISOString() })
      .eq("id", requestId);
    redirect("/approval?success=rejected");
  }

  return (
    <div className="space-y-8">
      <Topbar
        title="Approval Requests"
        subtitle="Review and approve staff delete requests."
      />

      {message ? (
        <Popup
          tone={message.tone}
          title={message.tone === "success" ? "Success" : "Notice"}
          message={message.text}
        />
      ) : null}

      <section className="surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl text-[var(--plum)]">Pending Requests</h2>
          <span className="text-xs uppercase tracking-[0.2em] text-[var(--mauve)]">
            {requestDetails.length} pending
          </span>
        </div>
        <div className="mt-6 space-y-3">
          {requestDetails.length ? (
            requestDetails.map((request) => (
              <div
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] px-4 py-3 text-sm"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--plum)]">
                    {request.label}
                  </p>
                  <p className="muted text-xs">
                    {request.detail}
                  </p>
                  <p className="muted text-xs">
                    Requested by {request.staff_users?.full_name ?? "Staff"} •{" "}
                    {formatManilaDateTime(request.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={approveRequestAction}>
                    <input type="hidden" name="request_id" value={request.id} />
                    <input type="hidden" name="request_type" value={request.request_type} />
                    <input type="hidden" name="entity_id" value={request.entity_id} />
                    <button className="rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.2em]">
                      Approve
                    </button>
                  </form>
                  <form action={rejectRequestAction}>
                    <input type="hidden" name="request_id" value={request.id} />
                    <button className="rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.2em]">
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            ))
          ) : (
            <p className="muted text-sm">No pending requests.</p>
          )}
        </div>
      </section>
    </div>
  );
}
