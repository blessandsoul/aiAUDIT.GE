export class AuditRequestTooLarge extends Error {}
// Enough for the bounded signed social sample plus 30 owner turns, without
// duplicating the rendered report. Enforce bytes while reading, not afterwards.
export async function readAuditBody(request: Request, limit = 1_000_000): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Missing body');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new AuditRequestTooLarge('Request too large'); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
