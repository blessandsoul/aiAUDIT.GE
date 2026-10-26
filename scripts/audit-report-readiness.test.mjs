import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildFinalBrief } from '../src/lib/audit-report.ts';
import { DEEP_FIELDS } from '../src/lib/audit-deep-bank.ts';

const fixturePath = new URL('./fixtures/audit-clinic-readiness.json', import.meta.url);
const clinic = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

function copyState() {
  return structuredClone(clinic);
}

function report(state, language) {
  return buildFinalBrief(state, language);
}

test('clinic prepare report names the missing baseline, not confirmed data, owner, risk or workflow', () => {
  const expectations = {
    ka: { gap: /საწყისი მაჩვენებ/iu, falseHeader: /მონაცემების, პასუხისმგებელი პირის ან რისკის საკითხი|ზუსტი სამუშაო ნაბიჯები.*საწყისი მაჩვენებლები/iu, noPilot: /ჯერ არ დაიწყოთ პილოტ/iu },
    ru: { gap: /исходн(?:ый|ые) показател/iu, falseHeader: /вопрос данных, ответственного или риска|точные шаги работы.*исходные показатели/iu, noPilot: /(?:не начинайте пилот|пилот.*не начинайте)/iu },
    en: { gap: /baseline/iu, falseHeader: /data, ownership or risk needs attention|exact workflow.*baseline measures/iu, noPilot: /do not start a pilot/iu },
  };

  for (const [language, expected] of Object.entries(expectations)) {
    const output = report(copyState(), language);
    assert.match(output, expected.gap, language);
    assert.doesNotMatch(output, expected.falseHeader, language);
    assert.match(output, expected.noPilot, language);
  }
});

test('genuinely missing data, owner and high risk are still named in preparation reports', () => {
  const cases = [
    ['data', 'absent', 'ჯერ არ გვაქვს', { ka: /მონაცემ/iu, ru: /данн/iu, en: /data/iu }],
    ['owner', 'unavailable', 'პასუხისმგებელი ადამიანი ჯერ არ გვყავს', { ka: /პასუხისმგებელ/iu, ru: /ответствен/iu, en: /owner|reviewer/iu }],
    ['constraints', 'high_risk', 'შეცდომას სერიოზული შედეგი შეიძლება მოჰყვეს', { ka: /რისკ|ადამიანის კონტროლ/iu, ru: /риск|контрол/iu, en: /risk|human control/iu }],
  ];

  for (const [field, value, quote, patterns] of cases) {
    for (const language of ['ka', 'ru', 'en']) {
      const state = copyState();
      state.facts[field] = { ...state.facts[field], value, quote };
      const output = report(state, language);
      assert.match(output, patterns[language], `${field}/${language}`);
      assert.match(output, language === 'ka' ? /(?:ჯერ არ დაიწყოთ პილოტ|პილოტი ჯერ არ დაიწყოთ)/iu : language === 'ru' ? /(?:не (?:начинайте|запускайте) пилот|пилот.*(?:не начинайте|не запускайте))/iu : /do not start (?:a |an AI )?pilot/iu, `${field}/${language}`);
    }
  }
});

test('deep permission remains an explicit preparation gap without becoming a pilot', () => {
  for (const language of ['ka', 'ru', 'en']) {
    const state = copyState();
    state.mode = 'deep';
    state.facts.baseline = { id: 'baseline:10', field: 'baseline', value: '45 minutes', status: 'confirmed', quote: 'საშუალო პირველი პასუხი 45 წუთია', turn: 10 };
    for (const field of DEEP_FIELDS) {
      state.facts[field] = { id: `${field}:10`, field, value: field === 'permissions' ? 'pending' : field === 'review_capacity' ? 'available' : 'reported detail', status: 'confirmed', quote: `reported ${field}`, turn: 10 };
    }
    const output = report(state, language);
    const permission = language === 'ka' ? /ნებართ|ნებადართ/iu : language === 'ru' ? /разреш/iu : /permission|authorized/iu;
    const noPilot = language === 'ka' ? /პილოტ.*არ დაიწყოთ/iu : language === 'ru' ? /пилот.*не запускайте/iu : /do not start an AI pilot|do not start a pilot/iu;
    assert.match(output, permission, language);
    assert.match(output, noPilot, language);
  }
});

test('tracking-code preparation uses actual process and impact gaps without reopening a confirmed baseline', () => {
  const expectations = {
    ka: { gap: /დადასტურებული გავლენა|ზუსტი სამუშაო ნაბიჯები/iu, oldGate: /ზუსტი სამუშაო ნაბიჯები,? კოდის სანდო წყარო და საწყისი მაჩვენებლები/iu },
    ru: { gap: /подтверждённое влияние|точные шаги работы/iu, oldGate: /точные шаги работы.*исходные показатели/iu },
    en: { gap: /confirmed impact|exact workflow steps/iu, oldGate: /exact workflow.*baseline measures/iu },
  };

  for (const [language, expected] of Object.entries(expectations)) {
    const state = copyState();
    state.focusQuote = 'ვყიდი ტანსაცმელს და მინდა ავტომოპასუხე სოც ქსელებში';
    delete state.facts.process;
    delete state.facts.impact;
    state.facts.baseline = { id: 'baseline:10', field: 'baseline', value: '45 minutes', status: 'confirmed', quote: 'საშუალო პირველი პასუხი 45 წუთია', turn: 10 };
    state.facts.pain = { ...state.facts.pain, value: 'tracking-code error', quote: 'არასწორი თრექინგ კოდი მივწერე მომხმარებელს' };
    const output = report(state, language);
    assert.match(output, expected.gap, language);
    assert.doesNotMatch(output, expected.oldGate, language);
  }
});
