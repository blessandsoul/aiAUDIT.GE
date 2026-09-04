import { BANK, BRANCH_FIELDS, DECLINED, FIELDS, FOCUSES, UNKNOWN, l, type Field, type Focus, type Language } from './audit-bank.ts';
export type IntakeLanguage = Language;
export type FactStatus = 'confirmed' | 'estimated' | 'partial' | 'unknown' | 'declined' | 'not_applicable' | 'contradicted';
export type Fact = { id: string; field: Field; value: string; status: FactStatus; quote: string; turn: number; previous?: { value: string; quote: string } };
export type IntakeState = {
  version: 2; turn: number; language: Language; focus: Focus; focusQuote: string;
  facts: Partial<Record<Field, Fact>>; asked: Partial<Record<Field, number>>;
  currentQuestion: Field | null; complete: boolean; stopReason: 'enough' | 'limited' | null;
  history: Array<{ role: 'user' | 'assistant'; content: string }>; proof?: string;
};
export type Update = { field: Field; value: string; status: FactStatus; evidence: string; correction: boolean };
export type Extraction = { focus: Focus; focusEvidence: string; updates: Update[]; nextField: Field | null };
export const MAX_AUDIT_TURNS = 24;
export const known = (f?: Fact) => Boolean(f && ['confirmed', 'estimated'].includes(f.status));
const settled = (f?: Fact) => Boolean(f && !['partial', 'contradicted'].includes(f.status));
export const usable = (s: IntakeState, f: Field) => known(s.facts[f]);
export const val = (s: IntakeState, f: Field) => usable(s, f) ? s.facts[f]!.value : '';
export function createIntakeState(language: Language = 'ka'): IntakeState {
  return { version: 2, turn: 0, language, focus: 'discovery', focusQuote: '', facts: {}, asked: {}, currentQuestion: null, complete: false, stopReason: null, history: [] };
}
// HTTP callers must verify the signature before accepting state.
export function parseIntakeState(value: unknown): IntakeState {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 2) return createIntakeState();
  return structuredClone(value as IntakeState);
}
export function languageOf(text: string, previous: Language = 'ka'): Language {
  if (/[\u10a0-\u10ff]/u.test(text)) return 'ka';
  if (/[\u0400-\u04ff]/u.test(text)) return 'ru';
  if (/[a-z]{3}/iu.test(text)) return 'en';
  return previous;
}
export function requiredFields(s: IntakeState): Field[] {
  let branch = [...BRANCH_FIELDS[s.focus]];
  if (s.focus === 'growth') {
    if (['reach', 'enquiries'].includes(val(s, 'bottleneck'))) branch = ['bottleneck', 'acquisition', 'conversion'];
    if (val(s, 'bottleneck') === 'fulfilment') branch = ['bottleneck', 'process', 'repetition'];
  }
  if (s.focus === 'attribution' && ['none', 'ask'].includes(val(s, 'attribution'))) branch = ['attribution', 'reporting_gap', 'reporting_decision'];
  const core: Field[] = ['business', 'objective', 'pain', ...branch, 'process', 'scale', 'impact', 'severity'];
  if (s.focus === 'discovery') core.splice(2, 0, 'area');
  if (['none', 'minor'].includes(val(s, 'severity'))) return [...new Set<Field>([...core, 'priority_check'])];
  return [...new Set([...core, 'systems', 'data', 'alternative', 'owner', 'constraints', 'baseline', 'priority_check'] as Field[])];
}
export function questionFor(s: IntakeState): { field: Field; content: string; suggestions: string[] } | null {
  if (s.complete || !s.currentQuestion) return null;
  const field = s.currentQuestion, fact = s.facts[field], question = BANK[field];
  let content = question.text[s.language];
  if (fact?.status === 'contradicted' && fact.previous) {
    content = l(`ადრე თქვით: „${fact.previous.quote}“, ახლა კი: „${fact.quote}“. რომელი აღწერს ამჟამინდელ მდგომარეობას?`, `Ранее: «${fact.previous.quote}». Сейчас: «${fact.quote}». Что описывает текущее положение?`, `Earlier: “${fact.previous.quote}”. Now: “${fact.quote}”. Which describes the current situation?`)[s.language];
  } else if ((s.asked[field] ?? 0) > 1) {
    content += ' ' + l('შეგიძლიათ დაწეროთ შეფასება ან აირჩიოთ „არ ვიცი“.', 'Можно дать оценку или выбрать «Не знаю».', 'An estimate is fine, or choose “I don’t know”.')[s.language];
  }
  return { field, content, suggestions: [...question.options.map((o) => o.label[s.language]), UNKNOWN[s.language], DECLINED[s.language]] };
}
export function isControlAnswer(message: string): boolean {
  return /^(?:გასაგებია[,!]?\s*(?:მადლობა)?|მადლობა|დამატებითი დეტალები მაქვს|понятно|спасибо|есть дополнительные детали|thanks|thank you|okay|ok)[.!\s]*$/iu.test(message.trim());
}
// Routing hint only, never a confirmed fact or recommendation. An explicit
// influencer-measurement question must not get lost in generic growth intake.
export function attributionHint(message: string): boolean {
  const text = message.replace(/[\u200b-\u200f\u2060\ufeff]/gu, '').toLowerCase();
  return /ინფლუენსერ|ბლოგერ|influencer|blogger|блогер|инфлюенсер|инфлуенсер/u.test(text)
    && /წყარო|შეკვეთ|გაყიდვ|შედეგ|ეფექტიან|ანალიტიკ|გაზომ|დათვლ|attribut|source|order|sale|measur|effect|analytic|источник|заказ|продаж|измер|эффектив|аналитик|посчит/u.test(text);
}
export function exactChoice(s: IntakeState, message: string): Update | null {
  if (!s.currentQuestion) return null;
  const field = s.currentQuestion, text = message.trim();
  if (Object.values(UNKNOWN).includes(text)) return { field, value: '', status: 'unknown', evidence: text, correction: false };
  if (Object.values(DECLINED).includes(text)) return { field, value: '', status: 'declined', evidence: text, correction: false };
  const option = BANK[field].options.find((o) => Object.values(o.label).includes(text));
  return option ? { field, value: option.value, status: 'confirmed', evidence: text, correction: s.facts[field]?.status === 'contradicted' } : null;
}
export function advanceAudit(previous: IntakeState, message: string, extraction: Extraction, finish = false): IntakeState {
  const s = parseIntakeState(previous);
  delete s.proof;
  s.turn++; s.language = languageOf(message, s.language); s.complete = false; s.stopReason = null;
  s.history.push({ role: 'user', content: message });
  const control = isControlAnswer(message), direct = exactChoice(previous, message);
  const updates = control ? [] : [...extraction.updates.filter((u) => u.field !== direct?.field), ...(direct ? [direct] : [])];
  for (const u of updates) {
    if (!FIELDS.includes(u.field) || !u.evidence.trim() || !message.includes(u.evidence) || u.evidence.length > 600 || u.value.length > 400) continue;
    const options = BANK[u.field].options;
    if (['confirmed', 'estimated'].includes(u.status) && options.length && !options.some((o) => o.value === u.value)) continue;
    if (['unknown', 'declined', 'not_applicable'].includes(u.status) && u.field !== previous.currentQuestion) continue;
    const old = s.facts[u.field];
    const resolving = old?.status === 'contradicted' && previous.currentQuestion === u.field;
    const correction = resolving || (u.correction && /შესწორ|შეცდომ|არა[, ]|სინამდვილ|исправ|ошиб|не .+ а |на самом|correction|actually|meant|instead/iu.test(message));
    const conflict = old && known(old) && options.length > 0 && ['confirmed', 'estimated'].includes(u.status) && old.value !== u.value && !correction;
    if (old && known(old) && !['confirmed', 'estimated', 'contradicted'].includes(u.status) && !correction) continue;
    s.facts[u.field] = { id: `${u.field}:${s.turn}`, field: u.field, value: ['confirmed', 'estimated', 'contradicted'].includes(u.status) ? u.value : '', status: conflict ? 'contradicted' : u.status, quote: u.evidence, turn: s.turn,
      ...((conflict || u.status === 'contradicted') && old ? { previous: { value: old.value, quote: old.quote } } : {}),
    };
  }
  const selectedArea = s.facts.area;
  if (selectedArea && known(selectedArea) && FOCUSES.includes(selectedArea.value as Focus) && (s.focus === 'discovery' || selectedArea.turn === s.turn)) {
    s.focus = selectedArea.value as Focus; s.focusQuote = selectedArea.quote;
  }
  if (!control && extraction.focus !== 'discovery' && FOCUSES.includes(extraction.focus) && extraction.focusEvidence.length > 2 && message.includes(extraction.focusEvidence)
    && (s.focus === 'discovery' || s.focus === 'growth' || !known(previous.facts.pain) || val(s, 'priority_check') === 'another')) {
    s.focus = extraction.focus; s.focusQuote = extraction.focusEvidence;
    if (val(s, 'priority_check') === 'another') delete s.facts.priority_check;
  }
  if (!control && ['discovery', 'growth'].includes(s.focus) && attributionHint(message)) {
    s.focus = 'attribution'; s.focusQuote = message.slice(0, 600);
  }
  const required = requiredFields(s);
  const exhausted = finish || s.turn >= MAX_AUDIT_TURNS;
  const considered = (f: Field) => settled(s.facts[f]) || (s.asked[f] ?? 0) >= 2;
  const ready = s.focus !== 'discovery' && required.every(considered) && val(s, 'priority_check') !== 'another';
  if (ready || exhausted) {
    s.complete = true; s.stopReason = exhausted || required.some((f) => !usable(s, f)) ? 'limited' : 'enough'; s.currentQuestion = null;
    return s;
  }
  const missing = required.filter((f) => !considered(f));
  const conflict = missing.find((f) => s.facts[f]?.status === 'contradicted');
  const essential = missing.find((f) => BRANCH_FIELDS[s.focus].includes(f));
  const basics = missing.find((f) => ['business', 'objective'].includes(f));
  let target: Field = basics ?? conflict ?? essential ?? missing[0] ?? 'area';
  if (!basics && !conflict && !essential && extraction.nextField && missing.slice(0, 3).includes(extraction.nextField)) target = extraction.nextField;
  if (val(s, 'priority_check') === 'another') target = 'area';
  s.currentQuestion = target; s.asked[target] = (s.asked[target] ?? 0) + 1;
  return s;
}
export function isIntakeComplete(value: unknown): boolean {
  const s = parseIntakeState(value);
  return s.complete && s.turn > 0 && s.currentQuestion === null && (s.stopReason === 'limited' || requiredFields(s).every((f) => settled(s.facts[f])));
}
export function publicFactSummary(s: IntakeState): string[] {
  return Object.values(s.facts).filter(known).sort((a, b) => b!.turn - a!.turn).slice(0, 3).map((f) => `“${f!.quote}”`);
}
export function intakeProgress(s: IntakeState) {
  const fields = requiredFields(s);
  return { covered: fields.filter((f) => usable(s, f)).length, gaps: fields.filter((f) => !usable(s, f)).length, complete: s.complete,
    phase: s.complete ? 'report' : s.focus === 'discovery' ? 'context' : fields.filter((f) => usable(s, f)).length < 6 ? 'diagnosis' : 'feasibility' };
}
export type Verdict = 'measurement_first' | 'process_first' | 'pilot' | 'prepare' | 'not_now' | 'insufficient';
export function assess(s: IntakeState) {
  const evidence = requiredFields(s).filter((f) => usable(s, f));
  const result = (verdict: Verdict, product: string | null = null, supported = false) => ({ verdict, product, opportunity: supported ? 'supported' : 'limited',
    readiness: verdict !== 'measurement_first' && val(s, 'data') === 'ready' && val(s, 'owner') === 'available' && ['review', 'low_risk'].includes(val(s, 'constraints')) ? 'ready' : 'limited', evidence });
  if (!usable(s, 'business') || !usable(s, 'pain')) return result('insufficient');
  if (['minor', 'none'].includes(val(s, 'severity')) || val(s, 'alternative') === 'solved') return result('not_now');
  if (s.focus === 'attribution' && (['none', 'ask'].includes(val(s, 'attribution')) || ['missing', 'criteria'].includes(val(s, 'reporting_gap')) || ['no', 'partial'].includes(val(s, 'attribution_check')))) return result('measurement_first');
  if (s.focus === 'ads' && (['clicks', 'none'].includes(val(s, 'tracking')) || val(s, 'acquisition') === 'organic')) return result('measurement_first');
  if (s.focus === 'growth') return result(usable(s, 'bottleneck') ? 'process_first' : 'insufficient');
  if (s.focus === 'attribution') return result(usable(s, 'reporting_gap') ? 'process_first' : 'insufficient');
  if (val(s, 'repetition') === 'unique' || val(s, 'call_task') === 'expert' || val(s, 'docs_task') === 'decision'
    || val(s, 'response') === 'fine' || ['approval', 'none'].includes(val(s, 'content_gap'))) return result('process_first');
  const supported = BRANCH_FIELDS[s.focus].every((f) => usable(s, f)) && usable(s, 'process') && usable(s, 'scale') && usable(s, 'impact') && val(s, 'severity') === 'material' && ['repeatable', 'mixed'].includes(val(s, 'repetition'));
  if (!supported) return result('insufficient');
  if (val(s, 'constraints') === 'high_risk') return result('prepare', null, true);
  if (val(s, 'alternative') !== 'insufficient') return result('process_first', null, true);
  if (result('prepare').readiness !== 'ready') return result('prepare', null, true);
  const products: Partial<Record<Focus, string>> = { chats: 'aiCHATS', calls: 'aiCALL', ads: 'aiADS', content: 'aiCONTENT', docs: 'aiDOCS', web: 'aiWEB' };
  return products[s.focus] ? result('pilot', products[s.focus]!, true) : result('process_first', null, true);
}
