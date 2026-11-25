import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export class PairingService {
  /**
   * Generates a 6-digit secure pairing code for a caregiver
   */
  static async generatePairingCode(caregiverId: string) {
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour expiry

    const invitation = await prisma.pairingInvitation.create({
      data: {
        caregiverId,
        code,
        expiresAt,
        status: 'PENDING'
      }
    });

    return invitation;
  }

  /**
   * Accepts a pairing code and securely links the Patient to the Caregiver
   */
  static async acceptPairing(patientId: string, code: string) {
    const invitation = await prisma.pairingInvitation.findUnique({
      where: { code }
    });

    if (!invitation) {
      throw new Error('Invalid pairing code');
    }

    if (invitation.status !== 'PENDING') {
      throw new Error('This code has already been used or expired');
    }

    if (new Date() > invitation.expiresAt) {
      await prisma.pairingInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' }
      });
      throw new Error('This pairing code has expired');
    }

    // Wrap in transaction to ensure consistency
    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark invitation as accepted
      await tx.pairingInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' }
      });

      // 2. Create the relationship
      const relationship = await tx.patientCaregiver.create({
        data: {
          patientId,
          caregiverId: invitation.caregiverId,
          status: 'ACTIVE'
        }
      });

      // 3. Log audit event
      await tx.auditLog.create({
        data: {
          action: 'PAIR_CAREGIVER',
          resource: 'PatientCaregiver',
          resourceId: relationship.id,
          newValue: `Patient ${patientId} paired with Caregiver ${invitation.caregiverId}`
        }
      });

      return relationship;
    });

    return result;
  }

  /**
   * Retrieves all caregivers authorized for a specific patient
   */
  static async getAuthorizedCaregivers(patientId: string) {
    return prisma.patientCaregiver.findMany({
      where: { patientId, status: 'ACTIVE' },
      include: { caregiver: true }
    });
  }

  /**
   * Retrieves all patients authorized for a specific caregiver
   */
  static async getAuthorizedPatients(caregiverId: string) {
    return prisma.patientCaregiver.findMany({
      where: { caregiverId, status: 'ACTIVE' },
      include: { patient: true }
    });
  }
}
