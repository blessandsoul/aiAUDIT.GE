export type DictationEvent = { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> };
// Recognition engines resend hypotheses and finalized results. Deliver each final once.
export function finalDictation(event: DictationEvent, delivered: Set<number>): string[] {
  const out: string[] = [];
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];
    if (!result.isFinal || delivered.has(i)) continue;
    delivered.add(i);
    const text = result[0]?.transcript.trim();
    if (text) out.push(text);
  }
  return out;
}
