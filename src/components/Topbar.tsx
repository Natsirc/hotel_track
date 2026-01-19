import { clearSessionCookie } from "@/lib/auth";

type TopbarProps = {
  title: string;
  subtitle?: string;
};

export default function Topbar({ title, subtitle }: TopbarProps) {
  async function logoutAction() {
    "use server";
    await clearSessionCookie();
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-[var(--mauve)]">
          Hotel Operations
        </p>
        <h1 className="text-3xl text-[var(--plum)]">{title}</h1>
        {subtitle ? <p className="muted mt-2 text-sm">{subtitle}</p> : null}
      </div>
      <form action={logoutAction}>
        <button className="rounded-full border border-[var(--border)] px-5 py-2 text-xs uppercase tracking-[0.2em] text-[var(--plum)] transition hover:bg-[var(--plum)] hover:text-white">
          Sign Out
        </button>
      </form>
    </header>
  );
}
