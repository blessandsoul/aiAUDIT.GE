'use client';

import { useState } from 'react';
import { Ico } from '@/components/common/Ico';

interface ChannelScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyDiagnosis: (promptText: string) => void;
}

export function ChannelScannerModal({
  isOpen,
  onClose,
  onApplyDiagnosis,
}: ChannelScannerModalProps) {
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [tiktokHandle, setTiktokHandle] = useState('');
  const [facebookPage, setFacebookPage] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [scanResult, setScanResult] = useState<{
    sources: string[];
    recommendation: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleScan = () => {
    if (!websiteUrl && !instagramHandle && !tiktokHandle && !facebookPage) return;
    setScanning(true);
    setScanResult(null);
    setScanStep(1);

    setTimeout(() => setScanStep(2), 700);
    setTimeout(() => setScanStep(3), 1400);
    setTimeout(() => {
      setScanning(false);
      setScanResult({
        sources: [
          websiteUrl && `ვებსაიტი: ${websiteUrl}`,
          instagramHandle && `Instagram: @${instagramHandle.replace('@', '')}`,
          tiktokHandle && `TikTok: @${tiktokHandle.replace('@', '')}`,
          facebookPage && `Facebook: ${facebookPage}`,
        ].filter(Boolean) as string[],
        recommendation: 'ბმულები დაემატა თქვენს ბრიფს. შემდეგ AI დაგისვამთ სამ მიზნობრივ კითხვას; ზუსტი არხის აუდიტი კეთდება მხოლოდ შემოწმებადი წვდომისა და მონაცემების საფუძველზე.',
      });
    }, 1200);
  };

  const handleInjectIntoBrief = () => {
    if (!scanResult) return;
    const channels = [
      websiteUrl && `საიტი: ${websiteUrl}`,
      instagramHandle && `Instagram: @${instagramHandle.replace('@', '')}`,
      tiktokHandle && `TikTok: @${tiktokHandle.replace('@', '')}`,
      facebookPage && `Facebook: ${facebookPage}`,
    ].filter(Boolean).join(', ');

    const promptText = `ჩემს ბიზნესს აქვს ეს არხები: ${channels}. მინდა გავიგო, სად არის AI ავტომატიზაციის ყველაზე მაღალი პოტენციალი და რა მონაცემებია საჭირო ზუსტი აუდიტისთვის.`;
    onApplyDiagnosis(promptText);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1000000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
              <Ico name="solar:refresh-bold-duotone" className="size-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                ბიზნეს-არხების AI სკანერი
              </h3>
              <p className="text-xs text-slate-500">
                შეიყვანეთ ბმულები, რომ ისინი ბრიფს დაუკავშირდეს
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        {!scanResult ? (
          <div className="mt-5 space-y-3.5">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                <Ico name="solar:global-bold-duotone" className="size-3.5 text-slate-500" />
                <span>ვებსაიტი (Website URL)</span>
              </label>
              <input
                type="text"
                placeholder="https://mybusiness.ge"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                  <Ico name="solar:camera-bold-duotone" className="size-3.5 text-slate-500" />
                  <span>Instagram Handle</span>
                </label>
                <input
                  type="text"
                  placeholder="@mybrand"
                  value={instagramHandle}
                  onChange={(e) => setInstagramHandle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                  <Ico name="solar:play-circle-bold-duotone" className="size-3.5 text-slate-500" />
                  <span>TikTok Handle</span>
                </label>
                <input
                  type="text"
                  placeholder="@mybrand.tiktok"
                  value={tiktokHandle}
                  onChange={(e) => setTiktokHandle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                <Ico name="solar:users-group-two-rounded-bold-duotone" className="size-3.5 text-slate-500" />
                <span>Facebook გვერდი (Facebook Page)</span>
              </label>
              <input
                type="text"
                placeholder="facebook.com/mybrand"
                value={facebookPage}
                onChange={(e) => setFacebookPage(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {scanning && (
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100 text-xs text-slate-600 flex items-center gap-2.5">
                <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
                <span>
                  {scanStep === 1 && 'ბმულების ფორმატის შემოწმება...'}
                  {scanStep === 2 && 'არხების ბრიფთან დაკავშირება...'}
                  {scanStep === 3 && 'შემდეგი კითხვების მომზადება...'}
                </span>
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                გაუქმება
              </button>
              <button
                type="button"
                disabled={scanning || (!websiteUrl && !instagramHandle && !tiktokHandle && !facebookPage)}
                onClick={handleScan}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-sm transition"
              >
                <Ico name="solar:refresh-bold-duotone" className={`size-3.5 ${scanning ? 'animate-spin' : ''}`} />
                <span>{scanning ? 'მიმდინარეობს მომზადება...' : 'ბრიფში დამატება'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                ბრიფში დამატებული არხები:
              </h4>
              <ul className="space-y-1.5">
                {scanResult.sources.map((source, i) => (
                  <li key={i} className="text-xs text-slate-700 flex items-start gap-2">
                    <Ico name="solar:link-circle-bold-duotone" className="size-4 shrink-0 text-emerald-600" />
                    <span>{source}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
              <h4 className="text-xs font-bold text-slate-800 mb-1">
                შემდეგი ნაბიჯი:
              </h4>
              <p className="text-xs leading-relaxed text-slate-600 whitespace-pre-line">
                {scanResult.recommendation}
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setScanResult(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                ← ხელახლა შემოწმება
              </button>
              <button
                type="button"
                onClick={handleInjectIntoBrief}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition"
              >
                <Ico name="solar:check-circle-bold-duotone" className="size-3.5" />
                <span>ბრიფის გაგრძელება</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
