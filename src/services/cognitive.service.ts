import { prisma } from '@/lib/prisma';
import { AuditService } from './audit.service';

export class CognitiveService {
  /**
   * Log a new cognitive session and adaptively recalculate the recommended difficulty.
   */
  static async logSession(
    patientId: string, 
    userId: string,
    data: {
      gameId: string;
      domain: string;
      score: number;
      accuracy: number;
      reactionTimeMs?: number;
      errors: number;
      difficultyLevel: number;
    }
  ) {
    const session = await prisma.cognitiveSession.create({
      data: {
        patientId,
        gameId: data.gameId,
        domain: data.domain,
        difficultyLevel: data.difficultyLevel,
        score: data.score,
        accuracy: data.accuracy,
        reactionTimeMs: data.reactionTimeMs,
        errors: data.errors,
      }
    });

    await AuditService.log({
      userId,
      action: 'CREATE',
      resource: 'COGNITIVE_SESSION',
      resourceId: session.id,
      newValue: JSON.stringify({ domain: data.domain, score: data.score })
    });

    // Adaptive Engine Logic: Determine if baseline difficulty needs shifting
    // E.g., if accuracy > 0.9 and errors == 0 on the last 3 sessions, suggest difficulty + 1
    const recentSessions = await prisma.cognitiveSession.findMany({
      where: { patientId, domain: data.domain },
      orderBy: { completedAt: 'desc' },
      take: 3
    });

    let recommendedDifficultyShift = 0;
    if (recentSessions.length === 3) {
      const avgAccuracy = recentSessions.reduce((acc, s) => acc + s.accuracy, 0) / 3;
      if (avgAccuracy > 0.90) {
        recommendedDifficultyShift = 1;
      } else if (avgAccuracy < 0.50) {
        recommendedDifficultyShift = -1;
      }
    }

    return { session, recommendedDifficultyShift };
  }

  static async getHistory(patientId: string, limit = 10) {
    return prisma.cognitiveSession.findMany({
      where: { patientId },
      orderBy: { completedAt: 'desc' },
      take: limit
    });
  }
}
