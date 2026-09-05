'use client';
import { useEffect, useRef, useState } from 'react';
import { Ico } from '@/components/common/Ico';
import { finalDictation, type DictationEvent as RecognitionEvent } from '@/lib/audit-dictation';
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onstart: (() => void) | null; onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type Props = { onTranscript: (text: string) => void; onStatus?: (text: string) => void; language?: 'ka' | 'ru' | 'en'; disabled?: boolean; className?: string };
export function VoiceIntakeButton({ onTranscript, onStatus, language = 'ka', disabled = false, className = '' }: Props) {
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacks = useRef({ onTranscript, onStatus });
  useEffect(() => { callbacks.current = { onTranscript, onStatus }; }, [onTranscript, onStatus]);
  function clear() { if (timer.current) clearTimeout(timer.current); timer.current = null; }
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    const r = recognitionRef.current;
    if (r) { r.onend = null; r.onerror = null; r.onresult = null; r.onstart = null; r.abort(); }
  }, []);
  useEffect(() => { if (disabled) recognitionRef.current?.stop(); }, [disabled]);
  function toggle() {
    if (recognitionRef.current) { recognitionRef.current.stop(); return; }
    const speech = window as typeof window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Constructor = speech.SpeechRecognition || speech.webkitSpeechRecognition;
    if (!Constructor || !window.isSecureContext) {
      callbacks.current.onStatus?.('ამ ბრაუზერში ხმოვანი შეყვანა მიუწვდომელია. გამოიყენეთ კლავიატურის მიკროფონი ან აკრიფეთ პასუხი.'); return;
    }
    const r = new Constructor();
    let received = false, failed = false;
    const delivered = new Set<number>();
    r.lang = { ka: 'ka-GE', ru: 'ru-RU', en: 'en-US' }[language];
    r.continuous = false; r.interimResults = true;
    r.onstart = () => { setRecording(true); callbacks.current.onStatus?.('გისმენთ… ტექსტი გაგზავნამდე შეამოწმეთ.'); };
    r.onresult = (event) => {
      for (const text of finalDictation(event, delivered)) { received = true; callbacks.current.onTranscript(text); }
    };
    r.onerror = (event) => {
      failed = true;
      callbacks.current.onStatus?.(event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? 'მიკროფონზე წვდომა არ არის დაშვებული. შეამოწმეთ ბრაუზერის ნებართვა ან აკრიფეთ პასუხი.'
        : 'ხმის ამოცნობა ვერ მოხერხდა. სცადეთ ხელახლა ან გამოიყენეთ კლავიატურის მიკროფონი.');
      clear(); setRecording(false); recognitionRef.current = null;
    };
    r.onend = () => {
      clear(); setRecording(false); recognitionRef.current = null;
      if (!failed) callbacks.current.onStatus?.(received ? 'ტექსტი დამატებულია. შეამოწმეთ და შემდეგ გაგზავნეთ.' : 'საუბარი ვერ ამოვიცანით. სცადეთ ხელახლა ან აკრიფეთ პასუხი.');
    };
    recognitionRef.current = r;
    try { r.start(); timer.current = setTimeout(() => r.stop(), 60_000); }
    catch { clear(); recognitionRef.current = null; setRecording(false); callbacks.current.onStatus?.('მიკროფონის ჩართვა ვერ მოხერხდა. შეამოწმეთ ბრაუზერის ნებართვა.'); }
  }
  return <button type="button" disabled={disabled} onClick={toggle} className={`heroRoundBtn ${className}`} aria-pressed={recording}
    aria-label={recording ? 'ხმოვანი ჩაწერის შეჩერება' : 'ხმოვანი შეტყობინების დაწყება'} title={recording ? 'ჩაწერის შეჩერება' : `ხმოვანი შეყვანა · ${language.toUpperCase()}`}>
    <Ico name="solar:microphone-3-bold-duotone" className={`size-4 ${recording ? 'text-red-600 animate-pulse' : 'text-slate-600'}`} />
  </button>;
}
