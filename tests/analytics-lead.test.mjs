import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dialog = fs.readFileSync(
  path.join(root, 'src/features/home/components/AiIntakeLeadDialog.tsx'),
  'utf8',
);
const analytics = fs.readFileSync(path.join(root, 'src/lib/analytics.ts'), 'utf8');

test('audit lead emits one consent-aware event only after delivery succeeds', () => {
  assert.match(dialog, /createLeadEventId, trackLead/);
  assert.match(dialog, /useRef<string \| null>\(null\)/);
  assert.match(dialog, /const leadEventId = leadEventIdRef\.current \?\? createLeadEventId\(\)/);
  assert.match(dialog, /trackLead\('audit_intake', leadEventId\)/);
  assert.match(dialog, /leadEventIdRef\.current = null/);
  assert.ok(dialog.indexOf("if (!response.ok) throw new Error('Lead delivery failed');") < dialog.indexOf("trackLead('audit_intake', leadEventId)"));
  assert.match(analytics, /\| "audit_intake";/);
});
