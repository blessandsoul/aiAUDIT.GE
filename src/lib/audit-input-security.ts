const FORMAT_CONTROLS = /[\p{Cf}]/gu;

function normalized(text: string): string {
  return text.normalize('NFKC').replace(FORMAT_CONTROLS, '');
}

function luhn(value: string): boolean {
  let sum = 0;
  let double = false;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    let digit = Number(value[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

function containsPaymentCard(text: string): boolean {
  for (const match of text.matchAll(/(?<!\d)(?:\d[ -]?){13,19}(?!\d)/gu)) {
    const digits = match[0].replace(/[ -]/gu, '');
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) return true;
  }
  return false;
}

export function containsAuditCredentials(text: string): boolean {
  const input = normalized(text);
  if (/(?:^|[^\w])sk-[A-Za-z0-9_-]{16,}(?![A-Za-z0-9_-])/u.test(input)) return true;
  if (/(?:^|[^\w])apify_api_[A-Za-z0-9_-]{10,}(?![A-Za-z0-9_-])/iu.test(input)) return true;
  if (/(?:^|[^\w])(?:ghp_|github_pat_)[A-Za-z0-9_-]{10,}(?![A-Za-z0-9_-])/iu.test(input)) return true;
  if (/(?:^|[^\w])AIza[A-Za-z0-9_-]{20,}(?![A-Za-z0-9_-])/u.test(input)) return true;
  if (/(?:^|[^\w])(?:AKIA|ASIA)[A-Z0-9]{16}(?![A-Z0-9])/u.test(input)) return true;
  if (/-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----/u.test(input)) return true;
  if (/\bauthorization\s*[:=]?\s*bearer\s+\S{6,}/iu.test(input)) return true;
  if (/(?:^|[^\p{L}\p{N}_])["']?(?:api[\s_-]*key|access[\s_-]*token|password|secret|парол\p{L}*|ключ\p{L}*|токен(?:\s+доступа)?|პაროლ\p{L}*|გასაღებ\p{L}*|(?:წვდომის\s+)?ტოკენ\p{L}*|საიდუმლ\p{L}*)["']?\s*[:=]\s*(?:"[^"\r\n]{6,}"|'[^'\r\n]{6,}'|[^\s"',;]{6,})/iu.test(input)) return true;
  return false;
}

export function containsSensitiveAuditInput(text: string): boolean {
  const input = normalized(text);
  return containsAuditCredentials(input) || containsPaymentCard(input);
}
