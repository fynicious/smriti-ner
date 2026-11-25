import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/services/audit.service';
import { BadRequestError, ForbiddenError, NotFoundError, handleApiError } from '@/lib/api-errors';

function isValidCoord(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return null;
  if (nLat < -90 || nLat > 90 || nLng < -180 || nLng > 180) return null;
  return { lat: nLat, lng: nLng };
}

export async function GET(request: Request, { params }: { params: { patientId: string } }) {
  try {
    await RBAC.requirePatientAccess(params.patientId, ['PATIENT', 'CAREGIVER', 'CLINICIAN'], 'view_location');
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 30));

    const [safeZones, pings, events] = await Promise.all([
      prisma.safeZone.findMany({
        where: { patientId: params.patientId, isActive: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.locationPing.findMany({
        where: { patientId: params.patientId },
        orderBy: { recordedAt: 'desc' },
        take: limit,
      }),
      prisma.locationEvent.findMany({
        where: { patientId: params.patientId },
        orderBy: { timestamp: 'desc' },
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      safeZones,
      latestPing: pings[0] || null,
      pings,
      events,
    });
  } catch (error) {
    return handleApiError(error, 'Safety GET');
  }
}

export async function POST(request: Request, { params }: { params: { patientId: string } }) {
  try {
    const body = await request.json();
    const kind = typeof body.kind === 'string' ? body.kind.toUpperCase() : 'PING';

    if (kind === 'SAFE_ZONE') {
      const { user } = await RBAC.requirePatientAccess(params.patientId, ['CAREGIVER'], 'manage_settings');
      const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
      const coords = isValidCoord(body.lat, body.lng);
      const radius = Math.round(Number(body.radius));

      if (!name || !coords || !Number.isFinite(radius) || radius < 10 || radius > 50000) {
        throw new BadRequestError('Valid safe zone name, coordinates (lat/lng), and radius (10-50000m) are required');
      }

      const safeZone = await prisma.safeZone.create({
        data: {
          patientId: params.patientId,
          name,
          lat: coords.lat,
          lng: coords.lng,
          radius,
          isActive: true,
        },
      });

      await AuditService.log({
        userId: user.id,
        action: 'CREATE_SAFE_ZONE',
        resource: 'SafeZone',
        resourceId: safeZone.id,
        newValue: `${name} (${radius}m)`,
      });

      return NextResponse.json({ success: true, safeZone }, { status: 201 });
    }

    if (kind === 'LOCATION_EVENT') {
      const { user } = await RBAC.requirePatientAccess(params.patientId, ['PATIENT', 'CAREGIVER'], 'view_location');
      const eventType = typeof body.eventType === 'string' ? body.eventType.toUpperCase() : '';
      if (!['ZONE_ENTER', 'ZONE_EXIT', 'TRACKING_DISABLED'].includes(eventType)) {
        throw new BadRequestError('Invalid location eventType');
      }

      const coords = body.lat !== undefined && body.lng !== undefined ? isValidCoord(body.lat, body.lng) : null;
      const accuracy = body.accuracy !== undefined && Number.isFinite(Number(body.accuracy))
        ? Math.max(0, Number(body.accuracy))
        : null;

      const event = await prisma.locationEvent.create({
        data: {
          patientId: params.patientId,
          eventType,
          zoneId: typeof body.zoneId === 'string' ? body.zoneId : null,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          accuracy,
        },
      });

      await AuditService.log({
        userId: user.id,
        action: 'RECORD_LOCATION_EVENT',
        resource: 'LocationEvent',
        resourceId: event.id,
        newValue: eventType,
      });

      return NextResponse.json({ success: true, event }, { status: 201 });
    }

    // Default: PING — verify LOCATION_SHARING consent if a latest withdrawal record exists
    const { user } = await RBAC.requirePatientAccess(params.patientId, ['PATIENT', 'CAREGIVER'], 'view_location');
    const latestLocConsent = await prisma.consentRecord.findFirst({
      where: { patientId: params.patientId, scope: 'LOCATION_SHARING' },
      orderBy: { createdAt: 'desc' },
    });
    if (latestLocConsent && !latestLocConsent.granted) {
      throw new ForbiddenError('Location sharing consent is currently withdrawn for this patient');
    }

    const coords = isValidCoord(body.lat, body.lng);
    const accuracy = Number(body.accuracy);
    const status = typeof body.status === 'string' ? body.status.toUpperCase() : 'UNAVAILABLE';

    if (!coords || !Number.isFinite(accuracy) || accuracy < 0) {
      throw new BadRequestError('Valid lat, lng, and non-negative accuracy are required');
    }
    if (!['INSIDE', 'OUTSIDE', 'UNAVAILABLE', 'STALE'].includes(status)) {
      throw new BadRequestError('Invalid location ping status');
    }

    const insideZoneId = typeof body.insideZoneId === 'string' && body.insideZoneId ? body.insideZoneId : null;

    const prevPing = await prisma.locationPing.findFirst({
      where: { patientId: params.patientId },
      orderBy: { recordedAt: 'desc' },
      select: { status: true, insideZoneId: true },
    });

    const result = await prisma.$transaction(async (tx) => {
      const ping = await tx.locationPing.create({
        data: {
          patientId: params.patientId,
          lat: coords.lat,
          lng: coords.lng,
          accuracy,
          status,
          insideZoneId,
          recordedAt: body.recordedAt && !Number.isNaN(Date.parse(String(body.recordedAt)))
            ? new Date(body.recordedAt)
            : new Date(),
        },
      });

      let event = null;
      if (prevPing && prevPing.status !== status && (status === 'OUTSIDE' || status === 'INSIDE')) {
        event = await tx.locationEvent.create({
          data: {
            patientId: params.patientId,
            eventType: status === 'OUTSIDE' ? 'ZONE_EXIT' : 'ZONE_ENTER',
            zoneId: status === 'INSIDE' ? insideZoneId : prevPing.insideZoneId,
            lat: coords.lat,
            lng: coords.lng,
            accuracy,
          },
        });
      }

      return { ping, event };
    });

    if (result.event) {
      await AuditService.log({
        userId: user.id,
        action: result.event.eventType,
        resource: 'LocationEvent',
        resourceId: result.event.id,
      });
    }

    return NextResponse.json({ success: true, ping: result.ping, event: result.event }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Safety POST');
  }
}

export async function DELETE(request: Request, { params }: { params: { patientId: string } }) {
  try {
    const { user } = await RBAC.requirePatientAccess(params.patientId, ['CAREGIVER'], 'manage_settings');
    if (user.role !== 'CAREGIVER') {
      throw new ForbiddenError('Only caregivers can remove safe zones');
    }
    const { searchParams } = new URL(request.url);
    const zoneId = searchParams.get('zoneId');
    if (!zoneId) {
      throw new BadRequestError('zoneId query parameter is required');
    }

    const updated = await prisma.safeZone.updateMany({
      where: { id: zoneId, patientId: params.patientId, isActive: true },
      data: { isActive: false },
    });

    if (updated.count === 0) {
      throw new NotFoundError('Safe zone not found');
    }

    await AuditService.log({
      userId: user.id,
      action: 'DELETE_SAFE_ZONE',
      resource: 'SafeZone',
      resourceId: zoneId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Safety DELETE');
  }
}
