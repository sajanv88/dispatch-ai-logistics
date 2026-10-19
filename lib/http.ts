import "server-only";

export const text = (message: string, status: number) =>
  new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

/**
 * A request's body as JSON, refused past `maxBytes` whatever its
 * Content-Length says.
 */
export async function readJson(
  request: Request,
  maxBytes: number,
  tooLong = "That request is too large.",
): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) {
    return { ok: false, response: text(tooLong, 413) };
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > maxBytes) return { ok: false, response: text(tooLong, 413) };
  try {
    return { ok: true, body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, response: text("The request wasn't JSON.", 400) };
  }
}
