import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAuditReport } from '../src/features/home/components/audit-report-parser.ts';
import { createIntakeState } from '../src/lib/audit-engine.ts';
import { buildFinalBrief } from '../src/lib/audit-report.ts';

const fixtures = [
  ['ka', 'მოკლე დასკვნა', 'შემდეგი ნაბიჯი — ერთი პრაქტიკული შემოწმება', 'რას გავზომავთ'],
  ['ru', 'Краткий вывод', 'Следующий шаг — одна практическая проверка', 'Что измерять'],
  ['en', 'Short conclusion', 'Next step — one practical check', 'What to measure'],
];

for (const [language, conclusion, next, measure] of fixtures) {
  test(`parses concise ${language} report headings into visible summary sections`, () => {
    const parsed = parseAuditReport([
      'aiAUDIT · Quick Audit',
      conclusion,
      'The decision is based on the current answers.',
      next,
      'Run one bounded check before changing the process.',
      measure,
      'Track the agreed baseline and outcome.',
    ].join('\n\n'));
    assert.deepEqual(parsed.sections.slice(0, 3).map((section) => section.key), ['conclusion', 'next', 'measure']);
    assert.deepEqual(parsed.sections.slice(0, 3).map((section) => section.heading), [conclusion, next, measure]);
  });
}

test('parses the actual concise growth report across all three languages', () => {
  const state = createIntakeState('ka');
  state.focus = 'growth';
  const facts = {
    business: ['shoe store', 'მაქვს ფეხსაცმლის მაღაზია'],
    objective: ['grow enquiries', 'მომხმარებლის მოზიდვა და გაყიდვები'],
    bottleneck: ['enquiries', 'ნახვა არის, მომართვა ცოტაა'],
    severity: ['minor', 'მცირე უხერხულობაა, ვუმკლავდებით'],
    priority_check: ['primary', 'ეს არის მთავარი პრიორიტეტი'],
  };
  for (const [field, [value, quote]] of Object.entries(facts)) {
    state.facts[field] = { id: `${field}:1`, field, value, quote, status: 'confirmed', turn: 1 };
  }
  for (const language of ['ka', 'ru', 'en']) {
    const parsed = parseAuditReport(buildFinalBrief(state, language));
    assert.deepEqual(parsed.sections.map(({ key }) => key), ['conclusion', 'next', 'measure', 'decide', 'evidence'], language);
    assert.deepEqual(parsed.fallback, [], language);
  }
});
