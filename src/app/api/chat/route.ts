import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { TimelineService } from '@/services/timeline.service';
import { MedicationService } from '@/services/medication.service';
import { HydrationService } from '@/services/hydration.service';
import { prisma } from '@/lib/prisma';
import { LANGUAGES } from '@/lib/translations';
import { parseVoiceIntent } from '@/lib/ai/intent-parser';
import { resolveAIProvider, LocalFallbackAIProvider, stripDirectPii } from '@/lib/ai/provider';
import { isWithinRateLimit, recordRateLimitAttempt } from '@/lib/rate-limit';
import { BadRequestError, handleApiError } from '@/lib/api-errors';

interface ChatHistoryItem {
  role: 'user' | 'assistant';
  text: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const requestedPatientId = typeof body.patientId === 'string' ? body.patientId : undefined;
    const { patientId } = await RBAC.requirePatientAccess(requestedPatientId, ['PATIENT', 'CAREGIVER'], 'view_routines');

    const rawMessage = typeof body.message === 'string' ? body.message.trim() : '';
    const langCode = typeof body.lang === 'string' ? body.lang.trim().toLowerCase() : 'en';
    const langMeta = LANGUAGES.find((l) => l.code === langCode);
    const preferredLanguageName = langMeta ? `${langMeta.name} (${langMeta.nativeName})` : 'English';

    if (!rawMessage || rawMessage.length > 1000) {
      throw new BadRequestError('Message must be between 1 and 1000 characters');
    }

    if (!patientId) {
      return NextResponse.json({
        reply: 'Please link a patient profile first so I can help with daily routines and reminders.',
        source: 'local-fallback',
        factGrounded: true,
      });
    }

    const rawHistory = Array.isArray(body.history) ? body.history : [];
    const safeHistory: ChatHistoryItem[] = rawHistory
      .slice(-6)
      .filter(
        (m: unknown): m is ChatHistoryItem =>
          typeof m === 'object' &&
          m !== null &&
          ((m as { role?: string }).role === 'user' || (m as { role?: string }).role === 'assistant') &&
          typeof (m as { text?: unknown }).text === 'string'
      )
      .map((m: ChatHistoryItem) => ({
        role: m.role,
        text: m.text.slice(0, 1000),
      }));

    // Retrieve verified RBAC-scoped context (excluding sensitive notes & PII from outbound LLM calls)
    const [pref, aiConsent, recentEvents, medications, hydTarget, hydSummary, routines, memoriesCount] = await Promise.all([
      prisma.patientPreference.findUnique({ where: { patientId } }),
      prisma.consentRecord.findFirst({
        where: { patientId, scope: 'AI_COMPANION' },
        orderBy: { createdAt: 'desc' },
      }),
      TimelineService.getUnifiedTimeline(patientId, 8),
      MedicationService.getPatientMedications(patientId, false),
      HydrationService.getHydrationTarget(patientId),
      HydrationService.getTodayHydrationSummary(patientId),
      prisma.dailyRoutine.findMany({
        where: { patientId, isActive: true },
        orderBy: { time: 'asc' },
        take: 8,
      }),
      prisma.scrapbookEntry.count({
        where: { patientId, visibilityScope: { not: 'HIDDEN' } },
      }),
    ]);

    const intentResult = parseVoiceIntent(rawMessage);
    const totalWaterMl = hydSummary.totalMl;
    const targetMl = hydTarget.targetMl || 2000;

    // 1. Deterministic permission-checked task answers (100% grounded in verified DB state)
    if (intentResult.intent === 'MEDICATION_STATUS') {
      if (medications.length === 0) {
        return NextResponse.json({
          reply: 'You have no active prescribed medications recorded right now.',
          source: 'verified-record',
          factGrounded: true,
          intent: intentResult,
        });
      }
      const lines = medications.slice(0, 3).map((m) => {
        const takenToday = m.events.some((ev) => ev.action === 'TAKEN');
        return `${m.name} (${m.time || 'daily'}) — ${takenToday ? 'recorded taken today' : 'due / not recorded yet'}`;
      });
      return NextResponse.json({
        reply: `From your care schedule: ${lines.join('; ')}.`,
        source: 'verified-record',
        factGrounded: true,
        intent: intentResult,
      });
    }

