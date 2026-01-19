"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type SidebarProps = {
  role: "admin" | "staff";
  fullName: string;
  pendingApprovals?: number;
};

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Rooms", href: "/rooms" },
  { label: "Guests", href: "/guests" },
  { label: "Bookings", href: "/bookings" },
];

export default function Sidebar({ role, fullName, pendingApprovals = 0 }: SidebarProps) {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(pendingApprovals);

  useEffect(() => {
    if (role !== "admin") return;

    let active = true;
    fetch("/api/approval-count")
      .then((res) => (res.ok ? res.json() : { count: 0 }))
      .then((data) => {
        if (active && typeof data.count === "number") {
          setPendingCount(data.count);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [role]);

  return (
    <aside className="flex h-full flex-col justify-between rounded-3xl bg-[var(--card)]/90 p-6 shadow-[0_30px_80px_rgba(46,33,71,0.18)]">
      <div>
        <div className="mb-8 text-center">
          <p className="text-sm uppercase tracking-[0.5em] text-[var(--mauve)]">
            HOTEL
          </p>
          <h2 className="-mt-2 text-4xl text-[var(--plum)]">track</h2>
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-xl px-4 py-3 text-sm transition ${
                  isActive
                    ? "border border-[var(--mauve)]/40 bg-[rgba(235,211,248,0.6)] text-[var(--plum)]"
                    : "text-[var(--ink)] hover:bg-[rgba(235,211,248,0.45)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          {role === "admin" ? (
            <Link
              href="/staff"
              className={`block rounded-xl px-4 py-3 text-sm transition ${
                pathname.startsWith("/staff")
                  ? "border border-[var(--mauve)]/40 bg-[rgba(235,211,248,0.6)] text-[var(--plum)]"
                  : "text-[var(--ink)] hover:bg-[rgba(235,211,248,0.45)]"
              }`}
            >
              Staff
            </Link>
          ) : null}
          {role === "admin" ? (
            <Link
              href="/approval"
              className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm transition ${
                pathname.startsWith("/approval")
                  ? "border border-[var(--mauve)]/40 bg-[rgba(235,211,248,0.6)] text-[var(--plum)]"
                  : "text-[var(--ink)] hover:bg-[rgba(235,211,248,0.45)]"
              }`}
            >
              <span>Approval</span>
              {pendingCount > 0 ? (
                <span className="ml-2 inline-flex min-w-[20px] items-center justify-center rounded-full bg-[var(--mauve)] px-2 py-0.5 text-xs font-semibold text-white">
                  {pendingCount}
                </span>
              ) : null}
            </Link>
          ) : null}
        </nav>
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--fog)] px-4 py-3 text-xs">
        <p className="uppercase tracking-[0.2em] text-[var(--mauve)]">Signed in</p>
        <p className="mt-1 text-sm text-[var(--ink)]">{fullName}</p>
        <p className="mt-1 text-xs text-[var(--mauve)]">
          {role === "admin" ? "Administrator" : "Front Desk Staff"}
        </p>
      </div>
    </aside>
  );
}
