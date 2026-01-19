"use client";

import { useMemo, useState } from "react";

type RoomFormProps = {
  action: (formData: FormData) => void;
  room?: {
    id: number;
    room_number: string;
    room_type: string;
    status: string;
  } | null;
};

const capacityMap: Record<string, number> = {
  Single: 1,
  Double: 2,
  Family: 4,
};

export default function RoomForm({ action, room }: RoomFormProps) {
  const [roomType, setRoomType] = useState(room?.room_type ?? "");
  const capacity = useMemo(() => capacityMap[roomType] ?? "", [roomType]);

  return (
    <form
      action={action}
      className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto]"
    >
      {room ? <input type="hidden" name="room_id" value={room.id} /> : null}
      <input
        name="room_number"
        placeholder="Room Number"
        defaultValue={room?.room_number ?? ""}
        className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
      />
      <select
        name="room_type"
        value={roomType}
        onChange={(event) => setRoomType(event.target.value)}
        className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
      >
        <option value="">Select type</option>
        <option value="Single">Single</option>
        <option value="Double">Double</option>
        <option value="Family">Family</option>
      </select>
      <input
        name="capacity_display"
        value={capacity}
        readOnly
        placeholder="Pax"
        className="rounded-xl border border-[var(--border)] bg-[var(--fog)] px-4 py-3 text-sm"
      />
      <div className="flex gap-3">
        <button className="rounded-xl bg-[var(--plum)] px-6 py-3 text-sm font-semibold text-white">
          {room ? "Update Room" : "Save Room"}
        </button>
        {room ? (
          <a
            href="/rooms"
            className="button-link rounded-xl border border-[var(--border)] px-6 py-3 text-sm font-semibold text-[var(--plum)]"
          >
            Cancel
          </a>
        ) : null}
      </div>
    </form>
  );
}
