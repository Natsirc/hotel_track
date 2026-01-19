"use client";

import { useState } from "react";

type BookingDateFieldsProps = {
  minDateTime: string;
};

export default function BookingDateFields({ minDateTime }: BookingDateFieldsProps) {
  const [checkIn, setCheckIn] = useState("");
  const [checkOutMin, setCheckOutMin] = useState(minDateTime);

  return (
    <>
      <label className="text-xs uppercase tracking-[0.2em] text-[var(--mauve)]">
        Check In
        <input
          name="check_in"
          type="datetime-local"
          min={minDateTime}
          value={checkIn}
          onChange={(event) => {
            const value = event.target.value;
            setCheckIn(value);
            setCheckOutMin(value || minDateTime);
          }}
          className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
        />
      </label>
      <label className="text-xs uppercase tracking-[0.2em] text-[var(--mauve)]">
        Check Out
        <input
          name="check_out"
          type="datetime-local"
          min={checkOutMin}
          className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
        />
      </label>
    </>
  );
}
