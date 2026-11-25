import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { readEncryptedMediaAsset } from '@/lib/media-storage';
import { NotFoundError, handleApiError } from '@/lib/api-errors';

export async function GET(
  _request: Request,
  { params }: { params: { patientId: string; assetId: string } }
) {
  try {
    await RBAC.verifyPatientAccess(
      params.patientId,
      ['PATIENT', 'CAREGIVER', 'CLINICIAN'],
      'view_memories'
    );

    const media = await readEncryptedMediaAsset(params.patientId, params.assetId);
    if (!media) {
      throw new NotFoundError('Media asset not found');
    }

    return new NextResponse(new Uint8Array(media.buffer), {
      status: 200,
      headers: {
        'Content-Type': media.mimeType,
        'Content-Length': String(media.sizeBytes),
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return handleApiError(error, 'Private Media GET');
  }
}
