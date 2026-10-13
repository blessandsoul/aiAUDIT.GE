export const AIAUDIT_MODEL_PROOF_PROVIDER_KEYS = [
  "Workflow",
  "Bottleneck",
  "Evidence",
  "Owner",
  "Boundary",
  "Fit",
  "Pilot",
  "Measure",
  "Review",
  "Decision",
  "Not now",
] as const;

export type AiAuditModelProofProviderKey = (typeof AIAUDIT_MODEL_PROOF_PROVIDER_KEYS)[number];
export type AiAuditModelProofSourceTone = "openai" | "anthropic" | "google" | "xai" | "mistral" | "deepseek" | "meta" | "qwen" | "cohere" | "zai" | "kimi";

// These are the frozen source slot roles from aiNOW's ModelProof CSS. They stay
// independent from the translated workflow labels shown to visitors.
export const AIAUDIT_MODEL_PROOF_SOURCE_TONES: Record<AiAuditModelProofProviderKey, AiAuditModelProofSourceTone> = {
  Workflow: "openai",
  Bottleneck: "anthropic",
  Evidence: "google",
  Owner: "xai",
  Boundary: "mistral",
  Fit: "deepseek",
  Pilot: "meta",
  Measure: "qwen",
  Review: "cohere",
  Decision: "zai",
  "Not now": "kimi",
};

type TrustCard = {
  value: string;
  label: string;
  detail: string;
  image: string;
};

export type AiAuditModelProofCopy = {
  eyebrow: string;
  title: string;
  description: string;
  radar: string;
  moreTechnologies: string;
  jevKicker: string;
  jevTitle: string;
  jevDescription: string;
  trustLabel: string;
  providerLabels: Record<AiAuditModelProofProviderKey, string>;
  initialModels: Record<"Workflow" | "Bottleneck" | "Evidence" | "Owner", string>;
  brand: {
    established: string;
    title: string;
    location: string;
    language: string;
  };
  trust: readonly TrustCard[];
};

export function aiAuditModelProofTrustItemClassName(index: number): string {
  return `ainow-model-stage__trust-item${index === 3 ? " ainow-model-stage__trust-item--always-on" : ""}`;
}

const images = {
  evidence: "/graphics-3d/products/aiaudit-evidence-v1.png",
  boundary: "/graphics-3d/products/aiaudit-handover-v1.png",
  review: "/graphics-3d/products/aiaudit-recommendation-v1.png",
} as const;

