import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { TimelineService } from '@/services/timeline.service';
import { handleApiError } from '@/lib/api-errors';

export async function GET(
  request: Request,
  { params }: { params: { patientId: string } }
) {
  try {
    await RBAC.requirePatientAccess(params.patientId, ['PATIENT', 'CAREGIVER', 'CLINICIAN'], 'view_clinical');

    const { searchParams } = new URL(request.url);
    const rawLimit = Number(searchParams.get('limit') || 50);
    const limit = Number.isFinite(rawLimit) ? Math.min(200, Math.max(1, Math.round(rawLimit))) : 50;

    const timeline = await TimelineService.getUnifiedTimeline(params.patientId, limit);
    return NextResponse.json({ success: true, timeline });
  } catch (error) {
    return handleApiError(error, 'Timeline GET');
  }
}
