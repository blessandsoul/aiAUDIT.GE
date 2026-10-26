import { NextRequest } from 'next/server';

import { auditHistoryRuntimeHandler } from '@/lib/audit-history/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const params = await context.params;
  return auditHistoryRuntimeHandler(request, [params.id, 'turn']);
}

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const params = await context.params;
  return auditHistoryRuntimeHandler(request, [params.id, 'turn']);
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  const params = await context.params;
  return auditHistoryRuntimeHandler(request, [params.id, 'turn']);
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  const params = await context.params;
  return auditHistoryRuntimeHandler(request, [params.id, 'turn']);
}
