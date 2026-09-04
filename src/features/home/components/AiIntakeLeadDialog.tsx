'use client';

import { useEffect, useState, type FormEvent } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { IntakeState } from '@/lib/ai-intake-controller';
import type { ConversationMessage } from './HeroIntakeConversation';

import './ai-intake-lead-dialog.css';

interface AiIntakeLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: ConversationMessage[];
  intakeState: IntakeState | null;
  onSubmitted: () => void;
}

function isValidPhone(value: string): boolean {
  const trimmed = value.trim();
  return /^[+\d\s().-]+$/.test(trimmed) && /^\d{9,15}$/.test(trimmed.replace(/\D/g, ''));
}

export function AiIntakeLeadDialog({
  open,
  onOpenChange,
  messages,
  intakeState,
  onSubmitted,
}: AiIntakeLeadDialogProps) {
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && status !== 'success') setError('');
  }, [open, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!isValidPhone(phone)) {
      setError('შეიყვანეთ მოქმედი მობილურის ნომერი.');
      return;
    }
    if (!consent) {
      setError('გასაგზავნად საჭიროა თქვენი თანხმობა.');
      return;
    }
    if (!intakeState?.complete) {
      setError('ბრიფი ჯერ დასრულებული არ არის.');
      return;
    }

    setError('');
    setStatus('sending');
    try {
      const response = await fetch('/api/ai-intake/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          consent,
          website: '',
          messages: messages.map(({ role, content }) => ({ role, content })),
          intakeState,
        }),
      });
      if (!response.ok) throw new Error('Lead delivery failed');
      setStatus('success');
      onSubmitted();
    } catch {
      setStatus('idle');
      setError('გაგზავნა ვერ მოხერხდა. შეამოწმეთ კავშირი და სცადეთ ხელახლა.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="aiIntakeLeadDialog" overlayClassName="aiIntakeLeadBackdrop">
        {status === 'success' ? (
          <div className="aiIntakeLeadSuccess" role="status">
            <span className="aiIntakeLeadSuccessMark" aria-hidden="true">✓</span>
            <DialogTitle>აუდიტის ანგარიში მიღებულია</DialogTitle>
            <DialogDescription>
              თქვენი ნომერი და დიაგნოსტიკის შედეგები aiAUDIT-ის გუნდს გაეგზავნა.
            </DialogDescription>
            <button type="button" className="aiIntakeLeadSecondary" onClick={() => onOpenChange(false)}>
              დიალოგზე დაბრუნება
            </button>
          </div>
        ) : (
          <form className="aiIntakeLeadForm" onSubmit={handleSubmit} noValidate>
            <DialogHeader>
              <span className="aiIntakeLeadEyebrow">ბიზნეს აუდიტის დიაგნოსტიკა დასრულებულია</span>
              <DialogTitle>სად დაგიკავშირდეთ?</DialogTitle>
              <DialogDescription>
                დატოვეთ ნომერი. aiAUDIT-ის ექსპერტი გააანალიზებს დიაგნოსტიკის მონაცემებს და შემოგთავაზებთ მზა სამოქმედო გეგმას.
              </DialogDescription>
            </DialogHeader>

            <label className="aiIntakeLeadField">
              <span>მობილურის ნომერი</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+995 5XX XX XX XX"
                aria-invalid={Boolean(error) && !isValidPhone(phone)}
                autoFocus
              />
            </label>

            <label className="aiIntakeLeadConsent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
              />
              <span>ვეთანხმები, რომ ჩემი ნომერი და ამ დიალოგის პასუხები aiAUDIT-ის გუნდს გაეგზავნოს.</span>
            </label>

            <div className="aiIntakeLeadError" aria-live="polite">{error}</div>
            <button
              type="submit"
              className="aiIntakeLeadSubmit"
              disabled={status === 'sending'}
            >
              {status === 'sending' ? 'იგზავნება...' : 'აუდიტის მონაცემების გაგზავნა'}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
