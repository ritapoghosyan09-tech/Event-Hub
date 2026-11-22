/**
 * Where organizer photos are kept.
 *
 *   S3-compatible bucket (Cloudflare R2, AWS S3, …) when S3_BUCKET,
 *   S3_ENDPOINT, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are set; files
 *   are served from NEXT_PUBLIC_MEDIA_BASE_URL.
 *
 *   Otherwise the server's disk (.data/uploads), served by /media/[...key].
 *   Fine for one server; use a bucket when running more than one instance.
 *
 * Every upload is decoded and re-encoded (sharp), which strips metadata such
 * as GPS location and rejects files that aren't really images.
 */
import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { AwsClient } from "aws4fetch";

const ROOT = resolve(/*turbopackIgnore: true*/ process.cwd(), ".data/uploads");
const MAX_BYTES = 12 * 1024 * 1024;

function bucket() {
  const { S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION, NEXT_PUBLIC_MEDIA_BASE_URL } = process.env;
  if (!S3_BUCKET || !S3_ENDPOINT || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) return null;
  return {
    client: new AwsClient({ accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY, region: S3_REGION || "auto", service: "s3" }),
    endpoint: `${S3_ENDPOINT.replace(/\/$/, "")}/${S3_BUCKET}`,
    publicBase: (NEXT_PUBLIC_MEDIA_BASE_URL || `${S3_ENDPOINT.replace(/\/$/, "")}/${S3_BUCKET}`).replace(/\/$/, ""),
  };
}

export class UploadError extends Error {}

/** Stores a photo and returns its public URL plus its size. */
export async function storeEventPhoto(file: File, eventId: string) {
  if (file.size === 0) throw new UploadError("Choose a photo to upload.");
  if (file.size > MAX_BYTES) throw new UploadError("Photos can be up to 12 MB.");
  let out: { data: Buffer; info: { width: number; height: number } };
  try {
    out = await sharp(Buffer.from(await file.arrayBuffer()), { failOn: "error" })
      .rotate() // respect the camera's orientation, then drop EXIF
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new UploadError("That file isn't a photo we can read. Use JPEG, PNG, WebP or AVIF.");
  }
  if (out.info.width < 800) throw new UploadError("Use a photo at least 800 pixels wide, so it stays sharp on large screens.");

  const key = `events/${eventId}/${randomUUID()}.webp`;
  const b = bucket();
  if (b) {
    const res = await b.client.fetch(`${b.endpoint}/${key}`, {
      method: "PUT",
      body: new Uint8Array(out.data),
      headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable" },
    });
    if (!res.ok) throw new Error(`Upload to bucket failed: ${res.status}`);
    return { url: `${b.publicBase}/${key}`, width: out.info.width, height: out.info.height };
  }
  const path = join(ROOT, key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, out.data);
  return { url: `/media/${key}`, width: out.info.width, height: out.info.height };
}

/** Reads a locally stored file for /media/[...key]. Returns null for anything outside the uploads folder. */
export async function readLocalMedia(key: string) {
  const path = normalize(join(ROOT, key));
  if (!path.startsWith(ROOT + "/")) return null;
  try {
    return await readFile(path);
  } catch {
    return null;
  }
}
