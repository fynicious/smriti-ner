import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { HydrationService } from '@/services/hydration.service';
import { BadRequestError, handleApiError } from '@/lib/api-errors';

export async function GET(_req: Request, { params }: { params: { patientId: string } }) {
  try {
    await RBAC.verifyPatientAccess(params.patientId, ['PATIENT', 'CAREGIVER', 'CLINICIAN']);

    const [target, summary] = await Promise.all([
      HydrationService.getHydrationTarget(params.patientId),
      HydrationService.getTodayHydrationSummary(params.patientId),
    ]);

    return NextResponse.json({
      target,
      consumed: summary.totalMl,
      targetMl: target.targetMl,
      totalMl: summary.totalMl,
      events: summary.events,
    });
  } catch (error) {
    return handleApiError(error, 'Hydration GET');
  }
}

export async function POST(req: Request, { params }: { params: { patientId: string } }) {
  try {
    const user = await RBAC.verifyPatientAccess(params.patientId, ['PATIENT', 'CAREGIVER']);
    const body = await req.json();
    const { amountMl, action, eventId } = body as {
      amountMl?: number | string;
      action?: string;
      eventId?: string;
    };

    if (action === 'UNDO') {
      if (!eventId || typeof eventId !== 'string') {
        throw new BadRequestError('eventId is required for UNDO');
      }
      const result = await HydrationService.undoIntake(eventId, params.patientId, user.id);
      return NextResponse.json({ message: 'Event reverted', result });
    }

    const parsedAmount = Number(amountMl);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 10 || parsedAmount > 2500) {
      throw new BadRequestError('amountMl must be a number between 10 and 2500');
    }

    const event = await HydrationService.logIntake({
      patientProfileId: params.patientId,
      amountMl: Math.round(parsedAmount),
      userId: user.id,
    });

    return NextResponse.json({ message: 'Hydration logged', event }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Hydration POST');
  }
}
