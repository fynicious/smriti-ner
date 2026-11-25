import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Production Health & Readiness Endpoint.
 * Reports database reachability, storage driver mode, and core config readiness without exposing secret values.
 */
export async function GET() {
  const dbUrl = process.env.DATABASE_URL?.trim() || '';
  const dbKind = dbUrl.startsWith('postgres') ? 'postgresql' : 'sqlite';
  const storageDriver =
    process.env.MEDIA_STORAGE_DRIVER?.trim().toUpperCase() ||
    (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
      ? 'SUPABASE_PRIVATE'
      : dbKind === 'postgresql'
      ? 'DB_ENCRYPTED'
      : 'LOCAL_PRIVATE');

  const configReady = Boolean(
    process.env.NEXTAUTH_SECRET?.trim() &&
      process.env.ENCRYPTION_MASTER_KEY?.trim()
  );

  try {
    await prisma.user.count();
    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: { status: 'connected', engine: dbKind },
        mediaStorageDriver: storageDriver,
        configReady,
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  } catch {
    return NextResponse.json(
      {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        database: { status: 'disconnected', engine: dbKind },
        mediaStorageDriver: storageDriver,
        configReady,
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  }
}
