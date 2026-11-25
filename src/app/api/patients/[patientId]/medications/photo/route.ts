import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { storeEncryptedMediaFromDataUri } from '@/lib/media-storage';
import { AuditService } from '@/services/audit.service';
import { BadRequestError, NotFoundError, handleApiError } from '@/lib/api-errors';

/**
 * Allows Caregivers (or assigned Clinicians) to attach an actual pill/strip photograph
 * to an existing prescribed Medication without modifying prescribed name/dosage/frequency.
 */
export async function PATCH(request: Request, { params }: { params: { patientId: string } }) {
  try {
    const { user } = await RBAC.requirePatientAccess(params.patientId, ['CAREGIVER', 'CLINICIAN'], 'edit_routines');
    const body = await request.json();

    const medicationId = typeof body.medicationId === 'string' ? body.medicationId.trim() : '';
    const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
    if (!medicationId) {
      throw new BadRequestError('medicationId is required');
    }
    if (imageBase64 && (!imageBase64.startsWith('data:image/') || imageBase64.length > 2_500_000)) {
      throw new BadRequestError('Valid image data URL (<2.5MB) is required');
    }

    const existing = await prisma.medication.findFirst({
      where: { id: medicationId, patientId: params.patientId },
    });
    if (!existing) {
      throw new NotFoundError('Medication not found for this patient');
    }

    let mediaAssetId: string | null = existing.mediaAssetId;
    let imageUrl: string | null = existing.imageUrl;

    if (!imageBase64) {
      mediaAssetId = null;
      imageUrl = null;
    } else {
      const stored = await storeEncryptedMediaFromDataUri({
        patientId: params.patientId,
        uploadedByUserId: user.id,
        category: 'MEDICATION_PHOTO',
        dataUri: imageBase64,
      });
      if (!stored) {
        throw new BadRequestError('Could not process medication photograph');
      }
      mediaAssetId = stored.mediaAssetId;
      imageUrl = stored.url;
    }

    const updated = await prisma.medication.update({
      where: { id: existing.id },
      data: { imageUrl, mediaAssetId },
    });

    await AuditService.log({
      userId: user.id,
      action: imageBase64 ? 'ATTACH_MEDICATION_PHOTO' : 'REMOVE_MEDICATION_PHOTO',
      resource: 'Medication',
      resourceId: existing.id,
    });

    return NextResponse.json({ success: true, medication: updated });
  } catch (error) {
    return handleApiError(error, 'Medication Photo PATCH');
  }
}
