/**
 * How big an upload may be, and how to send one so a writer can see it move.
 *
 * Shared by the upload route and the screens that upload, so the browser can
 * say "too big" before spending five minutes of someone's mobile data on a file
 * the server would refuse at the end.
 */

export const MAX_IMAGE_MB = 20;
export const MAX_VIDEO_MB = 150;
export const MAX_IMAGE = MAX_IMAGE_MB * 1024 * 1024;
export const MAX_VIDEO = MAX_VIDEO_MB * 1024 * 1024;

const mb = (bytes: number) => `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;

/** A sentence for the writer if this file cannot go, otherwise null. */
export function tooBig(file: File): string | null {
  const isVideo = file.type.startsWith("video/");
  const isImage = file.type.startsWith("image/");
  if (isVideo && file.size > MAX_VIDEO) {
    return `${file.name} is ${mb(file.size)}. Videos can be up to ${MAX_VIDEO_MB} MB, about one to two minutes from a phone. Trim it, or upload it to YouTube or Facebook and paste the link into the article on its own line.`;
  }
  if (isImage && file.size > MAX_IMAGE) {
    return `${file.name} is ${mb(file.size)}. Photos can be up to ${MAX_IMAGE_MB} MB.`;
  }
  return null;
}

/**
 * POSTs a form with upload progress, which fetch() cannot report. Resolves
 * with the status and the parsed answer; a non-JSON answer (a web server's
 * own error page) comes back as an empty object rather than throwing.
 */
export function sendWithProgress(
  url: string,
  body: FormData,
  onProgress: (percent: number) => void,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    const finish = () => {
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch {
        data = {};
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data });
    };
    xhr.onload = finish;
    xhr.onerror = () => resolve({ ok: false, status: 0, data: {} });
    xhr.ontimeout = () => resolve({ ok: false, status: 0, data: {} });
    xhr.send(body);
  });
}

/** What to tell the writer when an upload fails, whatever failed. */
export function uploadFailure(name: string, status: number, data: Record<string, unknown>) {
  if (typeof data.error === "string") return data.error;
  if (status === 413) return `${name} is too big for the server. Videos can be up to ${MAX_VIDEO_MB} MB.`;
  if (status === 0) return `The connection dropped while sending ${name}. Check the signal and try again.`;
  return `Could not upload ${name}. Please try again.`;
}
