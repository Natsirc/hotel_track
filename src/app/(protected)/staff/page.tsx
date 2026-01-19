import { redirect } from "next/navigation";
import { hash } from "bcryptjs";
import Topbar from "@/components/Topbar";
import Popup from "@/components/Popup";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSession, requireAdmin } from "@/lib/auth";

type StaffPageProps = {
  searchParams?: Promise<{ error?: string; success?: string; edit?: string }>;
};

function getMessage(error?: string, success?: string) {
  if (success === "added") return { tone: "success", text: "Staff account created." };
  if (success === "approved") return { tone: "success", text: "Request approved." };
  if (success === "rejected") return { tone: "success", text: "Request rejected." };
  if (success === "updated") return { tone: "success", text: "Staff account updated." };
  if (success === "deleted") return { tone: "success", text: "Staff account deleted." };
  if (error === "missing") return { tone: "warning", text: "Fill out all fields." };
  if (error === "duplicate") return { tone: "error", text: "Username already exists." };
  if (error === "self") return { tone: "warning", text: "You cannot delete your own account." };
  return null;
}

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const params = (await searchParams) ?? {};
  await requireAdmin();
  const supabase = getSupabaseAdmin();
  const { data: staff } = await supabase
    .from("staff_users")
    .select("id, full_name, username, role, active, created_at")
    .order("created_at", { ascending: false });

  const editId = params.edit ? Number(params.edit) : null;
  const staffToEdit = editId ? staff?.find((member) => member.id === editId) : null;
  const message = getMessage(params.error, params.success);

  async function addStaffAction(formData: FormData) {
    "use server";
    const fullName = String(formData.get("full_name") || "").trim();
    const username = String(formData.get("username") || "").trim();
    const password = String(formData.get("password") || "");
    const role = String(formData.get("role") || "staff");

    if (!fullName || !username || !password) {
      redirect("/staff?error=missing");
    }

    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from("staff_users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existing) {
      redirect("/staff?error=duplicate");
    }

    const passwordHash = await hash(password, 10);
    await supabase.from("staff_users").insert({
      full_name: fullName,
      username,
      password_hash: passwordHash,
      role,
      active: true,
    });
    redirect("/staff?success=added");
  }

  async function updateStaffAction(formData: FormData) {
    "use server";
    const id = Number(formData.get("staff_id"));
    const fullName = String(formData.get("full_name") || "").trim();
    const username = String(formData.get("username") || "").trim();
    const role = String(formData.get("role") || "staff");
    const active = formData.get("active") === "on";

    if (!id || !fullName || !username) {
      redirect(`/staff?edit=${id}&error=missing`);
    }

    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from("staff_users")
      .select("id")
      .eq("username", username)
      .neq("id", id)
      .maybeSingle();

    if (existing) {
      redirect(`/staff?edit=${id}&error=duplicate`);
    }

    await supabase
      .from("staff_users")
      .update({
        full_name: fullName,
        username,
        role,
        active,
      })
      .eq("id", id);
    redirect("/staff?success=updated");
  }

  async function deleteStaffAction(formData: FormData) {
    "use server";
    const id = Number(formData.get("staff_id"));
    const session = await getSession();
    if (session?.id === id) {
      redirect("/staff?error=self");
    }

    const supabase = getSupabaseAdmin();
    await supabase.from("staff_users").delete().eq("id", id);
    redirect("/staff?success=deleted");
  }

  return (
    <div className="space-y-8">
      <Topbar
        title="Staff Accounts"
        subtitle="Create and manage staff access for the front desk."
      />

      {message ? (
        <Popup
          tone={message.tone}
          title={message.tone === "success" ? "Success" : "Notice"}
          message={message.text}
        />
      ) : null}

      <section className="surface p-6">
        <h2 className="text-xl text-[var(--plum)]">
          {staffToEdit ? "Edit Staff" : "Add Staff"}
        </h2>
        <form
          action={staffToEdit ? updateStaffAction : addStaffAction}
          className="mt-5 grid gap-4 md:grid-cols-2"
        >
          {staffToEdit ? (
            <input type="hidden" name="staff_id" value={staffToEdit.id} />
          ) : null}
          <input
            name="full_name"
            placeholder="Full Name"
            defaultValue={staffToEdit?.full_name ?? ""}
            className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
          />
          <input
            name="username"
            placeholder="Username"
            defaultValue={staffToEdit?.username ?? ""}
            className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
          />
          {!staffToEdit ? (
            <input
              name="password"
              type="password"
              placeholder="Temporary Password"
              className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
            />
          ) : null}
          <select
            name="role"
            defaultValue={staffToEdit?.role ?? "staff"}
            className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
          >
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              name="active"
              type="checkbox"
              defaultChecked={staffToEdit?.active ?? true}
            />
            Active
          </label>
          <button className="rounded-xl bg-[var(--plum)] px-6 py-3 text-sm font-semibold text-white md:col-span-2">
            {staffToEdit ? "Update Staff Account" : "Create Staff Account"}
          </button>
          {staffToEdit ? (
            <a
              href="/staff"
              className="button-link rounded-xl border border-[var(--border)] px-6 py-3 text-sm font-semibold text-[var(--plum)] md:col-span-2"
            >
              Cancel
            </a>
          ) : null}
        </form>
      </section>

      <section className="surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl text-[var(--plum)]">Staff Directory</h2>
          <span className="text-xs uppercase tracking-[0.2em] text-[var(--mauve)]">
            {staff?.length ?? 0} accounts
          </span>
        </div>
        <div className="mt-6 overflow-auto">
          <table className="w-full min-w-[540px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.2em] text-[var(--mauve)]">
              <tr>
                <th className="pb-3">Name</th>
                <th className="pb-3">Username</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-[var(--ink)]">
              {staff?.map((member) => (
                <tr key={member.id} className="border-t border-[var(--border)]">
                  <td className="py-4 font-semibold">{member.full_name}</td>
                  <td className="py-4">{member.username}</td>
                  <td className="py-4 capitalize">{member.role}</td>
                  <td className="py-4">{member.active ? "Active" : "Disabled"}</td>
                  <td className="py-4 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <a
                        href={`/staff?edit=${member.id}`}
                        className="button-link rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.2em]"
                      >
                        Edit
                      </a>
                      <form action={deleteStaffAction}>
                        <input type="hidden" name="staff_id" value={member.id} />
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