    if (intentResult.intent === 'HYDRATION_STATUS') {
      return NextResponse.json({
        reply: `You have logged ${totalWaterMl} ml out of your ${targetMl} ml daily water goal today.`,
        source: 'verified-record',
        factGrounded: true,
        intent: intentResult,
      });
    }

    if (intentResult.intent === 'LOG_WATER') {
      return NextResponse.json({
        reply: `Would you like me to add 1 glass (250 ml) to your ${totalWaterMl} ml total today?`,
        source: 'verified-record',
        factGrounded: true,
        intent: intentResult,
      });
    }

    if (intentResult.intent === 'READ_ROUTINE' || intentResult.intent === 'NEXT_ACTIVITY') {
      if (routines.length === 0 && medications.length === 0) {
        return NextResponse.json({
          reply: 'Your schedule has no pending items left right now. Enjoy a gentle rest or talk about a family memory.',
          source: 'verified-record',
          factGrounded: true,
          intent: intentResult,
        });
      }
      const summary = [
        ...routines.slice(0, 4).map((r) => `${r.time} ${r.title}`),
        ...medications.slice(0, 2).map((m) => `${m.time || 'Scheduled'} ${m.name}`),
      ].join(', ');
      return NextResponse.json({
        reply: `Your daily routine items: ${summary}.`,
        source: 'verified-record',
        factGrounded: true,
        intent: intentResult,
      });
    }

    if (intentResult.intent === 'SHOW_FAMILY') {
      return NextResponse.json({
        reply: `Opening your Family & Memories book (${memoriesCount} personal saved memories ready).`,
        source: 'verified-record',
        factGrounded: true,
        intent: intentResult,
      });
    }

    if (intentResult.intent === 'PLAY_GAME') {
      return NextResponse.json({
        reply: 'Let us open your gentle cognitive activities.',
        source: 'verified-record',
        factGrounded: true,
        intent: intentResult,
      });
    }

    if (intentResult.intent === 'CALL_FAMILY') {
      return NextResponse.json({
        reply: 'I opened your family contact list. Tap a photo to confirm before calling.',
        source: 'verified-record',
        factGrounded: true,
        intent: intentResult,
      });
    }

    if (intentResult.intent === 'OPEN_CHECK_IN') {
      return NextResponse.json({
        reply: 'Opening your optional wellbeing check-in.',
        source: 'verified-record',
        factGrounded: true,
        intent: intentResult,
      });
    }

    const sanitizedContextLines =
      recentEvents.length > 0
        ? recentEvents
            .filter((e) => e.type !== 'CAREGIVER_REPORT')
            .map((e) => `- ${new Date(e.date).toLocaleTimeString()}: ${e.title} - ${stripDirectPii(e.description)}`)
            .join('\n') || '- Only routine summaries available.'
        : '- No recent activity recorded today.';

    const verifiedFallbackReply =
      'Hello! I am Smriti, your daily companion. I can read your routine, check today’s water or medicine log, open family memories, or start a gentle game.';

    const aiConsentDenied = (aiConsent && !aiConsent.granted) || pref?.aiEnabled === false;
    const chatRateKey = `ai-chat:${patientId}`;
    const withinAiQuota = isWithinRateLimit(chatRateKey, 20);
    if (!aiConsentDenied && withinAiQuota) {
      recordRateLimitAttempt(chatRateKey, 10 * 60 * 1000);
    }
    const provider =
      aiConsentDenied || !withinAiQuota ? new LocalFallbackAIProvider() : resolveAIProvider();

    const aiResult = await provider.generateReply({
      message: rawMessage,
      history: safeHistory,
      preferredLanguageName,
      interactionStyle: (pref?.aiInteractionStyle as 'CONVERSATIONAL' | 'TASK_FOCUSED' | 'BALANCED') || 'BALANCED',
      sanitizedContextLines,
      totalWaterMl,
      hydrationTargetMl: targetMl,
      verifiedFallbackReply,
    });

    return NextResponse.json({
      reply: aiResult.reply,
      source: aiResult.source,
      factGrounded: aiResult.factGrounded,
      intent: intentResult,
    });
  } catch (error) {
    return handleApiError(error, 'Chat POST');
  }
}
