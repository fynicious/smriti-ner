import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/services/audit.service';
import { storeEncryptedMediaFromDataUri } from '@/lib/media-storage';
import { BadRequestError, ForbiddenError, NotFoundError, handleApiError } from '@/lib/api-errors';

const VALID_SCOPES = ['ALL', 'GAMES_ONLY', 'MEMORIES_ONLY', 'HIDDEN'] as const;

function isValidAssetUri(val: unknown, kind: 'image' | 'audio', maxBytes: number): string | null {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val !== 'string') return null;
  if (val.length > maxBytes) {
    throw new BadRequestError(`${kind} payload exceeds size limit`);
  }
  if (kind === 'image') {
    if (val.startsWith('data:image/') || val.startsWith('/') || val.startsWith('https://')) {
      return val;
    }
    throw new BadRequestError('Invalid image URI/data format');
  }
  if (val.startsWith('data:audio/') || val.startsWith('data:video/webm') || val.startsWith('/') || val.startsWith('https://')) {
    return val;
  }
  throw new BadRequestError('Invalid audio URI/data format');
}

function resolveMediaFields(asset: {
  imageBase64: string | null;
  audioBase64: string | null;
  mediaPhotoId: string | null;
  mediaAudioId: string | null;
}, patientId: string) {
  return {
    imageUrl: asset.mediaPhotoId ? `/api/patients/${patientId}/media/${asset.mediaPhotoId}` : asset.imageBase64,
    audioUrl: asset.mediaAudioId ? `/api/patients/${patientId}/media/${asset.mediaAudioId}` : asset.audioBase64,
  };
}

