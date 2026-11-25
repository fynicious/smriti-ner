import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { encryptBinaryBuffer, decryptBinaryBuffer } from '@/lib/crypto-envelope';

export type MediaCategory =
  | 'SCRAPBOOK'
  | 'FAMILY_PHOTO'
  | 'FAMILY_AUDIO'
  | 'MEDICATION_PHOTO'
  | 'VOICE_REMINDER';

export type MediaStorageDriver = 'LOCAL_PRIVATE' | 'DB_ENCRYPTED' | 'SUPABASE_PRIVATE';

const DEFAULT_MEDIA_DIR = path.resolve(process.cwd(), 'private_media');
const DEFAULT_SUPABASE_BUCKET = 'smriti-private-media';

export function resolveMediaStorageDriver(): MediaStorageDriver {
  const explicit = process.env.MEDIA_STORAGE_DRIVER?.trim().toUpperCase();
  if (explicit === 'LOCAL_PRIVATE' || explicit === 'DB_ENCRYPTED' || explicit === 'SUPABASE_PRIVATE') {
    return explicit;
  }
  if (process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return 'SUPABASE_PRIVATE';
  }
  const dbUrl = process.env.DATABASE_URL?.trim() || '';
  if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
    return 'DB_ENCRYPTED';
  }
  return 'LOCAL_PRIVATE';
}

function resolveMediaRoot(): string {
  const configured = process.env.MEDIA_STORAGE_DIR?.trim();
  return configured ? path.resolve(process.cwd(), configured) : DEFAULT_MEDIA_DIR;
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '') || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_SUPABASE_BUCKET;
  return { url, serviceKey, bucket };
}

function parseDataUri(dataUri: string): { mimeType: string; buffer: Buffer } | null {
  const match = dataUri.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) return null;
  const mimeType = match[1].trim().toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  return { mimeType, buffer };
}

export async function storeEncryptedMediaFromDataUri(params: {
  patientId: string;
  uploadedByUserId?: string;
  category: MediaCategory;
  dataUri: string;
}): Promise<{ mediaAssetId: string; url: string; mimeType: string; sizeBytes: number } | null> {
  const parsed = parseDataUri(params.dataUri);
  if (!parsed) return null;

  const driver = resolveMediaStorageDriver();
  const mediaId = crypto.randomUUID();
  const safePatientSeg = params.patientId.replace(/[^a-zA-Z0-9_-]/g, '');
  const storageKey = `${safePatientSeg}/${mediaId}.enc`;
  const sha256 = crypto.createHash('sha256').update(parsed.buffer).digest('hex');
  const encryptedBytes = encryptBinaryBuffer(parsed.buffer, `media:${params.patientId}:${mediaId}`);

  let encryptedBlob: Buffer | null = null;

  if (driver === 'LOCAL_PRIVATE') {
    const mediaRoot = resolveMediaRoot();
    const patientDir = path.join(mediaRoot, safePatientSeg);
    fs.mkdirSync(patientDir, { recursive: true });
    fs.writeFileSync(path.join(mediaRoot, storageKey), encryptedBytes);
  } else if (driver === 'SUPABASE_PRIVATE') {
    const { url, serviceKey, bucket } = getSupabaseConfig();
    if (!url || !serviceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for SUPABASE_PRIVATE driver');
    }
    const uploadRes = await fetch(
      `${url}/storage/v1/object/${encodeURIComponent(bucket)}/${storageKey}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          'Content-Type': 'application/octet-stream',
          'x-upsert': 'true',
        },
        body: new Uint8Array(encryptedBytes),
      }
    );
    if (!uploadRes.ok) {
      throw new Error(`Supabase private upload failed with HTTP ${uploadRes.status}`);
    }
  } else {
    encryptedBlob = encryptedBytes;
  }

  const asset = await prisma.mediaAsset.create({
    data: {
      id: mediaId,
      patientId: params.patientId,
      uploadedByUserId: params.uploadedByUserId || null,
      category: params.category,
      storageProvider: driver,
      storageKey,
      mimeType: parsed.mimeType,
      sizeBytes: parsed.buffer.length,
      sha256,
      encrypted: true,
      encryptedBlob,
    },
  });

  return {
    mediaAssetId: asset.id,
    url: `/api/patients/${params.patientId}/media/${asset.id}`,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
  };
}

export async function readEncryptedMediaAsset(
  patientId: string,
  mediaAssetId: string
): Promise<{
  buffer: Buffer;
  mimeType: string;
  sizeBytes: number;
} | null> {
  const asset = await prisma.mediaAsset.findFirst({
    where: { id: mediaAssetId, patientId },
  });
  if (!asset) return null;

  let raw: Buffer | null = null;

  if (asset.storageProvider === 'DB_ENCRYPTED' && asset.encryptedBlob) {
    raw = Buffer.from(asset.encryptedBlob);
  } else if (asset.storageProvider === 'SUPABASE_PRIVATE') {
    const { url, serviceKey, bucket } = getSupabaseConfig();
    if (!url || !serviceKey) return null;
    const dlRes = await fetch(
      `${url}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${asset.storageKey}`,
      {
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
      }
    );
    if (!dlRes.ok) return null;
    raw = Buffer.from(await dlRes.arrayBuffer());
  } else {
    const mediaRoot = resolveMediaRoot();
    const resolvedPath = path.resolve(mediaRoot, asset.storageKey);
    if (!resolvedPath.startsWith(path.resolve(mediaRoot)) || !fs.existsSync(resolvedPath)) {
      return null;
    }
    raw = fs.readFileSync(resolvedPath);
  }

  if (!raw) return null;

  const decrypted = asset.encrypted
    ? decryptBinaryBuffer(raw, `media:${patientId}:${mediaAssetId}`)
    : raw;

  return {
    buffer: decrypted,
    mimeType: asset.mimeType,
    sizeBytes: decrypted.length,
  };
}

export async function deleteStoredMediaAssets(
  assets: Array<{ storageProvider?: string; storageKey: string }>
): Promise<void> {
  const mediaRoot = resolveMediaRoot();
  const { url, serviceKey, bucket } = getSupabaseConfig();

  for (const item of assets) {
    if (item.storageProvider === 'SUPABASE_PRIVATE') {
      if (url && serviceKey) {
        try {
          await fetch(
            `${url}/storage/v1/object/${encodeURIComponent(bucket)}/${item.storageKey}`,
            {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${serviceKey}`,
                apikey: serviceKey,
              },
            }
          );
        } catch {
          // Best-effort remote cleanup
        }
      }
      continue;
    }

    if (item.storageProvider === 'DB_ENCRYPTED') {
      continue; // Deleted directly by cascading DB constraint
    }

    const resolved = path.resolve(mediaRoot, item.storageKey);
    if (resolved.startsWith(path.resolve(mediaRoot)) && fs.existsSync(resolved)) {
      try {
        fs.unlinkSync(resolved);
      } catch {
        // Best-effort disk cleanup
      }
    }
  }
}

export function deleteStoredMediaFiles(storageKeys: string[]) {
  void deleteStoredMediaAssets(storageKeys.map((storageKey) => ({ storageProvider: 'LOCAL_PRIVATE', storageKey })));
}
