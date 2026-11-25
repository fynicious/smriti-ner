import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/services/audit.service';
import { storeEncryptedMediaFromDataUri } from '@/lib/media-storage';
import { BadRequestError, NotFoundError, handleApiError } from '@/lib/api-errors';

function validateOptionalMedia(val: unknown, kind: 'image' | 'audio', maxBytes: number): string | null {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val !== 'string') return null;
  if (val.length > maxBytes) {
    throw new BadRequestError(`${kind} payload exceeds size limit`);
  }
  if (kind === 'image') {
    if (val.startsWith('data:image/') || val.startsWith('/') || val.startsWith('https://')) {
      return val;
    }
    throw new BadRequestError('Invalid image URI or data URL');
  }
  if (val.startsWith('data:audio/') || val.startsWith('data:video/webm') || val.startsWith('/') || val.startsWith('https://')) {
    return val;
  }
  throw new BadRequestError('Invalid audio URI or data URL');
}

export async function GET(_request: Request, { params }: { params: { patientId: string } }) {
  try {
    const { user } = await RBAC.requirePatientAccess(
      params.patientId,
      ['PATIENT', 'CAREGIVER', 'CLINICIAN'],
      'view_memories'
    );
    const entries = await prisma.scrapbookEntry.findMany({
      where: { patientId: params.patientId },
      orderBy: { dateAdded: 'desc' },
    });

    const filtered = entries
      .filter((e) => user.role === 'CAREGIVER' || e.visibilityScope !== 'HIDDEN')
      .map((e) => ({
        ...e,
        imageBase64: e.mediaPhotoId ? `/api/patients/${params.patientId}/media/${e.mediaPhotoId}` : e.imageBase64,
        audioBase64: e.mediaAudioId ? `/api/patients/${params.patientId}/media/${e.mediaAudioId}` : e.audioBase64,
      }));

    return NextResponse.json({ success: true, entries: filtered });
  } catch (error) {
    return handleApiError(error, 'Scrapbook GET');
  }
}

export async function POST(request: Request, { params }: { params: { patientId: string } }) {
  try {
    const { user } = await RBAC.requirePatientAccess(
      params.patientId,
      ['PATIENT', 'CAREGIVER'],
      'contribute_memories'
    );
    const body = await request.json();

    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : '';
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 1000) : '';
    if (!title || !description) {
      throw new BadRequestError('Memory title and description are required');
    }

    const rawImage = validateOptionalMedia(body.imageBase64, 'image', 2_500_000);
    const rawAudio = validateOptionalMedia(body.audioBase64, 'audio', 4_000_000);

    let mediaPhotoId: string | null = null;
    let storedImageRef: string | null = rawImage;
    if (rawImage && rawImage.startsWith('data:')) {
      const stored = await storeEncryptedMediaFromDataUri({
        patientId: params.patientId,
        uploadedByUserId: user.id,
        category: 'SCRAPBOOK',
        dataUri: rawImage,
      });
      if (stored) {
        mediaPhotoId = stored.mediaAssetId;
        storedImageRef = stored.url;
      }
    }

    let mediaAudioId: string | null = null;
    let storedAudioRef: string | null = rawAudio;
    if (rawAudio && rawAudio.startsWith('data:')) {
      const stored = await storeEncryptedMediaFromDataUri({
        patientId: params.patientId,
        uploadedByUserId: user.id,
        category: 'SCRAPBOOK',
        dataUri: rawAudio,
      });
      if (stored) {
        mediaAudioId = stored.mediaAssetId;
        storedAudioRef = stored.url;
      }
    }

    const entry = await prisma.scrapbookEntry.create({
      data: {
        patientId: params.patientId,
        title,
        description,
        imageBase64: storedImageRef,
        audioBase64: storedAudioRef,
        mediaPhotoId,
        mediaAudioId,
        contributorUserId: user.id,
        contributorName: typeof body.contributorName === 'string' ? body.contributorName.trim().slice(0, 80) : (user.name || user.role),
        languageCode: typeof body.languageCode === 'string' ? body.languageCode.trim().slice(0, 12) : null,
        eventDateLabel: typeof body.eventDateLabel === 'string' ? body.eventDateLabel.trim().slice(0, 40) : null,
        locationLabel: typeof body.locationLabel === 'string' ? body.locationLabel.trim().slice(0, 80) : null,
        visibilityScope: typeof body.visibilityScope === 'string' && body.visibilityScope === 'HIDDEN' && user.role === 'CAREGIVER' ? 'HIDDEN' : 'ALL',
        dateAdded: body.dateAdded && !Number.isNaN(Date.parse(String(body.dateAdded)))
          ? new Date(body.dateAdded)
          : new Date(),
      },
    });

    await AuditService.log({
      userId: user.id,
      action: 'CREATE_SCRAPBOOK_ENTRY',
      resource: 'ScrapbookEntry',
      resourceId: entry.id,
      newValue: title,
    });

    return NextResponse.json({ success: true, entry }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Scrapbook POST');
  }
}

