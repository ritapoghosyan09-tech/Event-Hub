"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { INPUT } from "@/components/ui/Field";
import { checkIn, type CheckInState } from "@/app/studio/actions";

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => Detector;
  }
}

const REASON: Record<string, string> = {
  "not-found": "No ticket matches this code.",
  "wrong-event": "This ticket is for a different event.",
  already: "Already checked in.",
  void: "This ticket was cancelled.",
  "not-confirmed": "This booking isn't confirmed.",
};

export function DoorScanner({ orgId, eventId, total, checkedIn }: { orgId: string; eventId: string; total: number; checkedIn: number }) {
  const uid = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [count, setCount] = useState(checkedIn);
  const [camera, setCamera] = useState<"off" | "on" | "unsupported">("off");
  const [state, action, pending] = useActionState<CheckInState, FormData>(async (prev, form) => {
    const res = await checkIn(prev, form);
    if (res.result?.ok) setCount((c) => c + 1);
    return res;
  }, {});

  // After every result, clear the field and get ready for the next ticket.
  useEffect(() => {
    if (!state.at) return;
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.focus();
  }, [state.at]);

  useEffect(() => {
    if (camera !== "on") return;
    let stream: MediaStream | null = null;
    let stop = false;
    let last = "";
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new window.BarcodeDetector!({ formats: ["qr_code"] });
        while (!stop) {
          const codes = await detector.detect(videoRef.current).catch(() => []);
          const value = codes[0]?.rawValue;
          if (value && value !== last && inputRef.current) {
            last = value;
            inputRef.current.value = value;
            formRef.current?.requestSubmit();
            await new Promise((r) => setTimeout(r, 1500));
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch {
        setCamera("off");
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [camera]);

  const r = state.result;
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <p className="text-ink-muted">
          <span className="font-display text-[2.6rem] leading-none text-ink-strong tabular-nums">{count}</span> of {total} checked in
        </p>
        <form ref={formRef} action={action} className="mt-6 flex gap-3">
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="eventId" value={eventId} />
          <label htmlFor={`${uid}-code`} className="sr-only">Ticket code</label>
          <input ref={inputRef} id={`${uid}-code`} name="code" autoFocus autoComplete="off" required placeholder="Scan or paste the ticket's QR code" className={INPUT.replace("mt-1.5 ", "")} />
          <Button type="submit" size="lg" disabled={pending}>{pending ? "Checking…" : "Check in"}</Button>
        </form>
        <div className="mt-4">
          {camera === "on" ? (
            <div>
              <video ref={videoRef} muted playsInline className="aspect-[4/3] w-full rounded-card bg-night object-cover" />
              <Button variant="quiet" className="mt-3" onClick={() => setCamera("off")}>Stop camera</Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              onClick={() => setCamera(typeof window !== "undefined" && window.BarcodeDetector && navigator.mediaDevices ? "on" : "unsupported")}
            >
              Scan with camera
            </Button>
          )}
          {camera === "unsupported" && <p className="mt-2 text-sm text-ink-muted">This browser can&apos;t read QR codes from the camera. Use a handheld scanner, or Chrome on Android.</p>}
        </div>
      </div>

      <div aria-live="assertive" className="min-h-48">
        {state.error && <div className="rounded-sheet bg-[#f7e7e7] p-8 text-danger"><p className="font-display text-3xl">Couldn&apos;t check</p><p className="mt-2">{state.error}</p></div>}
        {r && r.ok && (
          <div key={state.at} className="rounded-sheet bg-[#e6efe6] p-8 text-success">
            <p className="font-display text-4xl">Welcome in</p>
            <p className="mt-3 text-lg text-ink-strong">{r.name ?? "Guest"}</p>
            <p className="text-ink-muted">{r.ticketType}, booking {r.code}</p>
          </div>
        )}
        {r && !r.ok && (
          <div key={state.at} className="rounded-sheet bg-[#f7e7e7] p-8 text-danger">
            <p className="font-display text-4xl">Don&apos;t admit</p>
            <p className="mt-3 text-lg">{REASON[r.reason]}</p>
            {r.name && <p className="text-ink-muted">{r.name}{r.at ? `, at ${new Date(r.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
