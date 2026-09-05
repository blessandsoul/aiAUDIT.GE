'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Globe, Plus, ArrowRight, LoaderCircle, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { PublicScan } from '@/lib/audit-public-sources';
import type { IntakeState } from '@/lib/audit-engine';

export type ScanPayload = { scan: PublicScan; content: string; suggestions: string[]; intakeState: IntakeState };
interface Props { isOpen: boolean; onClose: () => void; onApplyScan: (payload: ScanPayload) => void }

export function ChannelScannerModal({ isOpen, onClose, onApplyScan }: Props) {
  const [website, setWebsite] = useState('');
  const [socials, setSocials] = useState(['', '']);
  const [showSocials, setShowSocials] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ScanPayload | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!isOpen) { abortRef.current?.abort(); setScanning(false); }
    return () => abortRef.current?.abort();
  }, [isOpen]);

  async function scan(event: FormEvent) {
    event.preventDefault();
    if (scanning) return;
    const urls = [website, ...socials].map((url) => url.trim()).filter(Boolean);
    if (!urls.length) return;
    const controller = new AbortController(); abortRef.current = controller;
    setScanning(true); setError(''); setResult(null);
    try {
      let response = await fetch('/api/ai-intake/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urls }), signal: controller.signal });
      let payload = await response.json();
      if (response.status === 202 && typeof payload.job === 'string') {
        const job = payload.job, deadline = Date.now() + 180_000;
        do {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          controller.signal.throwIfAborted();
          response = await fetch(`/api/ai-intake/scan?job=${encodeURIComponent(job)}`, {signal:controller.signal,cache:'no-store'});
          payload = await response.json();
        } while (response.status === 202 && Date.now() < deadline);
        if (response.status === 202) throw new Error('შემოწმება ჯერ არ დასრულებულა. შეგიძლიათ აუდიტი ბმულების გარეშე გააგრძელოთ.');
      }
      if (!response.ok) throw new Error(response.status === 429 ? 'შემოწმების ლიმიტი ამოიწურა. შეგიძლიათ გააგრძელოთ ბმულების გარეშე ან მოგვიანებით სცადოთ.' : payload.error || 'შემოწმება ვერ მოხერხდა. სცადეთ ხელახლა.');
      if (!controller.signal.aborted) setResult(payload);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'შემოწმება ვერ მოხერხდა.');
    } finally { if (abortRef.current === controller) setScanning(false); }
  }

  return <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="sourceDialog z-[2147483645] max-h-[88dvh] overflow-y-auto rounded-2xl bg-white p-6 sm:max-w-xl" overlayClassName="z-[2147483644] bg-slate-950/40 backdrop-blur-sm">
      <div className="flex items-center gap-3 pr-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Globe size={20} /></span>
        <div><DialogTitle className="text-base leading-relaxed text-slate-900">თქვენი ბიზნესი ონლაინ</DialogTitle>
          <DialogDescription className="mt-1 text-xs leading-relaxed text-slate-500">საიტი და სოციალური ქსელები — აუდიტის საწყისი კონტექსტი.</DialogDescription></div>
      </div>
      {!result ? <form onSubmit={scan} className="space-y-4">
        <p className="text-sm leading-relaxed text-slate-600">წავიკითხავთ ხელმისაწვდომ საჯარო გვერდებს და გაჩვენებთ წყაროებს. შემდეგ დავაზუსტებთ იმას, რაც მხოლოდ თქვენ იცით.</p>
        <div><label htmlFor="audit-website" className="mb-1.5 block text-xs font-semibold text-slate-700">კომპანიის საიტი <span className="font-normal text-slate-400">· არასავალდებულო</span></label>
          <input id="audit-website" type="text" inputMode="url" autoComplete="url" placeholder="https://yourcompany.ge" value={website} disabled={scanning} maxLength={600} onChange={(e) => setWebsite(e.target.value)} className="sourceInput" /></div>
        {!showSocials ? <button type="button" onClick={() => setShowSocials(true)} className="inline-flex items-center gap-2 text-sm font-medium text-indigo-700"><Plus size={16} /> სოციალური ქსელების დამატება</button> :
          <div className="space-y-3">{['Instagram', 'Facebook'].map((label, i) => <div key={label}>
            <label htmlFor={`audit-social-${i}`} className="mb-1 block text-xs font-semibold text-slate-700">{label} — გვერდის ბმული</label>
            <input id={`audit-social-${i}`} type="text" inputMode="url" value={socials[i]} maxLength={600} disabled={scanning} placeholder={['https://instagram.com/yourcompany', 'https://facebook.com/yourcompany', 'https://tiktok.com/@yourcompany'][i]} onChange={(e) => setSocials((old) => old.map((url, index) => index === i ? e.target.value : url))} className="sourceInput" />
          </div>)}</div>}
        <p className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">საიტზე — მაქსიმუმ 3 გვერდი; თითო სოციალურ ქსელში — 10 პუბლიკაცია და 50 კომენტარი. საჯარო ბმულები დასამუშავებლად Apify-ს გადაეცემა. ვიდეოს შინაარსს, დახურულ პროფილებსა და მიმოწერას არ ვაანალიზებთ. შემოწმებას შეიძლება 2–3 წუთი დასჭირდეს. ეს შერჩეული მასალაა და არა სრული ისტორია.</p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {scanning && <p role="status" className="flex items-center gap-2 text-sm text-indigo-700"><LoaderCircle className="animate-spin" size={16} /> საჯარო გვერდების შემოწმება და AI ანალიზი…</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="text-xs font-medium text-slate-500">{scanning ? 'გაუქმება' : 'ბმულების გარეშე გაგრძელება'}</button>
          <button type="submit" disabled={scanning || ![website, ...socials].some((url) => url.trim())} className="sourcePrimary"><span>გვერდების შემოწმება</span><ArrowRight size={16} /></button>
        </div>
      </form> : <div className="space-y-4">
        <div className="space-y-2">{result.scan.sources.map((source) => <div key={source.id} className="rounded-xl border border-slate-200 p-3">
          <div className="flex items-start justify-between gap-3"><a href={source.url} target="_blank" rel="noopener noreferrer" className="min-w-0 break-all text-xs font-medium text-indigo-700">{source.url} <ExternalLink size={11} className="inline" /></a>
            <span className={`shrink-0 text-[11px] ${source.status === 'read' ? 'text-indigo-700' : 'text-slate-500'}`}>{source.status === 'read' ? 'წაკითხულია' : source.status === 'restricted' ? 'წვდომა შეზღუდულია' : 'მიუწვდომელია'}</span></div>
          <p className="mt-1 text-[10px] text-slate-400">{source.id} · {new Date(source.checkedAt).toLocaleString('ka-GE')}</p>
          {source.provider === 'apify' && <details className="mt-2 text-xs text-slate-600"><summary className="cursor-pointer">წყაროს ტექსტი · {source.recordType === 'comment' ? 'კომენტარი' : 'პუბლიკაცია'}</summary><p className="mt-2 whitespace-pre-wrap break-words">{source.excerpt}</p><p className="mt-2 break-all">Apify · {source.runId} · {source.receiptId}</p><p>მიღებულია მომწოდებლისგან; ორიგინალთან დამოუკიდებლად არ არის გადამოწმებული.</p></details>}
      </div>)}</div>
        <p className="text-xs text-slate-600">მიღებულია: {result.scan.sources.filter((s) => s.recordType === 'post').length} პუბლიკაცია; {result.scan.sources.filter((s) => s.recordType === 'comment').length} კომენტარი. ნული მიღებული კომენტარი არ ნიშნავს, რომ გვერდზე კომენტარები საერთოდ არ არის.</p>
        {result.scan.observations.length > 0 && <div className="space-y-2"><h4 className="text-xs font-semibold text-slate-700">AI-ის მიერ შერჩეული ციტატები საჯარო გვერდებიდან</h4>
          {result.scan.observations.map((item, i) => <blockquote key={i} className="border-l-2 border-indigo-200 pl-3 text-sm leading-relaxed text-slate-600">„{item.quote}“ <span className="text-xs text-indigo-500">[{item.sourceId}]</span></blockquote>)}
        </div>}
        {result.scan.aiStatus === 'unavailable' && <p className="text-xs text-slate-500">AI ანალიზი ვერ შესრულდა. ქვემოთ აუდიტი თქვენს პასუხებზე დაყრდნობით გაგრძელდება.</p>}
        {result.scan.aiStatus === 'reviewed' && !result.scan.observations.length && <p className="text-xs text-slate-500">გვერდებიდან ბიზნესის შესახებ საკმარისად კონკრეტული ინფორმაცია ვერ გამოვყავით.</p>}
        <p className="text-xs leading-relaxed text-slate-500">ეს არის საჯარო გვერდების ტექსტი და არა დადასტურებული დიაგნოზი. გაყიდვების, დანაკარგებისა და შიდა პროცესების შესახებ კითხვებს ცალკე დაგისვამთ.</p>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={() => setResult(null)} className="text-xs text-slate-500">ბმულების შეცვლა</button>
          <button type="button" className="sourcePrimary" onClick={() => { onApplyScan(result); onClose(); }}>აუდიტის გაგრძელება <ArrowRight size={16} /></button></div>
      </div>}
    </DialogContent>
  </Dialog>;
}
