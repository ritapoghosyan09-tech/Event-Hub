import Image from "next/image";

const PHOTO = {
  src: "https://images.pexels.com/photos/1047443/pexels-photo-1047443.jpeg",
  alt: "A concert crowd with hands raised toward the stage",
};

/** Sign-in pages: the form on the left, a photograph from the catalogue on the right. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell grid min-h-dvh gap-12 pb-16 pt-28 md:pt-32 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
      <div className="mx-auto w-full max-w-[440px] lg:mx-0 lg:self-center lg:py-10">{children}</div>
      <div className="relative hidden overflow-hidden rounded-sheet lg:block">
        <Image src={PHOTO.src} alt={PHOTO.alt} fill priority sizes="(min-width:1024px) 50vw, 0px" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-night/70 via-night/10 to-transparent" />
        <p className="absolute inset-x-10 bottom-10 max-w-md font-display text-[2rem] leading-[1.1] text-cream">
          Your tickets, saved events and reminders, in one place.
        </p>
      </div>
    </div>
  );
}
