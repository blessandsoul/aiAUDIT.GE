import { BANK, BRANCH_FIELDS, DECLINED, FIELDS, FOCUSES, UNKNOWN, l, type Field, type Focus, type Language } from './audit-bank.ts';
import { PRODUCT_CATALOG, PRODUCT_FOR_FOCUS, type ProductKey } from './audit-product-catalog.ts';
import type { PublicScan } from './audit-public-sources.ts';
import { DEEP_FIELDS } from './audit-deep-bank.ts';
export type IntakeLanguage = Language;
export type FactStatus = 'confirmed' | 'estimated' | 'partial' | 'unknown' | 'declined' | 'not_applicable' | 'contradicted';
export type Fact = { id: string; field: Field; value: string; status: FactStatus; quote: string; turn: number; previous?: { value: string; quote: string } };
export type IntakeState = {
  mode?: 'quick' | 'deep';
  version: 2; turn: number; language: Language; focus: Focus; focusQuote: string;
  facts: Partial<Record<Field, Fact>>; asked: Partial<Record<Field, number>>;
  currentQuestion: Field | null; complete: boolean; stopReason: 'enough' | 'limited' | null;
  history: Array<{ role: 'user' | 'assistant'; content: string }>; proof?: string;
  publicScan?: PublicScan;
};
export type Update = { field: Field; value: string; status: FactStatus; evidence: string; correction: boolean };
export type Extraction = { focus: Focus; focusEvidence: string; updates: Update[]; nextField: Field | null };
export const MAX_AUDIT_TURNS = 24;
export const auditTurnLimit = (s: IntakeState) => s.mode === 'deep' ? 40 : MAX_AUDIT_TURNS;
export const known = (f?: Fact) => Boolean(f && ['confirmed', 'estimated'].includes(f.status));
const settled = (f?: Fact) => Boolean(f && !['partial', 'contradicted'].includes(f.status));
export const usable = (s: IntakeState, f: Field) => known(s.facts[f]);
export const val = (s: IntakeState, f: Field) => usable(s, f) ? s.facts[f]!.value : '';
const quantitativeFields: Field[] = ['scale', 'impact', 'baseline', 'conversion', 'volume_peaks', 'unit_time', 'error_cost', 'review_capacity'];
// A changed quantity is a clarification candidate, not automatically a factual
// contradiction: periods, units or channels may differ. Never silently replace it.
function changedQuantity(old: Fact, update: Update): boolean {
  const numbers = (value: string) => [...new Set(value.match(/\d+(?:[.,]\d+)?/gu) || [])].sort().join('|');
  const before = numbers(old.value), after = numbers(update.value);
  const units = (value: string) => [
    /daily|per day|\/day|в день|сутк|დღე/iu,
    /weekly|per week|\/week|недел|კვირ/iu,
    /monthly|per month|\/month|месяц|თვე/iu,
    /hours?|час|საათ/iu, /minutes?|минут|წუთ/iu, /%|percent|процент|პროცენტ/iu,
    /messages?|сообщен|შეტყობინ/iu, /leads?|лид|ლიდ/iu,
  ].map((pattern,i)=>pattern.test(value)?String(i):'').filter(Boolean).join('|');
  const oldUnits = units(old.value), newUnits = units(update.value);
  return quantitativeFields.includes(update.field) && Boolean(before)
    && (before !== after || (Boolean(oldUnits) && oldUnits !== newUnits));
}
export function createIntakeState(language: Language = 'ka', mode: 'quick' | 'deep' = 'quick'): IntakeState {
  return { version: 2, mode, turn: 0, language, focus: 'discovery', focusQuote: '', facts: {}, asked: {}, currentQuestion: null, complete: false, stopReason: null, history: [] };
}
// HTTP callers must verify the signature before accepting state.
export function parseIntakeState(value: unknown): IntakeState {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 2) return createIntakeState();
  return structuredClone(value as IntakeState);
}
export function languageOf(text: string, previous: Language = 'ka'): Language {
  if (/[\u10a0-\u10ff]/u.test(text)) return 'ka';
  if (/[\u0400-\u04ff]/u.test(text)) return 'ru';
  // Tool names, acronyms and all-caps labels (for example "GOOGLE SHEETS")
  // are common inside Georgian answers. They are not evidence that the person
  // wants to switch the conversation language.
  const latin = text.match(/[a-z]/giu) ?? [];
  const englishSentence = /\b(?:i|we|you|they|the|a|an|is|are|was|were|have|has|had|can|could|will|would|do|does|did|and|but|because|with|for|from|to|in|on|of|my|our|your|yes|no|not|don't|can't|it's|this|that)\b/iu.test(text);
  const labelOnly = /^[A-Z0-9][A-Z0-9\s._&/-]{1,39}$/u.test(text.trim());
  if (!labelOnly && latin.length >= 4 && (englishSentence || latin.length >= 24)) return 'en';
  return previous;
}
export function deepFieldsFor(s: IntakeState): Field[] {
  if (s.mode !== 'deep' || ['discovery', 'fleet'].includes(s.focus) || ['none','minor'].includes(val(s,'severity'))) return [];
  if ((s.focus === 'ads' && ['none','clicks'].includes(val(s,'tracking'))) || s.focus === 'attribution')
    return ['process_owner','source_of_truth','data_quality','permissions','pilot_scope','success_threshold','baseline_period','review_capacity'];
  if (s.focus === 'growth' || (s.focus === 'office' && val(s,'office_task') === 'approvals') || (s.focus === 'docs' && val(s,'docs_task') === 'decision') || val(s,'repetition') === 'unique')
    return ['process_owner','trigger','completion','exceptions','handoff','unit_time','pilot_scope','success_threshold','stop_rules','baseline_period'];
  return DEEP_FIELDS;
}
// Explicitly inapplicable optional facts close a gap but never authorize a test.
export const deepResolved = (s: IntakeState, f: Field) => usable(s,f) ||
  (['handoff','personal_data','volume_peaks','seasonality','dependencies','error_cost'].includes(f)
    && s.facts[f]?.status === 'not_applicable' && Boolean(s.facts[f]?.quote));
export function requiredFields(s: IntakeState): Field[] {
  const deep = deepFieldsFor(s);
  return [...new Set<Field>([...requiredBase(s).filter(f => f !== 'priority_check'), ...deep, 'priority_check', ...(val(s, 'priority_check') === 'another' ? ['area' as Field] : [])])];
}
function requiredBase(s: IntakeState): Field[] {
  if (s.focus === 'discovery' && val(s, 'severity') === 'none') return ['business', 'objective', 'severity', 'priority_check'];
  if (s.focus === 'discovery' && settled(s.facts.area) && !usable(s, 'area')) return ['business', 'objective', 'area', 'priority_check'];
  if (s.focus === 'ads' && ['none', 'clicks'].includes(val(s, 'tracking'))) return ['business', 'objective', 'acquisition', 'tracking', 'systems', 'owner', 'priority_check'];
  let branch = [...BRANCH_FIELDS[s.focus]];
  if (s.focus === 'growth') {
    if (val(s, 'bottleneck') === 'conversion') branch = ['bottleneck', 'lost_case', 'loss_stage', 'loss_reason', 'follow_up', 'acquisition', 'conversion'];
    if (['reach', 'enquiries'].includes(val(s, 'bottleneck'))) branch = ['bottleneck', 'acquisition', 'conversion'];
    if (val(s, 'bottleneck') === 'fulfilment') branch = ['bottleneck', 'process', 'repetition'];
  }
  if (s.focus === 'attribution' && ['none', 'ask'].includes(val(s, 'attribution'))) branch = ['attribution', 'reporting_gap', 'reporting_decision'];
  const core: Field[] = ['business', 'objective', 'pain', ...branch, 'process', 'scale', 'impact', 'severity'];
  if (s.focus === 'discovery') core.splice(2, 0, 'area');
  if (['none', 'minor'].includes(val(s, 'severity'))) return [...new Set<Field>([...core, 'priority_check'])];
  if (s.focus === 'growth') return [...new Set<Field>([...core, 'customer', 'systems', 'priority_check'])];
  if (s.focus === 'attribution') return [...new Set<Field>([...core, 'systems', 'baseline', 'priority_check'])];
  // A Quick Chats audit can decide whether a safe preparation step is warranted
  // without forcing a guessed baseline. The report still calls the missing
  // baseline out explicitly, and assess() will not authorize a pilot without it.
  if (s.mode !== 'deep' && s.focus === 'chats') return [...new Set<Field>([...core, 'systems', 'data', 'alternative', 'owner', 'constraints', 'priority_check'])];
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
  const renovation = /სარემონტო|რემონტ|ремонт|renovat/iu.test(val(s, 'business'));
  if (field === 'loss_stage' && renovation) content = l('ბოლო მომხმარებელი რომელ ეტაპზე შეჩერდა — პირველი ფასის, ადგილზე დათვალიერების თუ დეტალური ხარჯთაღრიცხვის შემდეგ?', 'Последний клиент остановился после первой цены, осмотра объекта или подробной сметы?', 'Did the last customer stop after the initial price, the site visit, or the detailed estimate?')[s.language];
  // A tracking code is a normal part of many order flows. Only treat it as a
  // risk when the same client statement also reports an actual error.
  const trackingIncident = (text: string) => /თრექინგ|ტრექინგ|tracking\s*(?:code|number)|код\s*отслеж/iu.test(text)
    && /არასწორ|შეცდომ|wrong|incorrect|mistake|error|невер|ошиб/iu.test(text);
  const trackingIncidentMentioned = Object.values(s.facts).some((item) => trackingIncident(item?.quote ?? ''));
  if (field === 'process' && s.focus === 'chats' && (s.asked.process ?? 0) > 1) {
    content = trackingIncidentMentioned
      ? l(
        'თქვენ ახსენეთ არასწორად გაგზავნილი თრექინგ-კოდი. ეს შეცდომა სოციალურ ქსელში პასუხისას მოხდა, თუ შეკვეთის ან მიწოდების სხვა ეტაპზე?',
        'Вы упомянули неверно отправленный код отслеживания. Ошибка произошла при ответе в социальной сети или на другом этапе заказа либо доставки?',
        'You mentioned a tracking code sent incorrectly. Did this happen while replying on social media, or at another order or delivery step?'
      )[s.language]
      : l(
        'შეტყობინების მიღებიდან პასუხის გაგზავნამდე რომელი ნაბიჯებია ყველაზე მნიშვნელოვანი — პროდუქტის ან შეკვეთის მოძიება, ინფორმაციის გადამოწმება თუ პასუხის მომზადება?',
        'Какие шаги важнее всего от получения сообщения до ответа: найти товар или заказ, проверить сведения или подготовить ответ?',
        'Which steps matter most from receiving a message to replying: finding the product or order, checking the details, or preparing the reply?'
      )[s.language];
  }
  if (fact?.previous && fact.status === 'partial') {
    content = l(`ადრე თქვით: „${fact.previous.quote}“, ახლა კი: „${fact.quote}“. ეს შესწორებაა თუ სხვადასხვა პერიოდს ან პროცესს გულისხმობთ?`, `Ранее: «${fact.previous.quote}». Сейчас: «${fact.quote}». Это исправление или речь о разных периодах либо процессах?`, `Earlier: “${fact.previous.quote}”. Now: “${fact.quote}”. Is this a correction, or do these describe different periods or processes?`)[s.language];
  } else if (fact?.status === 'contradicted' && fact.previous) {
    content = l(`ადრე თქვით: „${fact.previous.quote}“, ახლა კი: „${fact.quote}“. რომელი აღწერს ამჟამინდელ მდგომარეობას?`, `Ранее: «${fact.previous.quote}». Сейчас: «${fact.quote}». Что описывает текущее положение?`, `Earlier: “${fact.previous.quote}”. Now: “${fact.quote}”. Which describes the current situation?`)[s.language];
  } else if ((s.asked[field] ?? 0) > 1) {
    content += ' ' + l('შეგიძლიათ დაწეროთ შეფასება ან აირჩიოთ „არ ვიცი“.', 'Можно дать оценку или выбрать «Не знаю».', 'An estimate is fine, or choose “I don’t know”.')[s.language];
  }
  const anchorField: Partial<Record<Field, Field>> = { impact: 'pain', data: 'systems', alternative: 'pain', constraints: 'process', lost_case: 'bottleneck', loss_stage: 'lost_case', follow_up: 'loss_reason' };
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
  if (/დოკუმენტ|документ|\bdocuments?\b|invoice|ინვოის|накладн/u.test(text)) return 'docs';
  if (/საიტ|website|web.?site|лендинг/u.test(text)) return 'web';
  if (/შეკვეთ.{0,80}(?:excel|таблиц|სისტემ)|approval|დამტკიც|ручн.{0,15}(?:перенос|ввод)|ხელით.{0,50}(?:გადატან|შეყვან)/u.test(text)) return 'office';
  if (/(?<!\p{L})(?:ზარ(?:ი|ები|ებით|ების|ებს|ზე)|ვურეკავთ|ურეკავს|телефон\p{L}*|звон\p{L}*|calls?)(?!\p{L})/u.test(text)) return 'calls';
  if (/ავტომოპასუხ|автоответчик|auto.?respon(?:der|se)|auto.?reply|automatic repl|social.{0,20}(?:network|media)|სოც(?:იალურ)?\s*ქსელ|(?:instagram|whatsapp|messenger)|ვწერთ|შეტყობინ|сообщен|соцсет|chat/u.test(text)) return 'chats';
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
    if (s.mode !== 'deep' && (DEEP_FIELDS as Field[]).includes(u.field)) continue;
    if (!FIELDS.includes(u.field) || !u.evidence.trim() || !message.includes(u.evidence) || u.evidence.length > 600 || u.value.length > 400) continue;
    if (['confirmed', 'estimated'].includes(u.status) && uncertaintyAnswer(u.evidence)) continue;
    const options = BANK[u.field].options;
    if (['confirmed', 'estimated'].includes(u.status) && options.length && !options.some((o) => o.value === u.value)) continue;
    if (['unknown', 'declined', 'not_applicable'].includes(u.status) && u.field !== previous.currentQuestion) continue;
    const old = s.facts[u.field];
    const pending = old && (old.status === 'contradicted' || (old.status === 'partial' && old.previous));
    const resolving = pending && previous.currentQuestion === u.field;
    const correction = resolving || (u.correction && /შესწორ|შეცდომ|არა[, ]|სინამდვილ|исправ|ошиб|не .+ а |на самом|correction|actually|meant|instead/iu.test(message));
    if (u.field === 'business' && old && known(old) && !correction && /^(?:სერვის(?:ი|ს)?|მომსახურება|услуг[аиу]?|сервис|services?|shop|магазин)[.!\s]*$/iu.test(u.value.trim())) continue;
    const conflict = old && known(old) && options.length > 0 && ['confirmed', 'estimated'].includes(u.status) && old.value !== u.value && !correction;
    const quantityReview = old && known(old) && ['confirmed', 'estimated'].includes(u.status) && changedQuantity(old, u) && !correction;
    if (pending && !correction && ['confirmed', 'estimated'].includes(u.status)) continue;
    if (old && known(old) && !['confirmed', 'estimated', 'contradicted'].includes(u.status) && !correction) continue;
    if (quantityReview || conflict) s.asked[u.field] = 0;
    s.facts[u.field] = { id: `${u.field}:${s.turn}`, field: u.field, value: ['confirmed', 'estimated', 'contradicted'].includes(u.status) ? u.value : '', status: conflict ? 'contradicted' : quantityReview ? 'partial' : u.status, quote: u.evidence, turn: s.turn,
      ...((quantityReview || conflict || u.status === 'contradicted') && old ? { previous: { value: old.value, quote: old.quote } } : {}),
    };
  }
  const selectedArea = s.facts.area;
  if (selectedArea && known(selectedArea) && FOCUSES.includes(selectedArea.value as Focus) && (s.focus === 'discovery' || previous.currentQuestion === 'area')) {
    s.focus = selectedArea.value as Focus; s.focusQuote = selectedArea.quote;
  }
  if (!control && extraction.focus !== 'discovery' && FOCUSES.includes(extraction.focus) && extraction.focusEvidence.length > 2 && message.includes(extraction.focusEvidence)
    && (s.focus === 'discovery' || (!known(previous.facts.pain) && !known(previous.facts.bottleneck)) || val(s, 'priority_check') === 'another'
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
  const explicitChatIntent = hintedFocus === 'chats' && /ავტომოპასუხ|автоответчик|auto.?respon(?:der|se)|auto.?reply|automatic repl/iu.test(message)
    && /(?:სოც(?:იალურ)?\s*ქსელ|social.{0,20}(?:network|media)|соцсет|instagram|facebook|whatsapp|messenger)/iu.test(message);
  const canApplyHint = s.turn === 1 && (explicitChatIntent
    || (s.focus === 'operations' && hintedFocus === 'office')
    || (s.focus === 'discovery' && hintedFocus === 'fleet'));
  if (!control && hintedFocus && canApplyHint) {
    s.focus = hintedFocus; s.focusQuote = message.slice(0, 600);
  }
  // Broad area labels are not a diagnosis. Resolve an unambiguous supported
  // process at intake; never use a marketing/product mention as evidence.
  if (!control && (previous.focus === 'discovery' || ['discovery', 'operations'].includes(s.focus)
    || (s.focus === 'growth' && !usable(s, 'bottleneck'))) && ((usable(s, 'process') && s.facts.process!.turn === s.turn)
      || (usable(s, 'pain') && s.facts.pain!.turn === s.turn))) {
    const processQuote = usable(s, 'process') ? s.facts.process!.quote : s.facts.pain!.quote;
    const candidates: Focus[] = [];
    const supportedTask = (field: Field) => usable(s, field) && s.facts[field]!.turn === s.turn
      && [processQuote, usable(s, 'pain') ? s.facts.pain!.quote : ''].filter(Boolean)
        .some(quote => quote.includes(s.facts[field]!.quote) || s.facts[field]!.quote.includes(quote));
    for (const [field, focus] of [['call_task','calls'],['docs_task','docs'],['content_gap','content'],['office_task','office'],['web_task','web'],['app_task','app'],['rescue_task','rescue'],['staff_task','staff']] as [Field, Focus][]) {
      if (supportedTask(field)) candidates.push(focus);
    }
    const processHint = focusHint(processQuote);
    if (val(s, 'docs_task') === 'draft' && /(?:draft|writ)\w*.{0,50}(?:product descriptions|descriptions|social captions|marketing copy)/iu.test(processQuote)
      && /catalog|publication|publish|product/i.test(processQuote)) {
      const docsIndex = candidates.indexOf('docs');
      if (docsIndex !== -1) candidates.splice(docsIndex, 1, 'content');
    }
    if (processHint && !candidates.length) candidates.push(processHint);
    if (new Set(candidates).size === 1) {
      s.focus = candidates[0]; s.focusQuote = processQuote;
    }
  }
  // A switch of investigated process invalidates old process-specific evidence.
  // If only a broad area is known, one explicit task can identify which branch
  // to investigate even before the workflow is fully described. This does not
  // establish volume, impact, readiness or a product recommendation.
  if (!control && ['discovery', 'operations'].includes(s.focus)) {
    const tasks = ([['call_task','calls'],['docs_task','docs'],['content_gap','content'],['office_task','office'],['web_task','web'],['app_task','app'],['rescue_task','rescue'],['staff_task','staff']] as [Field, Focus][])
      .filter(([field]) => usable(s, field));
    if (tasks.length === 1) { s.focus = tasks[0][1]; s.focusQuote = s.facts[tasks[0][0]]!.quote; }
  }
  // Current-message evidence can establish the new process; business context stays.
  const revisitingProcess = previous.currentQuestion === 'area' && val(previous, 'priority_check') === 'another' && known(s.facts.area);
  if ((previous.focus !== 'discovery' && s.focus !== previous.focus) || revisitingProcess) {
    const context: Field[] = ['business', 'customer', 'objective', 'channels', 'area'];
    for (const field of FIELDS) if (!context.includes(field)) {
      if (s.facts[field]?.turn !== s.turn || s.facts[field]?.status === 'contradicted') delete s.facts[field];
      delete s.asked[field];
    }
  }
  // An unrelated answer must not consume a question attempt or advance the interview.
  if (!finish && s.turn < auditTurnLimit(s) && previous.currentQuestion && s.focus === previous.focus && !updates.length && !control) {
    const repeated = previous.history.filter((item) => item.role === 'user').at(-1)?.content.trim() === message.trim();
    if (!repeated) { s.currentQuestion = previous.currentQuestion; return s; }
    // A repeated unanswered statement is a gap, not evidence. Avoid trapping the
    // respondent while preserving the first off-topic answer's no-progress rule.
    s.asked[previous.currentQuestion] = Math.max(2, s.asked[previous.currentQuestion] || 0);
  }
  if (previous.currentQuestion === 'priority_check' && direct?.value === 'another') {
    delete s.facts.area; s.asked.area = 0;
  }
  const required = requiredFields(s);
  const exhausted = finish || s.turn >= auditTurnLimit(s);
  const considered = (f: Field) => settled(s.facts[f]) || (s.asked[f] ?? 0) >= 2;
  const ready = required.every(considered) && (val(s, 'priority_check') !== 'another' || considered('area'));
  if (ready || exhausted) {
    s.complete = true; s.stopReason = exhausted || required.some((f) => !(s.mode === 'deep' ? deepResolved(s,f) : usable(s, f))) ? 'limited' : 'enough'; s.currentQuestion = null;
    return s;
  }
  const missing = required.filter((f) => !considered(f));
  const conflict = missing.find((f) => s.facts[f]?.status === 'contradicted' || s.facts[f]?.previous);
  const diagnosticOrder: Field[] = s.focus === 'growth' && val(s, 'bottleneck') === 'conversion'
    ? ['lost_case', 'loss_stage', 'loss_reason', 'follow_up', 'acquisition', 'conversion'] : BRANCH_FIELDS[s.focus];
  const essential = diagnosticOrder.find((f) => missing.includes(f));
  const basics = missing.find((f) => ['business', 'objective'].includes(f));
  let target: Field = basics ?? conflict ?? essential ?? missing[0] ?? 'area';
  if (!basics && !conflict && !essential && extraction.nextField && missing.slice(0, 3).includes(extraction.nextField)) target = extraction.nextField;
  if (val(s, 'priority_check') === 'another' && !considered('area')) target = 'area';
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
  return { covered: fields.filter((f) => s.mode === 'deep' ? deepResolved(s,f) : usable(s, f)).length, gaps: fields.filter((f) => !(s.mode === 'deep' ? deepResolved(s,f) : usable(s, f))).length, complete: s.complete,
    phase: s.complete ? 'report' : s.focus === 'discovery' ? 'context' : fields.filter((f) => usable(s, f)).length < 6 ? 'diagnosis' : 'feasibility' };
}
export type Verdict = 'measurement_first' | 'process_first' | 'pilot' | 'prepare' | 'not_now' | 'insufficient' | 'scoped_discovery' | 'technical_assessment' | 'human_service' | 'not_available';
export function assess(s: IntakeState) {
  const evidence = requiredFields(s).filter((f) => usable(s, f));
  const depthMissing = deepFieldsFor(s).some(f => !deepResolved(s, f));
  const depthBlocked = s.mode === 'deep' && (val(s,'permissions') !== 'approved' || val(s,'review_capacity') !== 'available');
  const result = (verdict: Verdict, product: ProductKey | null = null, supported = false) => ({
    verdict: product && (depthMissing || depthBlocked) ? 'prepare' as Verdict : verdict,
    product: depthMissing || depthBlocked ? null : product, opportunity: supported ? 'supported' : 'limited',
    readiness: !depthMissing && !depthBlocked && !['measurement_first', 'prepare'].includes(verdict) && val(s, 'data') === 'ready' && val(s, 'owner') === 'available' && ['review', 'low_risk'].includes(val(s, 'constraints')) ? 'ready' : 'limited', evidence });
  if (s.focus === 'fleet') return result('not_available');
  if (usable(s, 'business') && ['minor', 'none'].includes(val(s, 'severity'))) return result('not_now');
  if (usable(s, 'business') && s.focus === 'ads' && ['clicks', 'none'].includes(val(s, 'tracking'))) return result('measurement_first');
  if (usable(s, 'business') && ((s.focus === 'docs' && val(s, 'docs_task') === 'decision')
    || (s.focus === 'calls' && val(s, 'call_task') === 'expert'))) return result('process_first');
  if (!usable(s, 'business') || !usable(s, 'pain')) return result('insufficient');
  if (['minor', 'none'].includes(val(s, 'severity')) || val(s, 'alternative') === 'solved') return result('not_now');
  if (s.focus === 'attribution' && (['none', 'ask'].includes(val(s, 'attribution')) || ['missing', 'criteria'].includes(val(s, 'reporting_gap')) || ['no', 'partial'].includes(val(s, 'attribution_check')))) return result('measurement_first');
  if (s.focus === 'ads' && (['clicks', 'none'].includes(val(s, 'tracking')) || val(s, 'acquisition') === 'organic')) return result('measurement_first');
  if (s.focus === 'calls' && ['cold', 'unclear'].includes(val(s, 'call_permission'))) return result('process_first');
  if (s.focus === 'growth') return result(usable(s, 'bottleneck') ? 'process_first' : 'insufficient');
  if (s.focus === 'attribution') return result(usable(s, 'reporting_gap') ? 'process_first' : 'insufficient');
  // A known approval bottleneck or an untried conventional transfer can be
  // investigated without pretending unknown volume supports an AI purchase.
  if (s.focus === 'office' && (val(s, 'office_task') === 'approvals'
    || (['orders', 'transfer'].includes(val(s, 'office_task')) && val(s, 'alternative') === 'not_tried' && usable(s, 'process')))) return result('process_first');
  if ((s.focus === 'calls' && val(s, 'call_task') === 'expert') || (s.focus === 'docs' && val(s, 'docs_task') === 'decision')
    || (['chats', 'calls'].includes(s.focus) && val(s, 'response') === 'fine')
    || (s.focus === 'content' && ['approval', 'none'].includes(val(s, 'content_gap')))) return result('process_first');
  if (requiredFields(s).some((f) => s.facts[f]?.previous && !usable(s, f))) return result('insufficient');
  const chatIntent = [s.focusQuote, s.facts.objective?.quote, s.facts.pain?.quote].filter(Boolean).join(' ');
  const explicitlyWantsSocialAutoReply = /ავტომოპასუხ|ავტომატურ.{0,25}პასუხ|auto.?respon(?:der|se)|auto.?reply|automatic repl|автоответчик|автоматическ.{0,25}ответ/iu.test(chatIntent)
    && /სოც(?:იალურ)?\s*ქსელ|social.{0,20}(?:network|media)|соцсет|instagram|facebook|whatsapp|messenger/iu.test(chatIntent);
  const safeChatsPreparation = s.mode !== 'deep' && s.focus === 'chats' && explicitlyWantsSocialAutoReply
    && ['delays', 'missed'].includes(val(s, 'response')) && ['repeatable', 'mixed'].includes(val(s, 'repetition'))
    && val(s, 'severity') === 'material' && usable(s, 'scale') && val(s, 'data') === 'ready'
    && val(s, 'owner') === 'available' && val(s, 'constraints') === 'review' && val(s, 'alternative') === 'insufficient'
    && (!usable(s, 'process') || !usable(s, 'impact') || !usable(s, 'baseline'));
  if (safeChatsPreparation) return { ...result('prepare', 'aiCHATS', true), readiness: 'limited' as const };
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
  const pilotReadiness = val(s, 'data') === 'ready' && val(s, 'owner') === 'available' && ['review', 'low_risk'].includes(val(s, 'constraints'));
  if (!pilotReadiness) return result('prepare', null, true);
  const product = PRODUCT_FOR_FOCUS[s.focus];
  if (s.focus === 'chats' && !usable(s, 'baseline')) return result('prepare', product ?? null, true);
  if (depthMissing || depthBlocked) return result('prepare', null, true);
  return product && PRODUCT_CATALOG[product].mode === 'pilot' ? result('pilot', product, true) : result('process_first', null, true);
}
