import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/services/audit.service';
import { decryptSensitiveField } from '@/lib/crypto-envelope';
import { BadRequestError, handleApiError } from '@/lib/api-errors';

async function dispatchTwilioSms(params: {
  accountSid: string;
  authToken: string;
  from: string;
  to: string;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  const credentials = Buffer.from(`${params.accountSid}:${params.authToken}`, 'utf8').toString('base64');
  const form = new URLSearchParams({
    To: params.to,
    From: params.from,
    Body: params.body,
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(params.accountSid)}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    }
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { ok: false, error: `Twilio HTTP ${res.status}${errText ? `: ${errText.slice(0, 120)}` : ''}` };
  }
  return { ok: true };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const requestedPatientId = typeof body.patientId === 'string' ? body.patientId : undefined;
    const { user, patientId } = await RBAC.requirePatientAccess(requestedPatientId, ['PATIENT', 'CAREGIVER'], 'view_routines');

    if (!patientId) {
      throw new BadRequestError('No active patient profile associated with this alert');
    }

    const alertType = typeof body.type === 'string' && body.type.trim() ? body.type.trim().slice(0, 40) : 'SOS';
    const customMessage =
      typeof body.message === 'string' && body.message.trim()
        ? body.message.trim().slice(0, 300)
        : `Emergency ${alertType} alert triggered.`;

    const patient = await prisma.patientProfile.findUnique({
      where: { id: patientId },
      include: {
        caregivers: {
          where: { status: 'ACTIVE' },
          include: { caregiver: { select: { userId: true, phoneNumber: true, fullName: true } } },
        },
      },
    });

    const decryptedEmergencyContact = decryptSensitiveField(patient?.emergencyContact, patientId);

    const recipientPhone =
      patient?.caregivers.find((c) => c.caregiver.phoneNumber)?.caregiver.phoneNumber ||
      decryptedEmergencyContact ||
      process.env.CAREGIVER_PHONE_NUMBER ||
      null;

    const caregiverUserIds = patient?.caregivers.map((c) => c.caregiver.userId) || [];
    const registeredPushCount = caregiverUserIds.length > 0
      ? await prisma.pushSubscription.count({ where: { userId: { in: caregiverUserIds } } })
      : 0;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;

    let smsSent = false;
    let smsError: string | null = null;
    if (accountSid && authToken && fromPhone && recipientPhone) {
      try {
        const result = await dispatchTwilioSms({
          accountSid,
          authToken,
          from: fromPhone,
          to: recipientPhone,
          body: `[Smriti ${alertType}] ${patient?.fullName || 'Patient'}: ${customMessage}`,
        });
        smsSent = result.ok;
        smsError = result.error || null;
      } catch (err) {
        smsError = err instanceof Error ? err.message : 'SMS gateway failure';
      }
    }

    // Truthful delivery status (SMRITI v1.0 Section 16 & Decision Record #10)
    const delivered = smsSent;
    const deliveryStatus = smsSent
      ? 'CONFIRMED_SMS'
      : smsError
      ? 'FAILED'
      : 'AUDIT_LOGGED_ONLY';

    await AuditService.log({
      userId: user.id,
      action: `ALERT_${alertType.toUpperCase()}`,
      resource: 'PatientProfile',
      resourceId: patientId,
      newValue: JSON.stringify({
        delivered,
        smsSent,
        registeredPushCount,
        hasRecipient: Boolean(recipientPhone),
        deliveryStatus,
      }),
    });

    return NextResponse.json({
      success: true,
      delivered,
      smsSent,
      pushSent: false,
      registeredPushSubscriptions: registeredPushCount,
      simulated: !delivered,
      deliveryStatus,
      hasEmergencyContact: Boolean(recipientPhone),
      recipientPhone,
      message: smsSent
        ? 'Confirmed: Emergency SMS was dispatched to your caregiver.'
        : smsError
        ? 'Alert was saved, but SMS dispatch failed. Use the Call button below immediately.'
        : 'Alert saved to audit log only — SMS gateway is not active. Tap below to call directly.',
    });
  } catch (error) {
    return handleApiError(error, 'Alert POST');
  }
}
