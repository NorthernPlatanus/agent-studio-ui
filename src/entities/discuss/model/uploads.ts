/**
 * Reading a file the operator picked, to attach to the planner prompt.
 *
 * The planner prompt is **text**. That is not a limitation of this panel — there
 * is no image channel anywhere in `nodes/discuss`, so a screenshot cannot reach
 * the planner in any form. Rejecting one here, by name and with the reason, is
 * the honest version; the alternative is a page of U+FFFD that spends context
 * and tells the planner nothing. The server enforces the same rule (it is the
 * one that must, since a client is not a gate), and this is the copy an operator
 * actually sees.
 */

import type { components } from "@/shared/api/generated";

export type UploadedPin = components["schemas"]["UploadedPin"];

/** Mirrors `StartDiscussRequest.uploads` `max_length`. */
export const MAX_PINS = 32;

/**
 * A hard ceiling on what is worth reading into a browser string at all.
 *
 * Well above the pin cap on purpose: a file a little over the cap should be read
 * and truncated with the truncation reported, which is the useful outcome. This
 * only stops someone dropping a 900MB core dump onto the page.
 */
const MAX_READ_BYTES = 8 * 1024 * 1024;

export class UploadRejected extends Error {}

/**
 * Extensions that are definitely not text, checked before reading.
 *
 * A prefix check on `file.type` would be neater, but browsers leave `type`
 * empty for plenty of ordinary files (`.md` and `.log` among them), so it
 * cannot be the test — an empty type has to mean "read it and see". This list
 * exists only to fail the common cases fast and by name; the decode check below
 * is what actually decides.
 */
const BINARY_EXTENSIONS =
  /\.(png|jpe?g|gif|webp|avif|bmp|ico|tiff?|heic|pdf|zip|gz|tgz|bz2|xz|7z|rar|mp[34]|mov|avi|mkv|webm|wav|flac|ogg|woff2?|ttf|otf|eot|so|dylib|dll|exe|bin|class|jar|wasm|sqlite3?|db|glb|gltf|fbx|blend|psd|ai|sketch)$/i;

/** Above this share of U+FFFD the "text" is a binary decoded with replacement. */
const MAX_REPLACEMENT_RATIO = 0.1;

function isImage(file: File): boolean {
  return file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|avif|bmp|heic)$/i.test(file.name);
}

/**
 * Reads one picked file into an `UploadedPin`, or throws `UploadRejected`.
 *
 * Truncation is left to the server: it owns the byte cap, and doing it twice is
 * how the two ends end up disagreeing about what "64KB" counted.
 */
export async function readUpload(file: File): Promise<UploadedPin> {
  if (file.size > MAX_READ_BYTES) {
    throw new UploadRejected(
      `${file.name} is ${Math.round(file.size / 1024 / 1024)}MB — too large to read. Attach the part that matters.`,
    );
  }
  if (isImage(file)) {
    throw new UploadRejected(
      `${file.name} is an image. The planner reads text only — there is no image channel in the planner prompt at all, so describe what it shows in your message instead.`,
    );
  }
  if (BINARY_EXTENSIONS.test(file.name)) {
    throw new UploadRejected(
      `${file.name} is a binary file. The planner reads text only — attach a text file, or paste the relevant part into your message.`,
    );
  }

  const text = await file.text();
  if (text.includes("\u0000")) {
    throw new UploadRejected(
      `${file.name} is a binary file. The planner reads text only — attach a text file, or paste the relevant part into your message.`,
    );
  }
  // `File.text()` decodes as UTF-8 with replacement, so anything that was not
  // text arrives as mostly U+FFFD. Counting them is what catches an unfamiliar
  // extension the list above does not name.
  const replacements = text.length - text.replaceAll("\uFFFD", "").length;
  if (text.length > 0 && replacements / text.length > MAX_REPLACEMENT_RATIO) {
    throw new UploadRejected(
      `${file.name} does not decode as text. The planner reads text only — attach a text file, or paste the relevant part into your message.`,
    );
  }
  if (text.trim() === "") {
    throw new UploadRejected(`${file.name} is empty — there is nothing to attach.`);
  }

  return { name: file.name, text };
}

/** How the server will name this upload, so a staged file reads as it will land. */
export function uploadDisplayPath(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? name;
  const cleaned = base
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120);
  return `uploaded/${cleaned === "" ? "upload.txt" : cleaned}`;
}
