import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/services/audit.service';
import { BadRequestError, NotFoundError, handleApiError } from '@/lib/api-errors';

/**
 * Prescription Management API (Clinician-Controlled per SMRITI v1.0 Section 3.2 & Decision Record #7).
 * Caregivers manage daily routines, reminders, and pill photographs without altering clinical treatment.
 */
export async function POST(request: Request, { params }: { params: { patientId: string } }) {
  try {
    const { user } = await RBAC.requirePatientAccess(params.patientId, ['CLINICIAN'], 'edit_clinical');
    const body = await request.json();

    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
    const dosage = typeof body.dosage === 'string' ? body.dosage.trim().slice(0, 80) : '';
    const frequency = typeof body.frequency === 'string' && body.frequency.trim()
      ? body.frequency.trim().slice(0, 80)
      : 'Once daily';
    const time = typeof body.time === 'string' && /^\d{2}:\d{2}$/.test(body.time.trim())
      ? body.time.trim()
      : null;
    const instructions = typeof body.instructions === 'string' && body.instructions.trim()
      ? body.instructions.trim().slice(0, 400)
      : null;

    if (!name || !dosage) {
      throw new BadRequestError('Medication name and dosage are required');
    }

    const medication = await prisma.medication.create({
      data: {
        patientId: params.patientId,
        clinicianId: user.profileId,
        name,
        dosage,
        frequency,
        time,
        instructions,
        status: 'ACTIVE',
      },
    });

    await AuditService.log({
      userId: user.id,
      action: 'CREATE_MEDICATION_PRESCRIPTION',
      resource: 'Medication',
      resourceId: medication.id,
      newValue: `${name} (${dosage})`,
    });

    return NextResponse.json({ success: true, medication }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Medications Manage POST');
  }
}

export async function PATCH(request: Request, { params }: { params: { patientId: string } }) {
  try {
    const { user } = await RBAC.requirePatientAccess(params.patientId, ['CLINICIAN'], 'edit_clinical');
    const body = await request.json();

    const medicationId = typeof body.medicationId === 'string' ? body.medicationId.trim() : '';
    if (!medicationId) {
      throw new BadRequestError('medicationId is required');
    }

    const existing = await prisma.medication.findFirst({
      where: { id: medicationId, patientId: params.patientId },
    });

    if (!existing) {
      throw new NotFoundError('Medication not found for this patient');
    }

    const data: {
      status?: string;
      name?: string;
      dosage?: string;
      frequency?: string;
      time?: string | null;
      instructions?: string | null;
    } = {};

    if (typeof body.status === 'string') {
      const normalizedStatus = body.status.toUpperCase();
      if (!['ACTIVE', 'DISCONTINUED'].includes(normalizedStatus)) {
        throw new BadRequestError('Status must be ACTIVE or DISCONTINUED');
      }
      data.status = normalizedStatus;
    }

    if (typeof body.name === 'string' && body.name.trim()) {
      data.name = body.name.trim().slice(0, 120);
    }
    if (typeof body.dosage === 'string' && body.dosage.trim()) {
      data.dosage = body.dosage.trim().slice(0, 80);
    }
    if (typeof body.frequency === 'string' && body.frequency.trim()) {
      data.frequency = body.frequency.trim().slice(0, 80);
    }
    if (body.time !== undefined) {
      if (body.time === null || body.time === '') {
        data.time = null;
      } else if (typeof body.time === 'string' && /^\d{2}:\d{2}$/.test(body.time.trim())) {
        data.time = body.time.trim();
      } else {
        throw new BadRequestError('time must match HH:MM');
      }
    }
    if (body.instructions !== undefined) {
      data.instructions = typeof body.instructions === 'string' && body.instructions.trim()
        ? body.instructions.trim().slice(0, 400)
        : null;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestError('No valid fields supplied to update');
    }

    const medication = await prisma.medication.update({
      where: { id: existing.id },
      data,
    });

    await AuditService.log({
      userId: user.id,
      action: 'UPDATE_MEDICATION_PRESCRIPTION',
      resource: 'Medication',
      resourceId: medication.id,
      prevValue: `${existing.status} ${existing.name} ${existing.dosage}`,
      newValue: `${medication.status} ${medication.name} ${medication.dosage}`,
    });

    return NextResponse.json({ success: true, medication });
  } catch (error) {
    return handleApiError(error, 'Medications Manage PATCH');
  }
}