export async function PATCH(request: Request, { params }: { params: { patientId: string } }) {
  try {
    const { user } = await RBAC.requirePatientAccess(
      params.patientId,
      ['PATIENT', 'CAREGIVER'],
      'contribute_memories'
    );
    const body = await request.json();

    const entryId = typeof body.entryId === 'string' ? body.entryId.trim() : '';
    if (!entryId) {
      throw new BadRequestError('entryId is required');
    }

    const existing = await prisma.scrapbookEntry.findFirst({
      where: { id: entryId, patientId: params.patientId },
    });
    if (!existing) {
      throw new NotFoundError('Scrapbook entry not found');
    }

    const data: Record<string, unknown> = {};

    if (typeof body.title === 'string' && body.title.trim()) {
      data.title = body.title.trim().slice(0, 120);
    }
    if (typeof body.description === 'string' && body.description.trim()) {
      data.description = body.description.trim().slice(0, 1000);
    }
    if (body.imageBase64 !== undefined) {
      const rawImg = validateOptionalMedia(body.imageBase64, 'image', 2_500_000);
      if (rawImg && rawImg.startsWith('data:')) {
        const stored = await storeEncryptedMediaFromDataUri({
          patientId: params.patientId,
          uploadedByUserId: user.id,
          category: 'SCRAPBOOK',
          dataUri: rawImg,
        });
        if (stored) {
          data.mediaPhotoId = stored.mediaAssetId;
          data.imageBase64 = stored.url;
        }
      } else {
        data.imageBase64 = rawImg;
      }
    }
    if (body.audioBase64 !== undefined) {
      const rawAud = validateOptionalMedia(body.audioBase64, 'audio', 4_000_000);
      if (rawAud && rawAud.startsWith('data:')) {
        const stored = await storeEncryptedMediaFromDataUri({
          patientId: params.patientId,
          uploadedByUserId: user.id,
          category: 'SCRAPBOOK',
          dataUri: rawAud,
        });
        if (stored) {
          data.mediaAudioId = stored.mediaAssetId;
          data.audioBase64 = stored.url;
        }
      } else {
        data.audioBase64 = rawAud;
      }
    }
    if (typeof body.visibilityScope === 'string' && user.role === 'CAREGIVER') {
      data.visibilityScope = body.visibilityScope === 'HIDDEN' ? 'HIDDEN' : 'ALL';
    }

    const entry = await prisma.scrapbookEntry.update({
      where: { id: existing.id },
      data,
    });

    await AuditService.log({
      userId: user.id,
      action: 'UPDATE_SCRAPBOOK_ENTRY',
      resource: 'ScrapbookEntry',
      resourceId: entry.id,
    });

    return NextResponse.json({ success: true, entry });
  } catch (error) {
    return handleApiError(error, 'Scrapbook PATCH');
  }
}

export async function DELETE(request: Request, { params }: { params: { patientId: string } }) {
  try {
    const { user } = await RBAC.requirePatientAccess(params.patientId, ['PATIENT', 'CAREGIVER'], 'manage_settings');
    const { searchParams } = new URL(request.url);
    const entryId = searchParams.get('entryId');
    if (!entryId) {
      throw new BadRequestError('entryId query parameter is required');
    }

    const deleted = await prisma.scrapbookEntry.deleteMany({
      where: { id: entryId, patientId: params.patientId },
    });

    if (deleted.count === 0) {
      throw new NotFoundError('Scrapbook entry not found');
    }

    await AuditService.log({
      userId: user.id,
      action: 'DELETE_SCRAPBOOK_ENTRY',
      resource: 'ScrapbookEntry',
      resourceId: entryId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Scrapbook DELETE');
  }
}
