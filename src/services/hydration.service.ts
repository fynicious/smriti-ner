import { prisma } from '@/lib/prisma';
import { AuditService } from './audit.service';
import { NotFoundError } from '@/lib/api-errors';

export class HydrationService {
  /**
   * Get today's hydration target for a patient.
   */
  static async getHydrationTarget(patientProfileId: string) {
    const target = await prisma.hydrationTarget.findFirst({
      where: { patientId: patientProfileId },
      orderBy: { effectiveFrom: 'desc' },
    });

    return target || { targetMl: 2000, patientId: patientProfileId };
  }

  /**
   * Get total hydration amount consumed today.
   */
  static async getTodayHydrationSummary(patientProfileId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const events = await prisma.hydrationEvent.findMany({
      where: {
        patientId: patientProfileId,
        status: 'ACTIVE',
        timestamp: { gte: startOfDay },
      },
      orderBy: { timestamp: 'desc' },
    });

    const totalMl = events.reduce((total, event) => total + event.amountMl, 0);
    return { totalMl, events };
  }

  static async getTodayHydration(patientProfileId: string) {
    const { totalMl } = await HydrationService.getTodayHydrationSummary(patientProfileId);
    return totalMl;
  }

  /**
   * Log water intake event.
   */
  static async logIntake(params: {
    patientProfileId: string;
    amountMl: number;
    userId: string;
  }) {
    const event = await prisma.hydrationEvent.create({
      data: {
        patientId: params.patientProfileId,
        amountMl: params.amountMl,
        status: 'ACTIVE',
      },
    });

    await AuditService.log({
      userId: params.userId,
      action: 'HYDRATION_LOG',
      resource: 'HydrationEvent',
      resourceId: event.id,
      newValue: `${params.amountMl} ml`,
    });

    return event;
  }

  /**
   * Undo hydration event (soft delete) scoped strictly to the authorized patient.
   */
  static async undoIntake(eventId: string, patientProfileId: string, userId: string) {
    const existing = await prisma.hydrationEvent.findFirst({
      where: {
        id: eventId,
        patientId: patientProfileId,
        status: 'ACTIVE',
      },
    });

    if (!existing) {
      throw new NotFoundError('Hydration event not found for this patient');
    }

    const event = await prisma.hydrationEvent.update({
      where: { id: existing.id },
      data: { status: 'DELETED' },
    });

    await AuditService.log({
      userId,
      action: 'HYDRATION_UNDO',
      resource: 'HydrationEvent',
      resourceId: event.id,
      prevValue: 'ACTIVE',
      newValue: 'DELETED',
    });

    return event;
  }
}
