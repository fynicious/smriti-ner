import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { BadRequestError, handleApiError } from '@/lib/api-errors';

interface GameLogInput {
  avgTimePerMove?: number;
  errors?: number;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const requestedPatientId = typeof body.patientId === 'string' ? body.patientId : undefined;
    const { patientId } = await RBAC.requirePatientAccess(requestedPatientId, ['PATIENT', 'CAREGIVER', 'CLINICIAN']);

    let recentGames: GameLogInput[] = [];
    let medicationAdherence: number | null =
      typeof body.medicationAdherence === 'number' && Number.isFinite(body.medicationAdherence)
        ? Math.min(100, Math.max(0, body.medicationAdherence))
        : null;

    if (Array.isArray(body.gameLogs) && body.gameLogs.length > 0) {
      recentGames = body.gameLogs.slice(0, 20).map((g: unknown) => {
        const item = typeof g === 'object' && g !== null ? (g as GameLogInput) : {};
        return {
          avgTimePerMove: Number(item.avgTimePerMove) || 0,
          errors: Number(item.errors) || 0,
        };
      });
    } else if (patientId) {
      const dbSessions = await prisma.cognitiveSession.findMany({
        where: { patientId },
        orderBy: { completedAt: 'desc' },
        take: 10,
      });
      recentGames = dbSessions.map((s) => ({
        avgTimePerMove: s.reactionTimeMs ? s.reactionTimeMs / 1000 : 0,
        errors: s.errors,
      }));

      if (medicationAdherence === null) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentMeds = await prisma.medicationEvent.findMany({
          where: { patientId, scheduledTime: { gte: sevenDaysAgo }, status: 'ACTIVE' },
        });
        if (recentMeds.length > 0) {
          const takenCount = recentMeds.filter((m) => m.action === 'TAKEN').length;
          medicationAdherence = Math.round((takenCount / recentMeds.length) * 100);
        }
      }
    }

    if (recentGames.length === 0 && medicationAdherence === null) {
      return NextResponse.json({
        riskScore: null,
        riskLevel: 'Insufficient Data',
        explanations: ['No recorded cognitive sessions or medication adherence logs available yet.'],
        disclaimer: 'Rule-based engagement indicator only. Not a clinical or dementia diagnosis.',
      });
    }

    if (recentGames.some((g) => (g.avgTimePerMove ?? 0) < 0 || (g.errors ?? 0) < 0)) {
      throw new BadRequestError('Game log metrics cannot be negative');
    }

    let indicatorScore = 0;
    const explanations: string[] = [];

    if (recentGames.length > 0) {
      const avgTime =
        recentGames.reduce((acc, log) => acc + (log.avgTimePerMove || 0), 0) / recentGames.length;
      if (avgTime > 15) {
        indicatorScore += 35;
        explanations.push(`Slower response pace observed: average ${avgTime.toFixed(1)}s per move across ${recentGames.length} recent session(s).`);
      } else if (avgTime > 10) {
        indicatorScore += 18;
        explanations.push(`Moderate response pace: average ${avgTime.toFixed(1)}s per move across ${recentGames.length} recent session(s).`);
      }

      const totalErrors = recentGames.reduce((acc, log) => acc + (log.errors || 0), 0);
      const avgErrors = totalErrors / recentGames.length;
      if (avgErrors > 4) {
        indicatorScore += 30;
        explanations.push(`Elevated exercise error rate: ${avgErrors.toFixed(1)} average errors per session.`);
      } else if (avgErrors > 2) {
        indicatorScore += 15;
        explanations.push(`Mild exercise difficulty: ${avgErrors.toFixed(1)} average errors per session.`);
      }
    }

    if (medicationAdherence !== null && medicationAdherence < 70) {
      indicatorScore += 25;
      explanations.push(`Low logged medication adherence (${medicationAdherence}% over recent window).`);
    }

    const finalScore = Math.min(100, Math.max(0, indicatorScore));

    return NextResponse.json({
      riskScore: finalScore,
      riskLevel: finalScore > 65 ? 'High Attention Needed' : finalScore > 30 ? 'Moderate' : 'Low',
      explanations:
        explanations.length > 0
          ? explanations
          : ['Consistent engagement and response pace across recent recorded sessions.'],
      disclaimer: 'Rule-based engagement indicator only. Not a clinical or dementia diagnosis.',
    });
  } catch (error) {
    return handleApiError(error, 'Predict POST');
  }
}
