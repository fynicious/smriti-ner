import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { deleteStoredMediaAssets } from '@/lib/media-storage';
import { AuditService } from '@/services/audit.service';
import { BadRequestError, ForbiddenError, handleApiError } from '@/lib/api-errors';

/**
 * Authorized Account & Patient Data Deletion endpoint (SMRITI v1.0 Section 13.4).
 * Requires explicit confirmation string "DELETE" and writes an audit record before cascading removal.
 */
export async function POST(request: Request) {
  try {
    const user = await RBAC.requireSession(['PATIENT', 'CAREGIVER', 'CLINICIAN']);
    const body = await request.json();

    const confirm = typeof body.confirm === 'string' ? body.confirm.trim().toUpperCase() : '';
    const targetPatientId = typeof body.patientId === 'string' ? body.patientId.trim() : '';

    if (confirm !== 'DELETE') {
      throw new BadRequestError('Type DELETE to confirm permanent data removal');
    }

    // Deleting a paired patient's account & clinical dataset (CAREGIVER with manage_settings only)
    if (targetPatientId) {
      if (user.role !== 'CAREGIVER') {
        throw new ForbiddenError('Only an authorized caregiver may delete a managed patient record');
      }
      await RBAC.verifyPatientAccess(targetPatientId, ['CAREGIVER'], 'manage_settings');

      const patient = await prisma.patientProfile.findUnique({
        where: { id: targetPatientId },
        include: { mediaAssets: { select: { storageProvider: true, storageKey: true } } },
      });
      if (!patient) {
        throw new BadRequestError('Patient profile not found');
      }

      const mediaAssets = patient.mediaAssets;

      await AuditService.log({
        userId: user.id,
        action: 'DELETE_PATIENT_ACCOUNT_AND_DATA',
        resource: 'PatientProfile',
        resourceId: targetPatientId,
        prevValue: `Deleted patient ${targetPatientId} (${mediaAssets.length} media files)`,
      });

      await prisma.user.delete({ where: { id: patient.userId } });
      await deleteStoredMediaAssets(mediaAssets);

      return NextResponse.json({
        success: true,
        message: 'Patient account and all associated data have been permanently removed.',
      });
    }

    // Self-deletion of Caregiver / Clinician own user account
    await AuditService.log({
      userId: user.id,
      action: 'DELETE_OWN_ACCOUNT',
      resource: 'User',
      resourceId: user.id,
    });

    await prisma.user.delete({ where: { id: user.id } });
    return NextResponse.json({
      success: true,
      message: 'Account has been permanently deleted.',
    });
  } catch (error) {
    return handleApiError(error, 'Account Delete POST');
  }
}
