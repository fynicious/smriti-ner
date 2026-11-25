import { prisma } from '@/lib/prisma';
import { AuditService } from './audit.service';
import { NotFoundError } from '@/lib/api-errors';

export type MedicationEventSource = 'PATIENT_REPORTED' | 'CAREGIVER_CONFIRMED' | 'CLINICIAN_RECORDED';

export class MedicationService {
  /**
   * Get all active medications for a specific patient along with today's events.
   */
  static async getPatientMedications(patientProfileId: string, includeDiscontinued = false) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    return prisma.medication.findMany({
      where: {
        patientId: patientProfileId,
        ...(includeDiscontinued ? {} : { status: 'ACTIVE' }),
      },
      include: {
        events: {
          where: {
            scheduledTime: { gte: startOfDay },
            status: 'ACTIVE',
          },
          orderBy: { createdAt: 'desc' },
        },
        clinician: {
          select: { fullName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Logs a medication event (TAKEN, SKIPPED, SNOOZED, MISSED) verifying patient ownership
   * and persisting whether intake was PATIENT_REPORTED vs CAREGIVER_CONFIRMED.
   */
  static async logMedicationEvent(params: {
    patientProfileId: string;
    medicationId: string;
    action: string;
    scheduledTime: Date;
    actualTime?: Date;
    userId: string;
    source?: MedicationEventSource;
    clientMutationId?: string;
    deviceId?: string;
  }) {
    const medication = await prisma.medication.findFirst({
      where: {
        id: params.medicationId,
        patientId: params.patientProfileId,
        status: 'ACTIVE',
      },
    });

    if (!medication) {
      throw new NotFoundError('Active medication not found for this patient');
    }

    const source = params.source || 'PATIENT_REPORTED';

    const event = await prisma.medicationEvent.create({
      data: {
        patientId: params.patientProfileId,
        medicationId: medication.id,
        action: params.action,
        scheduledTime: params.scheduledTime,
        actualTime: params.actualTime || new Date(),
        recordedByUserId: params.userId,
        source,
        clientMutationId: params.clientMutationId || null,
        deviceId: params.deviceId || null,
        status: 'ACTIVE',
      },
    });

    await AuditService.log({
      userId: params.userId,
      action: `MEDICATION_${params.action.toUpperCase()}`,
      resource: 'MedicationEvent',
      resourceId: event.id,
      newValue: JSON.stringify({ medicationId: medication.id, action: params.action, source }),
    });

    return event;
  }

  /**
   * Undo a medication event securely by soft-deleting it, scoped strictly to patientProfileId.
   */
  static async undoMedicationEvent(eventId: string, patientProfileId: string, userId: string) {
    const existing = await prisma.medicationEvent.findFirst({
      where: {
        id: eventId,
        patientId: patientProfileId,
        status: 'ACTIVE',
      },
    });

    if (!existing) {
      throw new NotFoundError('Medication event not found for this patient');
    }

    const event = await prisma.medicationEvent.update({
      where: { id: existing.id },
      data: { status: 'DELETED' },
    });

    await AuditService.log({
      userId,
      action: 'MEDICATION_UNDO',
      resource: 'MedicationEvent',
      resourceId: event.id,
      prevValue: 'ACTIVE',
      newValue: 'DELETED',
    });

    return event;
  }
}
