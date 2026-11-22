"use client";

/**
 * next/image loader for the photo CDNs EVENT HUB uses.
 * Each CDN resizes and re-encodes on its edge, so the browser downloads
 * exactly the width a layout needs (AVIF/WebP where supported).
 * Uploaded organizer images will go through the same function once the
 * storage bucket exists (Milestone 6) — add its host here.
 */
export default function eventHubImageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}) {
  const q = quality ?? 72;
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return src; // local /public asset
  }

  if (url.hostname === "images.pexels.com") {
    url.search = "";
    url.searchParams.set("auto", "compress");
    url.searchParams.set("cs", "tinysrgb");
    url.searchParams.set("w", String(width));
    url.searchParams.set("dpr", "1");
    return url.toString();
  }

  if (url.hostname === "images.unsplash.com") {
    url.search = "";
    url.searchParams.set("w", String(width));
    url.searchParams.set("q", String(q));
    url.searchParams.set("auto", "format");
    url.searchParams.set("fit", "crop");
    return url.toString();
  }

  return src;
}
