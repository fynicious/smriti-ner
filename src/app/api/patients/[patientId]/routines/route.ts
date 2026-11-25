import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { getLocalDateString } from '@/lib/dateUtils';
import { storeEncryptedMediaFromDataUri } from '@/lib/media-storage';
import { BadRequestError, handleApiError } from '@/lib/api-errors';

export async function GET(request: Request, { params }: { params: { patientId: string } }) {
  try {
    await RBAC.requirePatientAccess(params.patientId, ['PATIENT', 'CAREGIVER', 'CLINICIAN'], 'view_routines');
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || getLocalDateString();

    const [routines, occurrences, voiceReminders] = await Promise.all([
      prisma.dailyRoutine.findMany({
        where: { patientId: params.patientId, isActive: true },
        orderBy: { time: 'asc' },
      }),
      prisma.routineOccurrence.findMany({
        where: { patientId: params.patientId, date },
      }),
      prisma.voiceReminder.findMany({
        where: { patientId: params.patientId, isActive: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const resolvedVoices = voiceReminders.map((v) => ({
      ...v,
      audioBase64: v.mediaAssetId ? `/api/patients/${params.patientId}/media/${v.mediaAssetId}` : v.audioBase64,
    }));

    return NextResponse.json({ success: true, date, routines, occurrences, voiceReminders: resolvedVoices });
  } catch (error) {
    return handleApiError(error, 'Routines GET');
  }
}

export async function POST(request: Request, { params }: { params: { patientId: string } }) {
  try {
    const { user } = await RBAC.requirePatientAccess(params.patientId, ['PATIENT', 'CAREGIVER'], 'view_routines');
    const body = await request.json();

    if (body.kind === 'OCCURRENCE_STATUS') {
      const routineId = typeof body.routineId === 'string' ? body.routineId : '';
      const date = typeof body.date === 'string' ? body.date : getLocalDateString();
      const status = typeof body.status === 'string' ? body.status : 'completed';

      if (!routineId || !['pending', 'completed', 'snoozed', 'missed'].includes(status)) {
        throw new BadRequestError('Valid routineId and status required');
      }

      const occ = await prisma.routineOccurrence.upsert({
        where: { routineId_date: { routineId, date } },
        update: {
          status,
          completedAt: status === 'completed' ? new Date() : null,
          completedBy: user.name || user.role,
        },
        create: {
          routineId,
          patientId: params.patientId,
          date,
          status,
          completedAt: status === 'completed' ? new Date() : null,
          completedBy: user.name || user.role,
        },
      });
      return NextResponse.json({ success: true, occurrence: occ }, { status: 201 });
    }

    await RBAC.verifyPatientAccess(params.patientId, ['CAREGIVER'], 'edit_routines');

    if (body.kind === 'VOICE_REMINDER') {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      const rawAudio = typeof body.audioBase64 === 'string' ? body.audioBase64 : '';
      if (!title || !rawAudio || rawAudio.length > 4_000_000) {
        throw new BadRequestError('Valid title and audio recording (<3MB) are required');
      }

      let mediaAssetId: string | null = null;
      let storedAudioRef = rawAudio;
      if (rawAudio.startsWith('data:')) {
        const stored = await storeEncryptedMediaFromDataUri({
          patientId: params.patientId,
          uploadedByUserId: user.id,
          category: 'VOICE_REMINDER',
          dataUri: rawAudio,
        });
        if (stored) {
          mediaAssetId = stored.mediaAssetId;
          storedAudioRef = stored.url;
        }
      }

      const reminder = await prisma.voiceReminder.create({
        data: {
          patientId: params.patientId,
          routineType: typeof body.routineType === 'string' ? body.routineType : 'custom',
          title,
          time: typeof body.time === 'string' ? body.time : '09:00',
          speakerName: typeof body.speakerName === 'string' ? body.speakerName : 'Caregiver',
          audioBase64: storedAudioRef,
          mediaAssetId,
          isActive: true,
        },
      });
      return NextResponse.json({ success: true, voiceReminder: reminder }, { status: 201 });
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const time = typeof body.time === 'string' ? body.time.trim() : '';
    if (!title || !/^\d{2}:\d{2}$/.test(time)) {
      throw new BadRequestError('Title and HH:MM time are required');
    }

    let voiceReminderId: string | null = null;
    if (typeof body.audioBase64 === 'string' && body.audioBase64.length > 0 && body.audioBase64.length <= 4_000_000) {
      let mediaAssetId: string | null = null;
      let storedAudioRef = body.audioBase64;
      if (body.audioBase64.startsWith('data:')) {
        const stored = await storeEncryptedMediaFromDataUri({
          patientId: params.patientId,
          uploadedByUserId: user.id,
          category: 'VOICE_REMINDER',
          dataUri: body.audioBase64,
        });
        if (stored) {
          mediaAssetId = stored.mediaAssetId;
          storedAudioRef = stored.url;
        }
      }

      const vr = await prisma.voiceReminder.create({
        data: {
          patientId: params.patientId,
          routineType: String(body.category || 'custom').toLowerCase(),
          title,
          time,
          speakerName: user.name || 'Caregiver',
          audioBase64: storedAudioRef,
          mediaAssetId,
          isActive: true,
        },
      });
      voiceReminderId = vr.id;
    }

    const routine = await prisma.dailyRoutine.create({
      data: {
        patientId: params.patientId,
        category: typeof body.category === 'string' ? body.category : 'CUSTOM',
        title,
        time,
        iconEmoji: typeof body.iconEmoji === 'string' ? body.iconEmoji : '✨',
        color: typeof body.color === 'string' ? body.color : 'bg-slate-500',
        assignedTo: typeof body.assignedTo === 'string' && body.assignedTo ? body.assignedTo : null,
        voiceReminderId,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, routine }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Routines POST');
  }
}

export async function DELETE(request: Request, { params }: { params: { patientId: string } }) {
  try {
    await RBAC.requirePatientAccess(params.patientId, ['CAREGIVER'], 'edit_routines');
    const { searchParams } = new URL(request.url);
    const routineId = searchParams.get('routineId');
    if (!routineId) {
      throw new BadRequestError('routineId is required');
    }

    await prisma.dailyRoutine.updateMany({
      where: { id: routineId, patientId: params.patientId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Routines DELETE');
  }
}
