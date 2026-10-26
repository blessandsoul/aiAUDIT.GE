import { NextRequest } from 'next/server';

import { auditHistoryRuntimeHandler } from '@/lib/audit-history/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

async function idFrom(context: RouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return auditHistoryRuntimeHandler(request, [await idFrom(context)]);
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return auditHistoryRuntimeHandler(request, [await idFrom(context)]);
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  return auditHistoryRuntimeHandler(request, [await idFrom(context)]);
}
