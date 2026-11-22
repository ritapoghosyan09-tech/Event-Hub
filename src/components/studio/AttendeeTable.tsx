"use client";

import { useDeferredValue, useId, useState } from "react";
import { INPUT } from "@/components/ui/Field";

type Row = { id: string; code: string; name: string; email: string; ticketType: string; status: string; checkedInAt: string | null; payment: string };

export function AttendeeTable({ rows }: { rows: Row[] }) {
  const uid = useId();
  const [q, setQ] = useState("");
  const query = useDeferredValue(q.trim().toLowerCase());
  const shown = query ? rows.filter((r) => `${r.name} ${r.email} ${r.code}`.toLowerCase().includes(query)) : rows;
  return (
    <div className="mt-6">
      <label htmlFor={`${uid}-q`} className="sr-only">Search attendees</label>
      <input id={`${uid}-q`} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email or booking code" className={`${INPUT} max-w-md`} />
      <div className="mt-5 overflow-x-auto rounded-card bg-surface ring-1 ring-line/60">
        <table className="w-full min-w-[720px] text-left text-[15px]">
          <thead className="border-b border-line text-sm text-ink-muted">
            <tr>
              <th scope="col" className="px-5 py-3 font-semibold">Name</th>
              <th scope="col" className="px-5 py-3 font-semibold">Ticket</th>
              <th scope="col" className="px-5 py-3 font-semibold">Booking</th>
              <th scope="col" className="px-5 py-3 font-semibold">Payment</th>
              <th scope="col" className="px-5 py-3 font-semibold">At the door</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-subtle">
            {shown.map((r) => (
              <tr key={r.id}>
                <td className="px-5 py-3">
                  <p className="font-semibold text-ink-strong">{r.name}</p>
                  <p className="text-sm text-ink-subtle">{r.email}</p>
                </td>
                <td className="px-5 py-3">{r.ticketType}</td>
                <td className="px-5 py-3 tabular-nums">{r.code}</td>
                <td className="px-5 py-3">{r.payment}</td>
                <td className="px-5 py-3">
                  {r.status === "CHECKED_IN" ? (
                    <span className="rounded-tag bg-[#e6efe6] px-2 py-0.5 text-xs font-semibold text-success">
                      In, {new Date(r.checkedInAt!).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  ) : (
                    <span className="text-sm text-ink-subtle">Not yet</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && <p className="px-5 py-8 text-center text-ink-muted">Nobody matches &ldquo;{q}&rdquo;.</p>}
      </div>
    </div>
  );
}
