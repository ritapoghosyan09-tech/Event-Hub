"use client";

import Image from "next/image";
import { useActionState, useId, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormAlert, TextInput } from "@/components/ui/Field";
import { arrangePhoto, uploadPhoto, type FormState } from "@/app/studio/actions";

type Photo = { id: string; src: string; alt: string };

function Arrange({ orgId, eventId, image, first }: { orgId: string; eventId: string; image: Photo; first: boolean }) {
  const [, action, pending] = useActionState<FormState, FormData>(arrangePhoto, {});
  return (
    <form action={action} className="flex gap-2">
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="imageId" value={image.id} />
      {!first && (
        <button name="op" value="first" disabled={pending} className="rounded-full bg-cream/90 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-cream">
          Make cover
        </button>
      )}
      <button name="op" value="remove" disabled={pending} aria-label={`Remove photo: ${image.alt}`} className="rounded-full bg-cream/90 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-cream">
        Remove
      </button>
    </form>
  );
}

export function PhotoManager({ orgId, eventId, images }: { orgId: string; eventId: string; images: Photo[] }) {
  const uid = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const res = await uploadPhoto(prev, form);
    if (res.ok) formRef.current?.reset();
    return res;
  }, {});
  const err = (f: string) => (state.field === f ? state.error : undefined);

  return (
    <div>
      {images.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {images.map((img, i) => (
            <li key={img.id} className="group relative aspect-[4/3] overflow-hidden rounded-card bg-night-soft">
              <Image src={img.src} alt={img.alt} fill sizes="(min-width:1024px) 25vw, 50vw" className="object-cover" />
              {i === 0 && <span className="absolute left-3 top-3 rounded-tag bg-navy px-2 py-0.5 text-xs font-semibold text-cream">Cover</span>}
              <div className="absolute inset-x-3 bottom-3">
                <Arrange orgId={orgId} eventId={eventId} image={img} first={i === 0} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-card border border-dashed border-line bg-surface px-6 py-10 text-center text-ink-muted">No photos yet. The first one you add becomes the cover.</p>
      )}

      {images.length < 8 && (
        <form ref={formRef} action={action} className="mt-6 grid items-end gap-4 rounded-card bg-surface p-5 ring-1 ring-line/60 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto]">
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="eventId" value={eventId} />
          <Field id={`${uid}-file`} label="Photo" error={err("photo")}>
            <input
              id={`${uid}-file`}
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              required
              className="mt-1.5 block w-full text-sm text-ink file:mr-3 file:h-11 file:rounded-full file:border-0 file:bg-sunken file:px-4 file:text-sm file:font-semibold file:text-ink hover:file:bg-[var(--eh-beige-deep)]"
            />
          </Field>
          <Field id={`${uid}-alt`} label="What's in the photo" error={err("alt")}>
            <TextInput id={`${uid}-alt`} name="alt" required maxLength={200} placeholder="A crowd in front of the stage at night" error={err("alt")} />
          </Field>
          <Button type="submit" disabled={pending}>{pending ? "Uploading…" : "Add photo"}</Button>
          <p className="text-[13px] text-ink-subtle md:col-span-3">JPEG, PNG, WebP or AVIF, at least 800 pixels wide, up to 12 MB. Location data is removed.</p>
          {state.error && !state.field && <div className="md:col-span-3"><FormAlert>{state.error}</FormAlert></div>}
        </form>
      )}
    </div>
  );
}
