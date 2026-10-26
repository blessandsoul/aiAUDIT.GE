import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { advanceAudit, createIntakeState } from '../src/lib/audit-engine.ts';

const capturePath = new URL('./fixtures/audit-clinic-focus-capture.json', import.meta.url);
const capture = JSON.parse(fs.readFileSync(capturePath, 'utf8'));
const empty = { focus: 'discovery', focusEvidence: '', updates: [], nextField: null };

function extractionFromFacts(facts, focus = 'discovery') {
  return {
    focus,
    focusEvidence: '',
    updates: Object.values(facts).map((fact) => ({
      field: fact.field,
      value: fact.value,
      status: fact.status,
      evidence: fact.quote,
      correction: false,
    })),
    nextField: null,
  };
}

function update(field, value, evidence, status = 'confirmed') {
  return { field, value, status, evidence, correction: false };
}

function stateWithFacts(facts) {
  const s = createIntakeState('ka');
  s.focus = 'discovery';
  s.turn = 3;
  for (const fact of facts) {
    s.facts[fact.field] = {
      id: `${fact.field}:1`,
      field: fact.field,
      value: fact.value,
      status: fact.status ?? 'confirmed',
      quote: fact.quote,
      turn: 1,
    };
  }
  return s;
}

test('real provider capture uses current communication evidence to route Chats before area', () => {
  const intake = capture.intakeState;
  const next = advanceAudit(createIntakeState('ka'), capture.input, extractionFromFacts(intake.facts, intake.focus));

  assert.equal(next.focus, 'chats');
  assert.equal(next.focusQuote, intake.facts.process.quote);
  assert.notEqual(next.currentQuestion, 'area');
});

test('product or business-sector mentions alone do not infer Chats', () => {
  const cases = [
    ['We sell an Instagram chatbot for clinics.', 'business', 'clinic service'],
    ['კერძო კლინიკა ვართ და პაციენტებს ვემსახურებით.', 'business', 'კერძო კლინიკა'],
  ];

  for (const [message, field, value] of cases) {
    const next = advanceAudit(createIntakeState('ka'), message, {
      ...empty,
      updates: [update(field, value, message)],
    });
    assert.equal(next.focus, 'discovery', message);
  }
});

test('a denied-message statement cannot become Chats evidence', () => {
  const message = 'შეტყობინებები არ გვაქვს. ორი ადმინისტრატორი პასუხობს შეტყობინებებს; მსგავსი კითხვები მეორდება; პასუხი გვიანდება.';
  const next = advanceAudit(createIntakeState('ka'), message, {
    ...empty,
    updates: [
      update('channels', 'Instagram messages are absent', 'შეტყობინებები არ გვაქვს'),
      update('process', 'Two administrators answer messages', 'ორი ადმინისტრატორი პასუხობს შეტყობინებებს'),
      update('repetition', 'repeatable', 'მსგავსი კითხვები მეორდება'),
      update('response', 'delays', 'პასუხი გვიანდება'),
    ],
  });

  assert.notEqual(next.focus, 'chats');
});

test('facts from different workflows do not infer Chats without a communication workflow', () => {
  const message = 'Instagram-ში შეტყობინებები გვაქვს. შეკვეთებს Excel-ში ვამუშავებთ; ეს საქმე მეორდება; შეტყობინებაზე პასუხი გვიანდება.';
  const next = advanceAudit(createIntakeState('ka'), message, {
    ...empty,
    updates: [
      update('channels', 'Instagram messages', 'Instagram-ში შეტყობინებები გვაქვს'),
      update('process', 'Orders are processed in Excel', 'შეკვეთებს Excel-ში ვამუშავებთ'),
      update('repetition', 'repeatable', 'ეს საქმე მეორდება'),
      update('response', 'delays', 'შეტყობინებაზე პასუხი გვიანდება'),
    ],
  });

  assert.notEqual(next.focus, 'chats');
});

