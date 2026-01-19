"use client";

import { useEffect, useState } from "react";

type GuestOption = {
  id: number;
  full_name: string;
};

type RoomOption = {
  id: number;
  room_number: string;
  status: string;
};

type BookingFormProps = {
  guests: GuestOption[];
  minDateTime: string;
  action: (formData: FormData) => void;
};

export default function BookingForm({ guests, minDateTime, action }: BookingFormProps) {
  const [checkIn, setCheckIn] = useState("");
  const [stayHours, setStayHours] = useState("");
  const [pax, setPax] = useState("");
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [loading, setLoading] = useState(false);

  const canLoadRooms = checkIn && stayHours && pax;

  useEffect(() => {
    let active = true;

    async function fetchRooms() {
      if (!canLoadRooms) {
        setRooms([]);
        return;
      }

      setLoading(true);
      const params = new URLSearchParams({
        check_in: checkIn,
        stay_hours: stayHours,
        pax,
      });
      const res = await fetch(`/api/available-rooms?${params.toString()}`);
      const data = await res.json();
      if (active) {
        setRooms(data.rooms || []);
        setLoading(false);
      }
    }

    fetchRooms();
    return () => {
      active = false;
    };
  }, [checkIn, stayHours, canLoadRooms]);

  return (
    <form action={action} className="mt-5 grid gap-4 md:grid-cols-2">
      <select name="guest_id" className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm">
        <option value="">Select guest</option>
        {guests.map((guest) => (
          <option key={guest.id} value={guest.id}>
            {guest.full_name}
          </option>
        ))}
      </select>

      <select
        name="room_id"
        className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
        disabled={!canLoadRooms || loading}
      >
        {!canLoadRooms ? (
          <option value="">Select check-in, stay, and pax first</option>
        ) : loading ? (
          <option value="">Loading rooms...</option>
        ) : rooms.length ? (
          <>
            <option value="">Select room</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                Room {room.room_number}
              </option>
            ))}
          </>
        ) : (
          <option value="">No rooms available</option>
        )}
      </select>

      <label className="text-xs uppercase tracking-[0.2em] text-[var(--mauve)]">
        Check In
        <input
          name="check_in"
          type="datetime-local"
          min={minDateTime}
          value={checkIn}
          onChange={(event) => setCheckIn(event.target.value)}
          className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
        />
      </label>
      <label className="text-xs uppercase tracking-[0.2em] text-[var(--mauve)]">
        Stay (hours)
        <select
          name="stay_hours"
          value={stayHours}
          onChange={(event) => setStayHours(event.target.value)}
          className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
        >
          <option value="">Select hours</option>
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
          value={pax}
          onChange={(event) => setPax(event.target.value)}
          className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
        />
      </label>
      <button className="rounded-xl bg-[var(--plum)] px-6 py-3 text-sm font-semibold text-white md:col-span-2">
        Save Booking
      </button>
    </form>
  );
}
