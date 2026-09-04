'use client';

import { useState, useRef, useEffect } from 'react';
import { Ico } from '@/components/common/Ico';

export function VoiceSamplePlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [persona, setPersona] = useState<'nata' | 'giorgi'>('nata');
  const [progress, setProgress] = useState(0);
  const animRef = useRef<NodeJS.Timeout | null>(null);

  const scriptText =
    persona === 'nata'
      ? '„გამარჯობა! მე ვარ თქვენი კომპანიის AI ხმოვანი ასისტენტი. რით შემიძლია დაგეხმაროთ დღეს?“'
      : '„გამარჯობა! aiNOW-ს ხმოვანი ოპერატორი გისმენთ. გსურთ მენეჯერთან შეერთება თუ შეკვეთის დაფიქსირება?“';

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (animRef.current) clearInterval(animRef.current);
      setProgress(0);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    } else {
      setIsPlaying(true);
      setProgress(0);

      if ('speechSynthesis' in window) {
        const utter = new SpeechSynthesisUtterance(
          persona === 'nata'
            ? 'გამარჯობა! მე ვარ თქვენი კომპანიის AI ხმოვანი ასისტენტი. რით შემიძლია დაგეხმაროთ დღეს?'
            : 'გამარჯობა! aiNOW-ს ხმოვანი ოპერატორი გისმენთ. გსურთ მენეჯერთან შეერთება თუ შეკვეთის დაფიქსირება?'
        );
        utter.lang = 'ka-GE';
        utter.rate = 1.0;
        utter.onend = () => {
          setIsPlaying(false);
          setProgress(100);
          if (animRef.current) clearInterval(animRef.current);
        };
        window.speechSynthesis.speak(utter);
      }

      // Progress animation
      animRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            setIsPlaying(false);
            if (animRef.current) clearInterval(animRef.current);
            return 0;
          }
          return prev + 2.5;
        });
      }, 100);
    }
  };

  useEffect(() => {
    return () => {
      if (animRef.current) clearInterval(animRef.current);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="grid size-6 place-items-center rounded-md bg-blue-50 text-blue-600">
            <Ico name="solar:phone-bold-duotone" className="size-4" />
          </div>
          <span className="text-xs font-bold text-slate-900">
            aiCALL · ცოცხალი ხმის დემონსტრაცია (ქართულად)
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => { setPersona('nata'); setIsPlaying(false); setProgress(0); }}
            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
              persona === 'nata'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ნატა (თბილი)
          </button>
          <button
            type="button"
            onClick={() => { setPersona('giorgi'); setIsPlaying(false); setProgress(0); }}
            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
              persona === 'giorgi'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            გიორგი (საქმიანი)
          </button>
        </div>
      </div>

      <div className="mt-3.5 flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-600 text-white shadow-md hover:bg-blue-700 transition active:scale-95"
        >
          <Ico
            name={isPlaying ? 'solar:pause-bold-duotone' : 'solar:play-bold-duotone'}
            className="size-5"
          />
        </button>

        <div className="flex-1">
          <p className="text-xs font-medium text-slate-700 italic">
            {scriptText}
          </p>
          {/* Animated Waveform */}
          <div className="mt-2 flex items-center gap-1 h-4">
            {[40, 75, 100, 60, 30, 85, 45, 90, 65, 35, 95, 50, 70, 30, 80, 45, 100, 60, 40].map(
              (h, i) => (
                <span
                  key={i}
                  className={`w-1 rounded-full bg-blue-500 transition-all duration-150 ${
                    isPlaying ? 'animate-pulse' : 'opacity-40'
                  }`}
                  style={{
                    height: isPlaying ? `${Math.max(15, (h * (progress % 30)) / 30)}%` : `${h * 0.3}%`,
                    animationDelay: `${(i % 5) * 0.1}s`,
                  }}
                />
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
