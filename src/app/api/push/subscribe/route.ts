import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { BadRequestError, handleApiError } from '@/lib/api-errors';

export async function GET() {
  try {
    const user = await RBAC.requireSession(['CAREGIVER', 'CLINICIAN', 'PATIENT']);
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: user.id },
      select: { id: true, endpoint: true, createdAt: true },
    });
    return NextResponse.json({
      success: true,
      vapidConfigured: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      subscriptions,
    });
  } catch (error) {
    return handleApiError(error, 'Push Subscribe GET');
  }
}

export async function POST(request: Request) {
  try {
    const user = await RBAC.requireSession(['CAREGIVER', 'CLINICIAN', 'PATIENT']);
    const body = await request.json();

    const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
    const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh.trim() : '';
    const auth = typeof body.keys?.auth === 'string' ? body.keys.auth.trim() : '';

    if (!endpoint.startsWith('https://') || !p256dh || !auth) {
      throw new BadRequestError('Valid HTTPS push subscription endpoint and keys are required');
    }

    const sub = await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId: user.id, p256dh, auth },
      create: {
        userId: user.id,
        endpoint,
        p256dh,
        auth,
        userAgent: typeof body.userAgent === 'string' ? body.userAgent.slice(0, 200) : null,
      },
    });

    return NextResponse.json({ success: true, id: sub.id }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Push Subscribe POST');
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await RBAC.requireSession(['CAREGIVER', 'CLINICIAN', 'PATIENT']);
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');
    if (!endpoint) {
      throw new BadRequestError('endpoint parameter is required');
    }

    await prisma.pushSubscription.deleteMany({
      where: { userId: user.id, endpoint },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Push Subscribe DELETE');
  }
}
