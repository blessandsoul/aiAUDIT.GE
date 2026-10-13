export type AiAuditCategoryProductId =
  | "aichats" | "aicall" | "aicontent" | "aiads" | "aimusic" | "aistaff"
  | "aibrain" | "aioffice" | "aidocs" | "aiweb" | "aiapp" | "vibecoding";

export type AiAuditCategoryLocale = "ka" | "en" | "ru";
export type AiAuditCategoryProductCopy = {
  readonly name: string;
  readonly description: string;
  readonly href: "#hero" | "#comparison" | "#categories" | "#model-architecture" | "#how-we-work" | "#architecture" | "#faq" | "#cta";
};

type Matrix = Record<AiAuditCategoryProductId, AiAuditCategoryProductCopy>;

export const AIAUDIT_CATEGORY_PRODUCT_COPY: Record<AiAuditCategoryLocale, Matrix> = {
  ka: {
    aichats: { name: "პროცესის რუკა", description: "დაასახელეთ მიმდინარე პროცესი, მოცულობა და შეფერხება.", href: "#comparison" },
    aicall: { name: "შეფერხების მიზეზი", description: "გამოყავით მიზეზი და შედეგზე პასუხისმგებელი პირი.", href: "#comparison" },
    aicontent: { name: "AI-ის შესაბამისობა", description: "შეადარეთ ღირებულება, რისკი და ხელმისაწვდომი მტკიცებულება.", href: "#model-architecture" },
    aiads: { name: "მტკიცებულების შემოწმება", description: "დატოვეთ ფაქტები და ვარაუდები ერთმანეთისგან გამოყოფილი.", href: "#model-architecture" },
    aimusic: { name: "პილოტის ფარგლები", description: "განსაზღვრეთ შეზღუდული პირველი ნაბიჯი და მისი საზომი.", href: "#how-we-work" },
    aistaff: { name: "გადაწყვეტილების პასუხისმგებელი", description: "დაასახელეთ, ვინ ამოწმებს შედეგსა და შემდეგ ნაბიჯს.", href: "#architecture" },
    aibrain: { name: "ადამიანის კონტროლის ზღვარი", description: "დააფიქსირეთ, სად არის ადამიანის შემოწმება აუცილებელი.", href: "#architecture" },
    aioffice: { name: "შემოწმების წერტილი", description: "ჩაწერეთ, როდის წყდება ან გრძელდება სამუშაო.", href: "#faq" },
    aidocs: { name: "მტკიცებულების ხარვეზი", description: "აჩვენეთ, რომელი ფაქტი ან დოკუმენტი ჯერ არ გვაქვს.", href: "#faq" },
    aiweb: { name: "გაზომვის ნაბიჯი", description: "შეთანხმდით პირველ შედეგსა და საწყის საზომზე.", href: "#how-we-work" },
    aiapp: { name: "გადაწყვეტილების წესი", description: "დაწერეთ, როდის გრძელდება პილოტი და როდის ჩერდება.", href: "#cta" },
    vibecoding: { name: "ამ ეტაპზე AI არ გჭირდებათ", description: "უარი თქვით AI-ზე, როცა ფაქტები ან ეკონომიკა ამას მოითხოვს.", href: "#cta" },
  },
  en: {
    aichats: { name: "Workflow map", description: "Name the current process, volume and bottleneck.", href: "#comparison" },
    aicall: { name: "Bottleneck cause", description: "Separate the cause and the person who owns the outcome.", href: "#comparison" },
    aicontent: { name: "AI fit", description: "Compare value, risk and available evidence.", href: "#model-architecture" },
    aiads: { name: "Evidence check", description: "Keep facts and assumptions visibly separate.", href: "#model-architecture" },
    aimusic: { name: "Pilot scope", description: "Define a bounded first step and its measure.", href: "#how-we-work" },
    aistaff: { name: "Decision owner", description: "Name who validates the result and next step.", href: "#architecture" },
    aibrain: { name: "Human boundary", description: "Record where human verification is required.", href: "#architecture" },
    aioffice: { name: "Review point", description: "Write when the work stops or continues.", href: "#faq" },
    aidocs: { name: "Evidence gap", description: "Show which fact or document is still missing.", href: "#faq" },
    aiweb: { name: "Measurement step", description: "Agree the first outcome and baseline measure.", href: "#how-we-work" },
    aiapp: { name: "Decision rule", description: "Write when the pilot continues or stops.", href: "#cta" },
    vibecoding: { name: "AI is not needed yet", description: "Reject AI when evidence or economics do not support it.", href: "#cta" },
  },
  ru: {
    aichats: { name: "Карта процесса", description: "Назовите текущий процесс, объём и узкое место.", href: "#comparison" },
    aicall: { name: "Причина задержки", description: "Отделите причину и ответственного за результат.", href: "#comparison" },
    aicontent: { name: "Применимость AI", description: "Сравните ценность, риск и доступные свидетельства.", href: "#model-architecture" },
    aiads: { name: "Проверка фактов", description: "Разделяйте факты и гипотезы в описании работы.", href: "#model-architecture" },
    aimusic: { name: "Объём пилота", description: "Определите ограниченный первый шаг и его измерение.", href: "#how-we-work" },
    aistaff: { name: "Ответственный за решение", description: "Назовите того, кто проверяет результат и следующий шаг.", href: "#architecture" },
    aibrain: { name: "Граница человека", description: "Зафиксируйте, где нужна проверка человеком.", href: "#architecture" },
    aioffice: { name: "Точка проверки", description: "Запишите, когда работа останавливается или продолжается.", href: "#faq" },
    aidocs: { name: "Пробел в фактах", description: "Покажите, какого факта или документа пока не хватает.", href: "#faq" },
    aiweb: { name: "Шаг измерения", description: "Согласуйте первый результат и базовый показатель.", href: "#how-we-work" },
    aiapp: { name: "Правило решения", description: "Запишите, когда пилот продолжается или останавливается.", href: "#cta" },
    vibecoding: { name: "AI пока не нужен", description: "Откажитесь от AI, если факты или экономика его не поддерживают.", href: "#cta" },
  },
};

export function getAiAuditCategoryProductCopy(locale: string): Matrix {
  return AIAUDIT_CATEGORY_PRODUCT_COPY[locale === "ka" || locale === "ru" ? locale : "en"];
}
