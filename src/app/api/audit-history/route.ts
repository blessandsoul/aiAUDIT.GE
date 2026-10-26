import { NextRequest } from 'next/server';

import { auditHistoryRuntimeHandler } from '@/lib/audit-history/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: NextRequest): Promise<Response> {
  return auditHistoryRuntimeHandler(request, []);
}

export function POST(request: NextRequest): Promise<Response> {
  return auditHistoryRuntimeHandler(request, []);
}

export function DELETE(request: NextRequest): Promise<Response> {
  return auditHistoryRuntimeHandler(request, []);
}
