import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { MedicationService, type MedicationEventSource } from '@/services/medication.service';
import { BadRequestError, handleApiError } from '@/lib/api-errors';

const VALID_MED_ACTIONS = ['TAKEN', 'SKIPPED', 'SNOOZED', 'MISSED'] as const;

export async function GET(req: Request, { params }: { params: { patientId: string } }) {
  try {
    await RBAC.verifyPatientAccess(params.patientId, ['PATIENT', 'CAREGIVER', 'CLINICIAN'], 'view_clinical');
    const { searchParams } = new URL(req.url);
    const includeDiscontinued = searchParams.get('includeDiscontinued') === 'true';
    const medications = await MedicationService.getPatientMedications(params.patientId, includeDiscontinued);
    return NextResponse.json({ medications });
  } catch (error) {
    return handleApiError(error, 'Medications GET');
  }
}

export async function POST(req: Request, { params }: { params: { patientId: string } }) {
  try {
    const user = await RBAC.verifyPatientAccess(params.patientId, ['PATIENT', 'CAREGIVER', 'CLINICIAN'], 'view_routines');
    const body = await req.json();
    const { action, medicationId, scheduledTime, actualTime, eventId, clientMutationId, deviceId } = body as {
      action?: string;
      medicationId?: string;
      scheduledTime?: string;
      actualTime?: string;
      eventId?: string;
      clientMutationId?: string;
      deviceId?: string;
    };

    const normalizedAction = typeof action === 'string' ? action.trim().toUpperCase() : '';

    if (normalizedAction === 'UNDO') {
      if (!eventId || typeof eventId !== 'string') {
        throw new BadRequestError('eventId is required for UNDO');
      }
      const result = await MedicationService.undoMedicationEvent(eventId, params.patientId, user.id);
      return NextResponse.json({ message: 'Event reverted', result });
    }

    if (
      !medicationId ||
      typeof medicationId !== 'string' ||
      !scheduledTime ||
      !VALID_MED_ACTIONS.includes(normalizedAction as (typeof VALID_MED_ACTIONS)[number])
    ) {
      throw new BadRequestError('Valid medicationId, scheduledTime, and action (TAKEN, SKIPPED, SNOOZED, MISSED) are required');
    }

    const parsedScheduled = new Date(scheduledTime);
    if (Number.isNaN(parsedScheduled.getTime())) {
      throw new BadRequestError('Invalid scheduledTime date');
    }

    const parsedActual = actualTime ? new Date(actualTime) : undefined;
    if (parsedActual && Number.isNaN(parsedActual.getTime())) {
      throw new BadRequestError('Invalid actualTime date');
    }

    const source: MedicationEventSource =
      user.role === 'CLINICIAN'
        ? 'CLINICIAN_RECORDED'
        : user.role === 'CAREGIVER'
        ? 'CAREGIVER_CONFIRMED'
        : 'PATIENT_REPORTED';

    const event = await MedicationService.logMedicationEvent({
      patientProfileId: params.patientId,
      medicationId,
      action: normalizedAction,
      scheduledTime: parsedScheduled,
      actualTime: parsedActual,
      userId: user.id,
      source,
      clientMutationId: typeof clientMutationId === 'string' ? clientMutationId.slice(0, 80) : undefined,
      deviceId: typeof deviceId === 'string' ? deviceId.slice(0, 80) : undefined,
    });

    return NextResponse.json({ message: `Medication marked as ${normalizedAction}`, event }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Medications POST');
  }
}