export const AIAUDIT_MODEL_PROOF_COPY: Record<"ka" | "en" | "ru", AiAuditModelProofCopy> = {
  ka: {
    eyebrow: "რას ამოწმებს დიაგნოსტიკა",
    title: "ჯერ ფაქტები, შემდეგ არჩევანი.",
    description: "ვადარებთ პროცესს, შეფერხებას, ადამიანის კონტროლსა და ხელმისაწვდომ მონაცემს. კონკრეტული მოდელი ამ გვერდზე დაპირებული არ არის.",
    radar: "დიაგნოსტიკის სამუშაო წერტილები",
    moreTechnologies: "დამატებითი წერტილები",
    jevKicker: "დასკვნის საზღვარი",
    jevTitle: "AI-ის შესაბამისობის გადაწყვეტილება",
    jevDescription: "შედეგი შეიძლება იყოს პილოტი, გაზომვის ნაბიჯი ან დასკვნა, რომ ამ ეტაპზე AI არ გჭირდებათ.",
    trustLabel: "ფაქტები, წვდომა და ადამიანის კონტროლი",
    providerLabels: {
      Workflow: "პროცესი",
      Bottleneck: "შეფერხება",
      Evidence: "მტკიცებულება",
      Owner: "პასუხისმგებელი პირი",
      Boundary: "საზღვარი",
      Fit: "შესაბამისობა",
      Pilot: "პილოტი",
      Measure: "გაზომვა",
      Review: "შემოწმება",
      Decision: "გადაწყვეტილება",
      "Not now": "ამ ეტაპზე AI არ გჭირდებათ",
    },
    initialModels: {
      Workflow: "მიმდინარე სამუშაო პროცესი",
      Bottleneck: "პროცესის შეფერხება",
      Evidence: "ხელმისაწვდომი მტკიცებულება",
      Owner: "გადაწყვეტილების პასუხისმგებელი",
    },
    brand: {
      established: "aiAUDIT · თბილისი",
      title: "მტკიცებულებაზე დაფუძნებული დიაგნოსტიკა",
      location: "თბილისი / შეთანხმებული ფარგლები",
      language: "რეალური ფაქტები. ადამიანის კონტროლი.",
    },
    trust: [
      { value: "ფაქტები", label: "რეალური სამუშაო ფაქტები", detail: "ფაქტებს გადაწყვეტილების მიმღები გვაწვდის.", image: images.evidence },
      { value: "საზღვარი", label: "შეთანხმებული წვდომა", detail: "კერძო სისტემებზე წვდომა ნებართვას მოითხოვს.", image: images.boundary },
      { value: "შემოწმება", label: "ადამიანის შემოწმება", detail: "პროცესის პასუხისმგებელი შედეგს ამოწმებს.", image: images.review },
      { value: "ამ ეტაპზე AI არ გჭირდებათ", label: "იძულებითი დანერგვის გარეშე", detail: "სუსტი შესაბამისობა შემდეგ ნაბიჯს აჩერებს.", image: images.review },
    ],
  },
  en: {
    eyebrow: "What the diagnostic checks",
    title: "The decision starts with evidence.",
    description: "We compare the workflow, bottleneck, human control and available data. No specific model is promised by this page.",
    radar: "Diagnostic workflow checkpoints",
    moreTechnologies: "More checkpoints",
    jevKicker: "Conclusion boundary",
    jevTitle: "AI-fit decision",
    jevDescription: "The result may be a pilot, a measurement step or a conclusion that AI is not needed yet.",
    trustLabel: "Facts, access and human control",
    providerLabels: {
      Workflow: "Workflow",
      Bottleneck: "Bottleneck",
      Evidence: "Evidence",
      Owner: "Decision owner",
      Boundary: "Boundary",
      Fit: "AI fit",
      Pilot: "Pilot",
      Measure: "Measurement",
      Review: "Review",
      Decision: "Decision",
      "Not now": "AI is not needed yet",
    },
    initialModels: {
      Workflow: "Current workflow",
      Bottleneck: "Workflow bottleneck",
      Evidence: "Available evidence",
      Owner: "Decision owner",
    },
    brand: {
      established: "aiAUDIT · Tbilisi",
      title: "EVIDENCE-BOUND DIAGNOSTICS",
      location: "Tbilisi / agreed scope",
      language: "Real facts. Human control.",
    },
    trust: [
      { value: "Facts", label: "REAL OPERATING FACTS", detail: "Supplied by the decision-maker.", image: images.evidence },
      { value: "Boundary", label: "AGREED ACCESS", detail: "Private systems require permission.", image: images.boundary },
      { value: "Review", label: "HUMAN VERIFICATION", detail: "The process owner reviews the result.", image: images.review },
      { value: "AI is not needed yet", label: "NO FORCED IMPLEMENTATION", detail: "Weak fit can stop the next step.", image: images.review },
    ],
  },
  ru: {
    eyebrow: "Что проверяет диагностика",
    title: "Решение начинается с фактов.",
    description: "Сравниваем процесс, узкое место, человеческий контроль и доступные данные. Конкретная модель этой страницей не обещается.",
    radar: "Рабочие точки диагностики",
    moreTechnologies: "Другие точки",
    jevKicker: "Граница вывода",
    jevTitle: "Решение о применимости AI",
    jevDescription: "Результатом может быть пилот, измерение или вывод, что AI пока не нужен.",
    trustLabel: "Факты, доступ и человеческий контроль",
    providerLabels: {
      Workflow: "Процесс",
      Bottleneck: "Узкое место",
      Evidence: "Свидетельства",
      Owner: "Ответственный",
      Boundary: "Граница",
      Fit: "Применимость",
      Pilot: "Пилот",
      Measure: "Измерение",
      Review: "Проверка",
      Decision: "Решение",
      "Not now": "AI пока не нужен",
    },
    initialModels: {
      Workflow: "Текущий процесс",
      Bottleneck: "Узкое место процесса",
      Evidence: "Доступные свидетельства",
      Owner: "Ответственный за решение",
    },
    brand: {
      established: "aiAUDIT · Тбилиси",
      title: "ДИАГНОСТИКА ПО ФАКТАМ",
      location: "Тбилиси / согласованный объём",
      language: "Реальные факты. Контроль человека.",
    },
    trust: [
      { value: "Факты", label: "Факты реальной работы", detail: "Их предоставляет владелец решения.", image: images.evidence },
      { value: "Граница", label: "Согласованный доступ", detail: "Частные системы требуют разрешения.", image: images.boundary },
      { value: "Проверка", label: "Проверка человеком", detail: "Владелец процесса проверяет результат.", image: images.review },
      { value: "AI пока не нужен", label: "Без навязанного внедрения", detail: "Слабая применимость может остановить следующий шаг.", image: images.review },
    ],
  },
};

export function getAiAuditModelProofCopy(locale: string): AiAuditModelProofCopy {
  return AIAUDIT_MODEL_PROOF_COPY[locale === "ka" || locale === "ru" ? locale : "en"];
}