export async function GET(request: Request, { params }: { params: { patientId: string } }) {
  try {
    const { user } = await RBAC.requirePatientAccess(params.patientId, ['PATIENT', 'CAREGIVER', 'CLINICIAN'], 'view_memories');
    const { searchParams } = new URL(request.url);
    const context = (searchParams.get('context') || 'ALL').toUpperCase();

    const assets = await prisma.familyAsset.findMany({
      where: { patientId: params.patientId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    const filtered = assets.filter((a) => {
      if (user.role === 'CAREGIVER') return true;
      if (a.visibilityScope === 'HIDDEN') return false;
      if (context === 'GAMES' && a.visibilityScope === 'MEMORIES_ONLY') return false;
      if (context === 'MEMORIES' && a.visibilityScope === 'GAMES_ONLY') return false;
      return true;
    });

    const enriched = filtered.map((a) => {
      const urls = resolveMediaFields(a, params.patientId);
      return {
        ...a,
        imageBase64: a.imageBase64 || urls.imageUrl,
        audioBase64: a.audioBase64 || urls.audioUrl,
        imageUrl: urls.imageUrl,
        audioUrl: urls.audioUrl,
      };
    });

    return NextResponse.json({ success: true, assets: enriched });
  } catch (error) {
    return handleApiError(error, 'Family Assets GET');
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

    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
    const relation = typeof body.relation === 'string' ? body.relation.trim().slice(0, 60) : '';
    if (!name || !relation) {
      throw new BadRequestError('Name and relationship are required');
    }

    const rawImage = isValidAssetUri(body.imageBase64, 'image', 2_500_000);
    const rawAudio = isValidAssetUri(body.audioBase64, 'audio', 4_000_000);

    if (!rawImage && !rawAudio) {
      throw new BadRequestError('Provide at least a photo or a voice recording');
    }

    let mediaPhotoId: string | null = null;
    let storedImageRef: string | null = rawImage;
    if (rawImage && rawImage.startsWith('data:')) {
      const stored = await storeEncryptedMediaFromDataUri({
        patientId: params.patientId,
        uploadedByUserId: user.id,
        category: 'FAMILY_PHOTO',
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
        category: 'FAMILY_AUDIO',
        dataUri: rawAudio,
      });
      if (stored) {
        mediaAudioId = stored.mediaAssetId;
        storedAudioRef = stored.url;
      }
    }

    const canConfigureCalling = user.role === 'CAREGIVER';
    const allowCall = canConfigureCalling ? Boolean(body.allowCall) : false;
    const requireCallConfirm = body.requireCallConfirm !== false;
    const phoneNumber = canConfigureCalling && typeof body.phoneNumber === 'string'
      ? body.phoneNumber.trim().slice(0, 30) || null
      : null;

    const rawScope = typeof body.visibilityScope === 'string' ? body.visibilityScope.toUpperCase() : 'ALL';
    const visibilityScope = canConfigureCalling && VALID_SCOPES.includes(rawScope as (typeof VALID_SCOPES)[number])
      ? rawScope
      : 'ALL';

    const asset = await prisma.familyAsset.create({
      data: {
        patientId: params.patientId,
        name,
        relation,
        phoneNumber,
        allowCall,
        requireCallConfirm,
        contributorUserId: user.id,
        visibilityScope,
        imageBase64: storedImageRef,
        audioBase64: storedAudioRef,
        mediaPhotoId,
        mediaAudioId,
        isActive: true,
      },
    });

    await AuditService.log({
      userId: user.id,
      action: 'CREATE_FAMILY_ASSET',
      resource: 'FamilyAsset',
      resourceId: asset.id,
      newValue: `${name} (${relation}) [scope:${visibilityScope}]`,
    });

    return NextResponse.json({ success: true, asset }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Family Assets POST');
  }
}

export async function PATCH(request: Request, { params }: { params: { patientId: string } }) {
  try {
    const { user } = await RBAC.requirePatientAccess(params.patientId, ['CAREGIVER'], 'manage_settings');
    if (user.role !== 'CAREGIVER') {
      throw new ForbiddenError('Only caregivers may modify family calling & visibility permissions');
    }

    const body = await request.json();
    const assetId = typeof body.assetId === 'string' ? body.assetId.trim() : '';
    if (!assetId) {
      throw new BadRequestError('assetId is required');
    }

    const existing = await prisma.familyAsset.findFirst({
      where: { id: assetId, patientId: params.patientId, isActive: true },
    });
    if (!existing) {
      throw new NotFoundError('Family asset not found');
    }

    const updateData: Record<string, unknown> = {};
    if (typeof body.allowCall === 'boolean') updateData.allowCall = body.allowCall;
    if (typeof body.requireCallConfirm === 'boolean') updateData.requireCallConfirm = body.requireCallConfirm;
    if (body.phoneNumber !== undefined) {
      updateData.phoneNumber = typeof body.phoneNumber === 'string' ? body.phoneNumber.trim().slice(0, 30) || null : null;
    }
    if (typeof body.visibilityScope === 'string') {
      const s = body.visibilityScope.toUpperCase();
      if (VALID_SCOPES.includes(s as (typeof VALID_SCOPES)[number])) {
        updateData.visibilityScope = s;
      }
    }

    const updated = await prisma.familyAsset.update({
      where: { id: existing.id },
      data: updateData,
    });

    await AuditService.log({
      userId: user.id,
      action: 'UPDATE_FAMILY_ASSET_PERMISSIONS',
      resource: 'FamilyAsset',
      resourceId: existing.id,
      newValue: JSON.stringify(updateData),
    });

    return NextResponse.json({ success: true, asset: updated });
  } catch (error) {
    return handleApiError(error, 'Family Assets PATCH');
  }
}

export async function DELETE(request: Request, { params }: { params: { patientId: string } }) {
  try {
    const { user } = await RBAC.requirePatientAccess(params.patientId, ['CAREGIVER'], 'manage_settings');
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get('assetId');
    if (!assetId) {
      throw new BadRequestError('assetId query parameter is required');
    }

    const updated = await prisma.familyAsset.updateMany({
      where: { id: assetId, patientId: params.patientId, isActive: true },
      data: { isActive: false },
    });

    if (updated.count === 0) {
      throw new NotFoundError('Family asset not found');
    }

    await AuditService.log({
      userId: user.id,
      action: 'DELETE_FAMILY_ASSET',
      resource: 'FamilyAsset',
      resourceId: assetId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Family Assets DELETE');
  }
}
