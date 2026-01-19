import { redirect } from "next/navigation";
import { compare } from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createSessionToken, setSessionCookie, getSession } from "@/lib/auth";
import LoginSuccessGate from "@/components/LoginSuccessGate";

type LoginPageProps = {
  searchParams?: Promise<{ error?: string; success?: string; next?: string }>;
};

function getErrorMessage(code?: string) {
  switch (code) {
    case "missing":
      return "Enter both username and password.";
    case "inactive":
      return "This account is disabled.";
    case "invalid":
      return "Invalid username or password.";
    default:
      return "";
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const session = await getSession();
  if (session && params.success !== "login") {
    redirect("/dashboard");
  }

  const errorMessage = getErrorMessage(params.error);
  const successMessage = params.success === "login" ? "Login successful." : "";
  const nextPath = params.next || "/dashboard";

  async function loginAction(formData: FormData) {
    "use server";
    const username = String(formData.get("username") || "").trim();
    const password = String(formData.get("password") || "");

    if (!username || !password) {
      redirect("/login?error=missing");
    }

    const supabase = getSupabaseAdmin();
    const { data: staff } = await supabase
      .from("staff_users")
      .select("id, username, role, full_name, password_hash, active")
      .eq("username", username)
      .single();

    if (!staff) {
      redirect("/login?error=invalid");
    }

    if (!staff.active) {
      redirect("/login?error=inactive");
    }

    const valid = await compare(password, staff.password_hash);
    if (!valid) {
      redirect("/login?error=invalid");
    }

    const token = await createSessionToken({
      id: staff.id,
      username: staff.username,
      role: staff.role,
      fullName: staff.full_name,
    });
    await setSessionCookie(token);
    redirect("/login?success=login&next=/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="surface w-full max-w-md p-8">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--mauve)]">
            HotelTrack
          </p>
          <h1 className="mt-3 text-3xl text-[var(--plum)]">Staff Login</h1>
          <p className="muted mt-2 text-sm">
            Sign in to manage rooms, guests, and bookings.
          </p>
        </div>

        {successMessage ? <LoginSuccessGate nextPath={nextPath} /> : null}
        {errorMessage ? (
          <div className="mb-6 rounded-xl border border-[var(--danger)]/40 bg-[rgba(221,95,106,0.12)] px-4 py-3 text-sm text-[var(--danger)]">
            {errorMessage}
          </div>
        ) : null}

        <form action={loginAction} className="space-y-5">
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--mauve)]">
              Username
            </label>
            <input
              name="username"
              placeholder="Your username"
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm outline-none focus:border-[var(--mauve)]"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--mauve)]">
              Password
            </label>
            <input
              name="password"
              type="password"
              placeholder="Your password"
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm outline-none focus:border-[var(--mauve)]"
            />
          </div>
          <button className="w-full rounded-xl bg-[var(--plum)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--ink)]">
            Enter Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}
