import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { CognitiveService } from '@/services/cognitive.service';
import { BadRequestError, handleApiError } from '@/lib/api-errors';

export async function POST(
  request: Request,
  { params }: { params: { patientId: string } }
) {
  try {
    const { user } = await RBAC.requirePatientAccess(params.patientId, ['PATIENT', 'CAREGIVER', 'CLINICIAN'], 'view_routines');
    const body = await request.json();

    const score = Number(body.score ?? 0);
    const accuracy = Number(body.accuracy ?? 0);
    const errors = Number(body.errors ?? 0);
    const difficultyLevel = Number(body.difficultyLevel ?? 1);
    const reactionTimeMs = body.reactionTimeMs !== undefined ? Number(body.reactionTimeMs) : undefined;

    if (!Number.isFinite(score) || score < 0) {
      throw new BadRequestError('Invalid score value');
    }
    if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 1) {
      throw new BadRequestError('Accuracy must be between 0 and 1');
    }
    if (!Number.isFinite(errors) || errors < 0) {
      throw new BadRequestError('Invalid errors count');
    }
    if (!Number.isFinite(difficultyLevel) || difficultyLevel < 1 || difficultyLevel > 10) {
      throw new BadRequestError('difficultyLevel must be between 1 and 10');
    }

    const result = await CognitiveService.logSession(params.patientId, user.id, {
      gameId: typeof body.gameId === 'string' && body.gameId.trim() ? body.gameId.trim() : 'unknown_game',
      domain: typeof body.domain === 'string' && body.domain.trim() ? body.domain.trim() : 'UNSPECIFIED',
      score: Math.round(score),
      accuracy,
      reactionTimeMs: reactionTimeMs !== undefined && Number.isFinite(reactionTimeMs) ? Math.round(reactionTimeMs) : undefined,
      errors: Math.round(errors),
      difficultyLevel: Math.round(difficultyLevel),
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Cognitive POST');
  }
}

export async function GET(
  request: Request,
  { params }: { params: { patientId: string } }
) {
  try {
    await RBAC.requirePatientAccess(params.patientId, ['PATIENT', 'CAREGIVER', 'CLINICIAN'], 'view_clinical');
    const { searchParams } = new URL(request.url);
    const rawLimit = Number(searchParams.get('limit') || 20);
    const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.round(rawLimit))) : 20;

    const history = await CognitiveService.getHistory(params.patientId, limit);
    return NextResponse.json({ success: true, history });
  } catch (error) {
    return handleApiError(error, 'Cognitive GET');
  }
}
