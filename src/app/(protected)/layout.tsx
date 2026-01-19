import Sidebar from "@/components/Sidebar";
import { requireAuth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  let pendingApprovals = 0;
  if (user.role === "admin") {
    const supabase = getSupabaseAdmin();
    const { count } = await supabase
      .from("approval_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    pendingApprovals = count ?? 0;
  }

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <Sidebar
          role={user.role}
          fullName={user.fullName}
          pendingApprovals={pendingApprovals}
        />
        <div className="space-y-8">{children}</div>
      </div>
    </div>
  );
}
