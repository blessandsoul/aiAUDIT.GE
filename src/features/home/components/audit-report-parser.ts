export type AuditReportSection = {
  key: string;
  heading: string;
  body: string;
};

const REPORT_SECTION_LABELS: Array<{ key: string; labels: string[] }> = [
  { key: 'scope', labels: ['რა შევისწავლეთ — თქვენი მიზანი და ბიზნესი', 'Что исследовали — ваш бизнес и цель', 'Scope — your business and goal'] },
  { key: 'conclusion', labels: ['დასკვნა', 'მოკლე დასკვნა', 'Вывод', 'Краткий вывод', 'Conclusion', 'Short conclusion'] },
  { key: 'next', labels: ['შემდეგი ნაბიჯი / შემოთავაზებული შემოწმება', 'შემდეგი ნაბიჯი — ერთი პრაქტიკული შემოწმება', 'Следующий шаг / предлагаемая проверка', 'Следующий шаг — одна практическая проверка', 'Next step / proposed test', 'Next step — one practical check'] },
  { key: 'measure', labels: ['რა გავზომოთ', 'რას გავზომავთ', 'Что измерить', 'Что измерять', 'What to measure'] },
  { key: 'decide', labels: ['როდის გავაგრძელოთ', 'როდის დავუბრუნდეთ საკითხს', 'Как принять решение по результату', 'Когда вернуться к вопросу', 'How to decide after the test', 'When to revisit'] },
  { key: 'requirements', labels: ['რა დაგჭირდებათ', 'Что потребуется', 'Requirements'] },
  { key: 'risks', labels: ['რისკი და შეზღუდვა', 'Риски и ограничения', 'Risks and limitations'] },
  { key: 'confidence', labels: ['სანდოობა და ინფორმაციის ნაკლებობა', 'Уверенность и пробелы', 'Confidence and gaps'] },
  { key: 'not-recommended', labels: ['რას არ გირჩევთ ახლა', 'Что сейчас не рекомендуем', 'Not recommended now'] },
  { key: 'evidence', labels: ['მტკიცებულება — თქვენი სიტყვები', 'Основания — ваши слова', 'Evidence — your words'] },
];

function reportHeadingKey(value: string): string | null {
  const normalized = value.trim().replace(/:$/, '');
  return REPORT_SECTION_LABELS.find(({ labels }) => labels.some((label) => normalized === label))?.key ?? null;
}

export function parseAuditReport(content: string): { title: string; sections: AuditReportSection[]; fallback: string[] } {
  const blocks = content.trim().split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const title = blocks[0]?.split('\n')[0]?.trim() || 'aiAUDIT';
  const sections: AuditReportSection[] = [];
  const fallback: string[] = [];
  let current: AuditReportSection | null = null;

  for (const block of blocks.slice(1)) {
    const lines = block.split(/\r?\n/);
    const heading = lines[0]?.trim() || '';
    const key = reportHeadingKey(heading);
    if (key) {
      if (current) sections.push(current);
      current = { key, heading, body: lines.slice(1).join('\n').trim() };
    } else if (current) {
      current.body = [current.body, block].filter(Boolean).join('\n\n');
    } else {
      fallback.push(block);
    }
  }
  if (current) sections.push(current);
  return { title, sections, fallback };
}
