'use client';

import { useState } from 'react';
import { Ico } from '@/components/common/Ico';

interface Message {
  sender: 'user' | 'bot';
  text: string;
  time: string;
}

export function LiveChatSimulator({
  productName = 'aiCHATS',
  onClose,
}: {
  productName?: string;
  onClose?: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'bot',
      text: 'გამარჯობა! მე ვარ თქვენი კომპანიის Nemo AI კონსულტანტი. რით შემიძლია დაგეხმაროთ?',
      time: '14:02',
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const testChips = [
    'რა ფასები გაქვთ?',
    'როდის შემიძლია ჩაწერა?',
    'სად მდებარეობთ?',
    'რა გარანტია გაქვთ?',
  ];

  const handleSend = (textToSend?: string) => {
    const q = textToSend || input;
    if (!q.trim()) return;

    const userMsg: Message = {
      sender: 'user',
      text: q,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsTyping(true);

    setTimeout(() => {
      let reply = 'ჩვენი სერვისების სრული პაკეტი მორგებულია თქვენს ბიუჯეტზე. გსურთ გამოგიგზავნოთ დეტალური პრეზენტაცია?';
      const lower = q.toLowerCase();
      if (lower.includes('ფას') || lower.includes('ღირს')) {
        reply = 'საბაზისო მომსახურება იწყება 220 ₾-დან თვეში. სრულ ბიზნეს-პაკეტში შედის 24/7 პასუხები, ლიდების ჩაწერა და CRM-ში გადაცემა.';
      } else if (lower.includes('ჩაწერ') || lower.includes('დრო') || lower.includes('ვიზიტ')) {
        reply = 'უახლოესი თავისუფალი დრო გვაქვს ხვალ 15:00-ზე ან ზეგ 11:30-ზე. რომელი საათი იქნება თქვენთვის მოსახერხებელი?';
      } else if (lower.includes('სად') || lower.includes('მისამართ')) {
        reply = 'ჩვენი ცენტრალური ოფისი მდებარეობს თბილისში, ჭავჭავაძის 37-ში. ასევე შეგვიძლია ონლაინ ზარით დეტალების გავლა.';
      }

      const botMsg: Message = {
        sender: 'bot',
        text: reply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 600);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-800">
            {productName} · Live ტესტ-დრაივი (Nemo AI)
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            დახურვა
          </button>
        )}
      </div>

      {/* Chat Messages Screen */}
      <div className="mt-3 h-56 overflow-y-auto space-y-2.5 pr-1 text-xs">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[82%] rounded-xl px-3 py-2 leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-slate-900 text-white rounded-br-none'
                  : 'bg-slate-100 text-slate-800 rounded-bl-none'
              }`}
            >
              <p>{m.text}</p>
              <span
                className={`block text-[10px] mt-1 ${
                  m.sender === 'user' ? 'text-slate-400 text-right' : 'text-slate-400'
                }`}
              >
                {m.time}
              </span>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="rounded-xl bg-slate-100 px-3 py-2 text-slate-500 rounded-bl-none flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-slate-400 animate-bounce" />
              <span className="size-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
              <span className="size-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      {/* Suggested Test Chips */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {testChips.map((chip, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSend(chip)}
            className="rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1 text-[11px] text-slate-700 transition"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="mt-2.5 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="დასვით შეკითხვა ტესტირებისთვის..."
          className="flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-slate-400"
        />
        <button
          type="button"
          onClick={() => handleSend()}
          className="grid size-7 place-items-center rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition"
        >
          <Ico name="solar:arrow-up-bold-duotone" className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