test('mixed calls and chats remain ambiguous instead of routing Chats', () => {
  const message = 'Instagram შეტყობინებებსაც და ზარებსაც ვპასუხობთ; ორი ადმინისტრატორი მსგავს კითხვებს ამუშავებს; პასუხი გვიანდება.';
  const next = advanceAudit(createIntakeState('ka'), message, {
    ...empty,
    updates: [
      update('channels', 'Instagram messages and calls', 'Instagram შეტყობინებებსაც და ზარებსაც'),
      update('process', 'Administrators answer messages and calls', 'ორი ადმინისტრატორი მსგავს კითხვებს ამუშავებს'),
      update('repetition', 'repeatable', 'მსგავს კითხვებს'),
      update('response', 'delays', 'პასუხი გვიანდება'),
    ],
  });

  assert.equal(next.focus, 'discovery');
});

test('an established specific focus is not overwritten by later written-channel facts', () => {
  const previous = createIntakeState('ka');
  previous.focus = 'calls';
  previous.turn = 3;
  previous.currentQuestion = 'process';
  const message = 'Instagram შეტყობინებებზე ორი ადმინისტრატორი პასუხობს; მსგავსი კითხვები მეორდება; პასუხი გვიანდება.';
  const next = advanceAudit(previous, message, {
    ...empty,
    updates: [
      update('channels', 'Instagram messages', 'Instagram შეტყობინებებზე'),
      update('process', 'Two administrators answer messages', 'ორი ადმინისტრატორი პასუხობს'),
      update('repetition', 'repeatable', 'მსგავსი კითხვები მეორდება'),
      update('response', 'delays', 'პასუხი გვიანდება'),
    ],
  });

  assert.equal(next.focus, 'calls');
});

test('old-ledger communication facts cannot route a new message to Chats', () => {
  const previous = stateWithFacts([
    { field: 'channels', value: 'Instagram messages', quote: 'Instagram შეტყობინებები' },
    { field: 'process', value: 'Administrators answer messages', quote: 'ადმინისტრატორები პასუხობენ შეტყობინებებს' },
    { field: 'repetition', value: 'repeatable', quote: 'მსგავსი კითხვები მეორდება' },
    { field: 'response', value: 'delays', quote: 'პასუხი გვიანდება' },
  ]);
  previous.currentQuestion = 'process';

  const next = advanceAudit(previous, 'ორი ადმინისტრატორი აგრძელებს ამ სამუშაოს.', {
    ...empty,
    updates: [update('process', 'Administrators continue this work', 'ორი ადმინისტრატორი აგრძელებს ამ სამუშაოს.')],
  });

  assert.equal(next.focus, 'discovery');
});

test('explicit current written workflow can route Chats from process and pain alone', () => {
  const cases = [
    ['en', 'We answer customer questions on WhatsApp, but replies are delayed by two hours.'],
    ['ru', 'Мы отвечаем на вопросы клиентов в WhatsApp, но ответы задерживаются на два часа.'],
    ['ka', 'WhatsApp-ში კლიენტების კითხვებს ვპასუხობთ, მაგრამ პასუხი ორი საათით გვიანდება.'],
  ];

  for (const [language, message] of cases) {
    const next = advanceAudit(createIntakeState(language), message, {
      ...empty,
      updates: [
        update('process', message, message),
        update('pain', message, message),
      ],
    });
    assert.equal(next.focus, 'chats', language);
  }
});

test('human-only wording in the current message vetoes the four-fact Chats route', () => {
  const message = 'Only a human answers WhatsApp customer questions. Similar questions recur. Replies are delayed.';
  const next = advanceAudit(createIntakeState('en'), message, {
    ...empty,
    updates: [
      update('channels', 'WhatsApp messages', 'WhatsApp'),
      update('process', 'A human answers customer questions', 'customer questions'),
      update('repetition', 'repeatable', 'Similar questions recur'),
      update('response', 'delays', 'Replies are delayed'),
    ],
  });

  assert.equal(next.focus, 'discovery');
});
