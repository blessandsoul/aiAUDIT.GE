import { BANK, BRANCH_FIELDS, DECLINED, FIELDS, FOCUSES, UNKNOWN, l, type Field, type Focus, type Language } from './audit-bank.ts';
import { PRODUCT_CATALOG, PRODUCT_FOR_FOCUS, type ProductKey } from './audit-product-catalog.ts';
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
  if (['growth', 'attribution'].includes(s.focus)) return [...new Set<Field>([...core, 'systems', 'baseline', 'priority_check'])];
  // A human service, bespoke discovery, existing-app assessment and an unavailable
  // fleet direction do not need to masquerade as a ready-to-run AI automation.
  if (s.focus === 'staff') return [...new Set<Field>([...core, 'owner', 'priority_check'])];
  if (s.focus === 'fleet') return [...new Set<Field>([...core, 'priority_check'])];
  if (['app', 'rescue'].includes(s.focus)) return [...new Set<Field>([...core, 'systems', 'data', 'owner', 'constraints', 'baseline', 'priority_check'])];
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
  const anchorField: Partial<Record<Field, Field>> = { impact: 'pain', data: 'systems', alternative: 'pain', constraints: 'process' };
  const anchor = s.facts[anchorField[field] as Field];
  if ((s.asked[field] ?? 0) === 1 && anchor && known(anchor) && anchor.quote.length <= 180) {
    content = l(`თქვენ თქვით: „${anchor.quote}“. `, `Вы сказали: «${anchor.quote}». `, `You said: “${anchor.quote}”. `)[s.language] + content;
  }
  return { field, content, suggestions: [...question.options.map((o) => o.label[s.language]), UNKNOWN[s.language], DECLINED[s.language]] };
}
export function isControlAnswer(message: string): boolean {
  return /^(?:გასაგებია[,!]?\s*(?:მადლობა)?|მადლობა|დამატებითი დეტალები მაქვს|понятно|спасибо|есть дополнительные детали|thanks|thank you|okay|ok)[.!\s]*$/iu.test(message.trim());
}
export function uncertaintyAnswer(message: string): 'unknown' | 'declined' | null {
  if (/^(?:не знаю|не могу сказать|не измеряли|не считаем|არ ვიცი|არ ვითვლი|არ ვზომავთ|i don.?t know|we don.?t know|not measured)(?:[.!?,\s].*)?$/iu.test(message.trim())) return 'unknown';
  if (/^(?:не хочу отвечать|не хочу сообщать|არ მინდა პასუხ|არ მსურს პასუხ|prefer not to|i decline)/iu.test(message.trim())) return 'declined';
  return null;
}
// Routing hint only, never a confirmed fact or recommendation. An explicit
// influencer-measurement question must not get lost in generic growth intake.
export function attributionHint(message: string): boolean {
  const text = message.replace(/[\u200b-\u200f\u2060\ufeff]/gu, '').toLowerCase();
  return /ინფლუენსერ|ბლოგერ|influencer|blogger|блогер|инфлюенсер|инфлуенсер/u.test(text)
    && /წყარო|შეკვეთ|გაყიდვ|შედეგ|ეფექტიან|ანალიტიკ|გაზომ|დათვლ|attribut|source|order|sale|measur|effect|analytic|источник|заказ|продаж|измер|эффектив|аналитик|посчит/u.test(text);
}
// Routing is intentionally conservative: it only helps at the beginning of an
// audit. The model still has to extract quoted facts and the server still has
// to satisfy the product's independent evidence rules.
export function focusHint(message: string): Focus | null {
  const text = message.replace(/[\u200b-\u200f\u2060\ufeff]/gu, '').toLowerCase();
  if (/ავტონომ|robotaxi|ფლოტ|беспилот|автономн.{0,15}флот|robotaxi|autonomous.{0,15}fleet/u.test(text)) return 'fleet';
  if (/(?:არსებულ|existing|существующ).{0,40}(?:აპლიკ|прилож|app)|(?:ფუჭდ|лома|broken|maintain|поддерж).{0,40}(?:აპლიკ|прилож|app)|vibecod/u.test(text)) return 'rescue';
  if (/(?:ახალ|new|нов).{0,30}(?:აპლიკ|прилож|app|ინტეგрац|интеграц|integration)|(?:აპლიკ|прилож|app).{0,20}(?:აშენ|build|разработ)/u.test(text)) return 'app';
  if (/ცოცხალ.{0,15}(?:სპეციალისტ|მომსახურ)|live.{0,15}specialist|жив.{0,15}специалист/u.test(text)) return 'staff';
  if (/რეკლამ|реклам|paid ad|campaign|კამპანი/u.test(text)) return 'ads';
  if (/კონტენტ|контент|content.{0,20}(?:create|производ|შექმნ)/u.test(text)) return 'content';
  if (/დოკუმენტ|документ|invoice|ინვოის|накладн/u.test(text)) return 'docs';
  if (/საიტ|website|web.?site|лендинг/u.test(text)) return 'web';
  if (/შეკვეთ.{0,80}(?:excel|таблиц|სისტემ)|approval|დამტკიც|ручн.{0,15}(?:перенос|ввод)|ხელით.{0,50}(?:გადატან|შეყვან)/u.test(text)) return 'office';
  if (/(?<!\p{L})(?:ზარ(?:ი|ები|ებით|ების|ებს|ზე)|ვურეკავთ|ურეკავს|телефон\p{L}*|звон\p{L}*|calls?)(?!\p{L})/u.test(text)) return 'calls';
  if (/instagram|whatsapp|messenger|ვწერთ|შეტყობინ|сообщен|chat/u.test(text)) return 'chats';
  return null;
}
export function exactChoice(s: IntakeState, message: string): Update | null {
  if (!s.currentQuestion) return null;
  const field = s.currentQuestion, text = message.trim();
  if (Object.values(UNKNOWN).includes(text)) return { field, value: '', status: 'unknown', evidence: text, correction: false };
  if (Object.values(DECLINED).includes(text)) return { field, value: '', status: 'declined', evidence: text, correction: false };
  const uncertain = uncertaintyAnswer(text);
  if (uncertain && text.split(/[.!?]\s+/u).length === 1 && !/\b(?:но|but)\b|მაგრამ/u.test(text)) return { field, value: '', status: uncertain, evidence: text, correction: false };
  const option = BANK[field].options.find((o) => Object.values(o.label).includes(text));
  return option ? { field, value: option.value, status: 'confirmed', evidence: text, correction: s.facts[field]?.status === 'contradicted' } : null;
}
export function advanceAudit(previous: IntakeState, message: string, extraction: Extraction, finish = false): IntakeState {
  const s = parseIntakeState(previous);
  delete s.proof;
  s.turn++; s.language = languageOf(message, s.language); s.complete = false; s.stopReason = null;
  s.history.push({ role: 'user', content: message });
  const control = isControlAnswer(message), direct = exactChoice(previous, message);
  const modelUpdates = control ? [] : extraction.updates.filter((u) => u.field !== direct?.field);
  const updates = [...modelUpdates, ...(direct ? [direct] : [])];
  for (const u of updates) {
    if (!FIELDS.includes(u.field) || !u.evidence.trim() || !message.includes(u.evidence) || u.evidence.length > 600 || u.value.length > 400) continue;
    if (['confirmed', 'estimated'].includes(u.status) && uncertaintyAnswer(u.evidence)) continue;
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
  if (selectedArea && known(selectedArea) && FOCUSES.includes(selectedArea.value as Focus) && (s.focus === 'discovery' || previous.currentQuestion === 'area')) {
    s.focus = selectedArea.value as Focus; s.focusQuote = selectedArea.quote;
  }
  if (!control && extraction.focus !== 'discovery' && FOCUSES.includes(extraction.focus) && extraction.focusEvidence.length > 2 && message.includes(extraction.focusEvidence)
    && (s.focus === 'discovery' || !known(previous.facts.pain) || val(s, 'priority_check') === 'another'
      || /не .{0,40}(?:проблем|звон|документ)|вообще нет|не звоним|исправ|главная проблема|მთავარი პრობლემა|არ გვაქვს|არავის ვურეკავთ|გთხოვ|not .{0,30}problem|we don.t call|actually|instead/iu.test(message))) {
    s.focus = extraction.focus; s.focusQuote = extraction.focusEvidence;
    if (val(s, 'priority_check') === 'another') delete s.facts.priority_check;
  }
  if (!control && ['discovery', 'growth'].includes(s.focus) && attributionHint(message)) {
    s.focus = 'attribution'; s.focusQuote = message.slice(0, 600);
  }
  const hintedFocus = focusHint(message);
  // A direct first-turn product/process signal must beat a generic model route
  // such as "operations". It must not overwrite a later, specific diagnosis.
  const canApplyHint = s.turn === 1 && s.focus === 'operations' && hintedFocus === 'office';
  if (!control && hintedFocus && canApplyHint) {
    s.focus = hintedFocus; s.focusQuote = message.slice(0, 600);
  }
  // A switch of investigated process invalidates old process-specific evidence.
  // Current-message evidence can establish the new process; business context stays.
  if (previous.focus !== 'discovery' && s.focus !== previous.focus) {
    const context: Field[] = ['business', 'objective', 'channels', 'area'];
    for (const field of FIELDS) if (!context.includes(field)) {
      if (s.facts[field]?.turn !== s.turn || s.facts[field]?.status === 'contradicted') delete s.facts[field];
      delete s.asked[field];
    }
  }
  // An unrelated answer must not consume a question attempt or advance the interview.
  if (!finish && s.turn < MAX_AUDIT_TURNS && previous.currentQuestion && s.focus === previous.focus && !updates.length && !control) {
    s.currentQuestion = previous.currentQuestion;
    return s;
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
export type Verdict = 'measurement_first' | 'process_first' | 'pilot' | 'prepare' | 'not_now' | 'insufficient' | 'scoped_discovery' | 'technical_assessment' | 'human_service' | 'not_available';
export function assess(s: IntakeState) {
  const evidence = requiredFields(s).filter((f) => usable(s, f));
  const result = (verdict: Verdict, product: ProductKey | null = null, supported = false) => ({ verdict, product, opportunity: supported ? 'supported' : 'limited',
    readiness: verdict !== 'measurement_first' && val(s, 'data') === 'ready' && val(s, 'owner') === 'available' && ['review', 'low_risk'].includes(val(s, 'constraints')) ? 'ready' : 'limited', evidence });
  if (!usable(s, 'business') || !usable(s, 'pain')) return result('insufficient');
  if (s.focus === 'fleet') return result('not_available');
  if (['minor', 'none'].includes(val(s, 'severity')) || val(s, 'alternative') === 'solved') return result('not_now');
  if (s.focus === 'attribution' && (['none', 'ask'].includes(val(s, 'attribution')) || ['missing', 'criteria'].includes(val(s, 'reporting_gap')) || ['no', 'partial'].includes(val(s, 'attribution_check')))) return result('measurement_first');
  if (s.focus === 'ads' && (['clicks', 'none'].includes(val(s, 'tracking')) || val(s, 'acquisition') === 'organic')) return result('measurement_first');
  if (s.focus === 'calls' && ['cold', 'unclear'].includes(val(s, 'call_permission'))) return result('process_first');
  if (s.focus === 'growth') return result(usable(s, 'bottleneck') ? 'process_first' : 'insufficient');
  if (s.focus === 'attribution') return result(usable(s, 'reporting_gap') ? 'process_first' : 'insufficient');
  if (val(s, 'call_task') === 'expert' || val(s, 'docs_task') === 'decision'
    || val(s, 'response') === 'fine' || ['approval', 'none'].includes(val(s, 'content_gap'))) return result('process_first');
  const hasMaterialCase = BRANCH_FIELDS[s.focus].every((f) => usable(s, f)) && usable(s, 'process') && usable(s, 'scale') && usable(s, 'impact') && val(s, 'severity') === 'material';
  if (s.focus === 'staff') return hasMaterialCase && usable(s, 'owner') ? result('human_service', 'aiSTAFF', true) : result('insufficient');
  if (s.focus === 'app') {
    if (!hasMaterialCase) return result('insufficient');
    if (!usable(s, 'data') || !usable(s, 'owner') || !usable(s, 'constraints')) return result('prepare', null, true);
    return result('scoped_discovery', 'aiAPP', true);
  }
  if (s.focus === 'rescue') {
    if (!hasMaterialCase) return result('insufficient');
    if (!usable(s, 'data') || !usable(s, 'owner')) return result('prepare', null, true);
    return result('technical_assessment', 'vibeCODING', true);
  }
  if (val(s, 'repetition') === 'unique') return result('process_first');
  const supported = hasMaterialCase && ['repeatable', 'mixed'].includes(val(s, 'repetition'));
  if (!supported) return result('insufficient');
  if (val(s, 'constraints') === 'high_risk') return result('prepare', null, true);
  if (val(s, 'alternative') !== 'insufficient') return result('process_first', null, true);
  if (result('prepare').readiness !== 'ready') return result('prepare', null, true);
  const product = PRODUCT_FOR_FOCUS[s.focus];
  return product && PRODUCT_CATALOG[product].mode === 'pilot' ? result('pilot', product, true) : result('process_first', null, true);
}
