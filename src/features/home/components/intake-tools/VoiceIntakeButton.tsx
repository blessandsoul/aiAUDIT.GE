'use client';

import { useState, useRef } from 'react';
import { Ico } from '@/components/common/Ico';

type RecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type RecognitionConstructor = new () => Recognition;
type RecognitionWindow = Window & typeof globalThis & {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
};

interface VoiceIntakeButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
}

export function VoiceIntakeButton({
  onTranscript,
  className = '',
}: VoiceIntakeButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);

  const startListening = () => {
    setIsRecording(true);
    setRecordDuration(0);

    timerRef.current = setInterval(() => {
      setRecordDuration((prev) => prev + 1);
    }, 1000);

    const speechWindow = window as RecognitionWindow;
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'ka-GE';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentTranscript += event.results[i][0].transcript;
          }
          if (currentTranscript.trim()) {
            onTranscript(currentTranscript);
          }
        };

        recognition.onerror = () => {
          stopListening();
        };

        recognition.onend = () => {
          stopListening();
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.warn('SpeechRecognition error:', err);
      }
    } else {
      stopListening();
    }
  };

  const stopListening = () => {
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={toggleRecording}
        className={`heroRoundBtn ${isRecording ? 'bg-red-50 text-red-600 border-red-300' : ''} ${className}`}
        title={isRecording ? 'ჩაწერის შეჩერება' : 'ხმოვანი შეტყობინება (ქართულად)'}
        aria-label={isRecording ? 'ხმოვანი ჩაწერის შეჩერება' : 'ხმოვანი შეტყობინების დაწყება'}
      >
        <Ico
          name="solar:microphone-3-bold-duotone"
          className={`size-4 ${isRecording ? 'animate-pulse text-red-600' : 'text-slate-600'}`}
        />
      </button>

      {isRecording && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm animate-bounce">
          🎙️ ჩაწერა... 0:0{recordDuration}
        </span>
      )}
    </div>
  );
}
