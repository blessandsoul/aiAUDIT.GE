// Public observations are NOT client facts and never count toward product fit.
export type PublicSource = {
  id: string; url: string; checkedAt: string;
  status: 'read' | 'unavailable' | 'restricted';
  title: string; excerpt: string;
  provider?: 'apify'; recordType?: 'post' | 'comment'; runId?: string; datasetId?: string;
  verification?: 'provider_only'; receiptId?: string;
};
export type PublicObservation = { sourceId: string; kind: 'business' | 'offering' | 'contact' | 'booking'; quote: string };
export type PublicScan = { sources: PublicSource[]; observations: PublicObservation[]; aiStatus: 'reviewed' | 'unavailable' };

export function validateObservations(value: unknown, sources: PublicSource[]): PublicObservation[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((item): item is PublicObservation => {
    if (!item || typeof item !== 'object') return false;
    const { sourceId, kind, quote } = item;
    const source = sources.find((s) => s.id === sourceId && s.status === 'read');
    if (!source || !['business', 'offering', 'contact', 'booking'].includes(kind)
      || typeof quote !== 'string' || quote.length < 12 || quote.length > 320
      || !source.excerpt.includes(quote) || seen.has(quote)) return false;
    seen.add(quote); return true;
  }).slice(0, 4).map(({ sourceId, kind, quote }) => ({ sourceId, kind, quote }));
}
