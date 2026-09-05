import { l, type Localized, type Focus } from './audit-bank.ts';

/**
 * This is the only place that maps an audit domain to an iAI offer. The
 * interview never recommends a product merely because it appears in this list.
 */
export type ProductKey = 'aiCHATS' | 'aiCALL' | 'aiADS' | 'aiCONTENT' | 'aiDOCS' | 'aiWEB' | 'aiOFFICE' | 'aiAPP' | 'vibeCODING' | 'aiSTAFF' | 'aiTAXI';
export type ProductMode = 'pilot' | 'scoped_discovery' | 'human_service' | 'technical_assessment' | 'unavailable';
export type ProductDefinition = {
  key: ProductKey;
  focus: Focus;
  mode: ProductMode;
  name: Localized;
  purpose: Localized;
  exclusion: Localized;
};

export const PRODUCT_CATALOG: Record<ProductKey, ProductDefinition> = {
  aiCHATS: { key: 'aiCHATS', focus: 'chats', mode: 'pilot', name: l('aiCHATS', 'aiCHATS', 'aiCHATS'), purpose: l('განმეორებადი ტექსტური კომუნიკაცია და ადამიანისათვის გადაცემა', 'Повторяющиеся текстовые обращения с передачей человеку', 'Repeated text enquiries with human handoff'), exclusion: l('თუ პასუხები რთული და უნიკალურია', 'Если ответы в основном сложные и уникальные', 'When replies are mostly complex and unique') },
  aiCALL: { key: 'aiCALL', focus: 'calls', mode: 'pilot', name: l('aiCALL', 'aiCALL', 'aiCALL'), purpose: l('დადასტურება, ჩაწერა ან პირველადი ზარი საკუთარი კლიენტებისთვის', 'Подтверждение, запись или первичный звонок своим клиентам', 'Confirmation, booking or first-call handling for the company’s own customers'), exclusion: l('ექსპერტული კონსულტაცია ან ცივი სია', 'Экспертная консультация или холодная база', 'Expert consultations or a cold list') },
  aiADS: { key: 'aiADS', focus: 'ads', mode: 'pilot', name: l('aiADS', 'aiADS', 'aiADS'), purpose: l('გაზომილი ფასიანი კამპანიების განმეორებადი ანალიზი და ოპტიმიზაცია', 'Повторяющийся анализ и оптимизация измеряемых платных кампаний', 'Repeated analysis and optimization of measured paid campaigns'), exclusion: l('თუ შეძენები ან კონვერსიები არ იზომება', 'Если покупки или конверсии не измеряются', 'When purchases or conversions are not measured') },
  aiCONTENT: { key: 'aiCONTENT', focus: 'content', mode: 'pilot', name: l('aiCONTENT', 'aiCONTENT', 'aiCONTENT'), purpose: l('განმეორებადი კონტენტის წარმოება ადამიანის დამტკიცებით', 'Повторяющееся производство контента с утверждением человеком', 'Repeatable content production with human approval'), exclusion: l('თუ პრობლემა მხოლოდ ნახვებია და არა წარმოება', 'Если проблема только в просмотрах, а не в производстве', 'When the issue is views rather than production') },
  aiDOCS: { key: 'aiDOCS', focus: 'docs', mode: 'pilot', name: l('aiDOCS', 'aiDOCS', 'aiDOCS'), purpose: l('ერთი განმეორებადი დოკუმენტის დამუშავება და ადამიანის შემოწმება', 'Обработка одного повторяющегося типа документов с проверкой человеком', 'One repeatable document workflow with human review'), exclusion: l('თუ საჭიროა პროფესიული ან იურიდიული გადაწყვეტილება', 'Если требуется профессиональное или юридическое решение', 'When a professional or legal decision is required') },
  aiWEB: { key: 'aiWEB', focus: 'web', mode: 'pilot', name: l('aiWEB', 'aiWEB', 'aiWEB'), purpose: l('საიტზე მომხმარებლის დამოუკიდებელი მოქმედება ან ინფორმაციის განახლება', 'Самостоятельное действие клиента на сайте или поддержка актуальной информации', 'Customer self-service on a site or keeping site information current'), exclusion: l('თუ საიტი არ არის დადასტურებული bottleneck', 'Если сайт не подтверждён как bottleneck', 'When the site is not a confirmed bottleneck') },
  aiOFFICE: { key: 'aiOFFICE', focus: 'office', mode: 'pilot', name: l('aiOFFICE', 'aiOFFICE', 'aiOFFICE'), purpose: l('შიდა შეკვეთების, დამტკიცებების, ანგარიშების ან მონაცემთა გადატანის პროცესი', 'Внутренний процесс заказов, согласований, отчётов или переноса данных', 'An internal orders, approvals, reporting or data-transfer process'), exclusion: l('თუ მხოლოდ ერთი დოკუმენტის ამოღებაა საჭირო', 'Если нужен только один тип обработки документов', 'When the need is only one document workflow') },
  aiAPP: { key: 'aiAPP', focus: 'app', mode: 'scoped_discovery', name: l('aiAPP', 'aiAPP', 'aiAPP'), purpose: l('ახალი სპეციფიკური AI პროდუქტის, ინტეგრაციის ან აპლიკაციის scoping', 'Проработка новой специализированной AI-системы, интеграции или приложения', 'Scoping a new bespoke AI system, integration or application'), exclusion: l('თუ ეს უკვე არსებული აპლიკაციის შეკეთებაა', 'Если это ремонт уже существующего приложения', 'When the need is repair of an existing application') },
  vibeCODING: { key: 'vibeCODING', focus: 'rescue', mode: 'technical_assessment', name: l('vibeCODING', 'vibeCODING', 'vibeCODING'), purpose: l('უკვე შექმნილი AI-აპლიკაციის ტექნიკური assessment და შეკეთების scope', 'Техническая оценка и scope ремонта уже созданного AI-приложения', 'Technical assessment and repair scoping for an existing AI-built application'), exclusion: l('თუ საჭიროა ახალი პროდუქტის აშენება', 'Если нужно построить новый продукт', 'When a new product needs to be built') },
  aiSTAFF: { key: 'aiSTAFF', focus: 'staff', mode: 'human_service', name: l('aiSTAFF', 'aiSTAFF', 'aiSTAFF'), purpose: l('ცოცხალი სპეციალისტის ჩართვა იქ, სადაც ავტომატიზაცია არ უნდა ჩაანაცვლოს ადამიანს', 'Подключение живого специалиста там, где автоматизация не должна заменять человека', 'A live specialist where automation should not replace a person'), exclusion: l('თუ განმეორებადი ამოცანა უსაფრთხოდ ავტომატიზდება', 'Если повторяющуюся задачу можно безопасно автоматизировать', 'When repeated work can be safely automated') },
  aiTAXI: { key: 'aiTAXI', focus: 'fleet', mode: 'unavailable', name: l('aiTAXI', 'aiTAXI', 'aiTAXI'), purpose: l('ავტონომიური ფლოტის მომავალი მიმართულება', 'Будущее направление автономного флота', 'A future autonomous-fleet direction'), exclusion: l('ამ Quick Audit-ით ამჟამად არ იყიდება და არ ინერგება', 'Сейчас не продаётся и не внедряется через Quick Audit', 'Not currently sold or implemented through this Quick Audit') },
};

export const PRODUCT_FOR_FOCUS: Partial<Record<Focus, ProductKey>> = Object.fromEntries(
  Object.values(PRODUCT_CATALOG).map((product) => [product.focus, product.key]),
) as Partial<Record<Focus, ProductKey>>;

