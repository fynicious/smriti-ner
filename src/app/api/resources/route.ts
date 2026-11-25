import { NextResponse } from 'next/server';
import { RBAC } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { BadRequestError, NotFoundError, handleApiError } from '@/lib/api-errors';

interface ResourceSeedEntry {
  name: string;
  category: string;
  description: string;
  state: string;
  district: string;
  locality: string;
  address: string;
  phone: string;
  emergencyPhone?: string;
  openingHours: string;
  verificationStatus: string;
  telehealthAvailable: boolean;
  homeVisitAvailable: boolean;
}

const VERIFIED_NER_RESOURCES: ResourceSeedEntry[] = [
  {
    name: 'National Emergency Response Service (112)',
    category: 'EMERGENCY',
    description: '24/7 unified police, fire, and medical emergency response across North East India.',
    state: 'Assam & NER',
    district: 'Regional',
    locality: 'All Districts',
    address: 'Unified Emergency Dispatch Center, India',
    phone: '112',
    emergencyPhone: '112',
    openingHours: '24 Hours',
    verificationStatus: 'VERIFIED',
    telehealthAvailable: false,
    homeVisitAvailable: true,
  },
  {
    name: '108 Mrityunjoy Emergency Ambulance Service',
    category: 'EMERGENCY',
    description: 'Free 24/7 emergency ambulance and paramedic transport across Assam & NER states.',
    state: 'Assam',
    district: 'Kamrup Metro',
    locality: 'Guwahati',
    address: 'NHM Assam Emergency Dispatch, Christian Basti, Guwahati',
    phone: '108',
    emergencyPhone: '108',
    openingHours: '24 Hours',
    verificationStatus: 'VERIFIED',
    telehealthAvailable: false,
    homeVisitAvailable: true,
  },
  {
    name: 'Elder Line - National Senior Citizen Helpline',
    category: 'SUPPORT',
    description: 'Free national helpline for elderly safety, caregiver guidance, legal/pension support, and distress aid.',
    state: 'All NER',
    district: 'Regional',
    locality: 'Toll-Free Helpline',
    address: 'Ministry of Social Justice & Empowerment Helpline Network',
    phone: '14567',
    emergencyPhone: '14567',
    openingHours: '08:00 AM - 08:00 PM Daily',
    verificationStatus: 'VERIFIED',
    telehealthAvailable: true,
    homeVisitAvailable: false,
  },
  {
    name: 'Tele-MANAS Mental Health & Dementia Support',
    category: 'SUPPORT',
    description: 'Government of India 24/7 telemental health helpline with regional language counselors.',
    state: 'All NER',
    district: 'Regional',
    locality: '24/7 Helpline',
    address: 'National Tele Mental Health Programme (NER Cell)',
    phone: '14416',
    emergencyPhone: '18008914416',
    openingHours: '24 Hours',
    verificationStatus: 'VERIFIED',
    telehealthAvailable: true,
    homeVisitAvailable: false,
  },
  {
    name: 'Gauhati Medical College & Hospital (GMCH) - Neurology & Geriatrics',
    category: 'HOSPITAL',
    description: 'Tertiary government hospital offering neurology OPD, memory evaluation, and emergency care.',
    state: 'Assam',
    district: 'Kamrup Metro',
    locality: 'Bhangagarh',
    address: 'Narakasur Hilltop, Bhangagarh, Guwahati, Assam 781032',
    phone: '0361-2529457',
    emergencyPhone: '108',
    openingHours: '24 Hours (OPD 08:00 AM - 02:00 PM)',
    verificationStatus: 'VERIFIED',
    telehealthAvailable: false,
    homeVisitAvailable: false,
  },
  {
    name: 'LGB Regional Institute of Mental Health (LGBRIMH)',
    category: 'HOSPITAL',
    description: 'Premier autonomous neuropsychiatry and geriatric cognitive care institute in Assam.',
    state: 'Assam',
    district: 'Sonitpur',
    locality: 'Tezpur',
    address: 'Kalibari Road, Tezpur, Assam 784001',
    phone: '03712-232652',
    emergencyPhone: '14416',
    openingHours: 'Mon-Sat 08:30 AM - 04:00 PM (Emergency 24x7)',
    verificationStatus: 'VERIFIED',
    telehealthAvailable: true,
    homeVisitAvailable: false,
  },
  {
    name: 'NEIGRIHMS - North Eastern Indira Gandhi Regional Institute',
    category: 'HOSPITAL',
    description: 'Regional super-specialty hospital serving Meghalaya and North East India.',
    state: 'Meghalaya',
    district: 'East Khasi Hills',
    locality: 'Mawdiangdiang',
    address: 'Mawdiangdiang, Shillong, Meghalaya 793018',
    phone: '0364-2538013',
    emergencyPhone: '108',
    openingHours: '24 Hours (OPD Mon-Sat 08:00 AM - 01:00 PM)',
    verificationStatus: 'VERIFIED',
    telehealthAvailable: false,
    homeVisitAvailable: false,
  },
  {
    name: 'RIMS - Regional Institute of Medical Sciences, Imphal',
    category: 'HOSPITAL',
    description: 'Regional neurology, psychiatry, and elderly outpatient center for Manipur.',
    state: 'Manipur',
    district: 'Imphal West',
    locality: 'Lamphelpat',
    address: 'Lamphelpat, Imphal, Manipur 795004',
    phone: '0385-2414720',
    emergencyPhone: '112',
    openingHours: '24 Hours Emergency',
    verificationStatus: 'VERIFIED',
    telehealthAvailable: false,
    homeVisitAvailable: false,
  },
  {
    name: 'ARDSI Guwahati Chapter (Dementia Care & Support)',
    category: 'NGO',
    description: 'Alzheimer’s and Related Disorders Society of India chapter offering family counseling and daycare guidance.',
    state: 'Assam',
    district: 'Kamrup Metro',
    locality: 'Zoo Road',
    address: 'RG Baruah Road, Guwahati, Assam 781024',
    phone: '14567',
    emergencyPhone: '112',
    openingHours: 'Mon-Fri 10:00 AM - 05:00 PM',
    verificationStatus: 'COMMUNITY_REPORTED',
    telehealthAvailable: true,
    homeVisitAvailable: true,
  },
  {
    name: 'Pradhan Mantri Bhartiya Janaushadhi Kendra - Bhangagarh',
    category: 'PHARMACY',
    description: 'Affordable generic medicines and blood pressure/diabetes monitoring near GMCH.',
    state: 'Assam',
    district: 'Kamrup Metro',
    locality: 'Bhangagarh',
    address: 'GS Road, Near GMCH Gate, Guwahati, Assam 781032',
    phone: '18001808080',
    openingHours: '08:00 AM - 10:00 PM Daily',
    verificationStatus: 'VERIFIED',
    telehealthAvailable: false,
    homeVisitAvailable: false,
  },
];

let resourcesSeeded = false;

async function ensureResourcesSeeded() {
  if (resourcesSeeded) return;
  for (const item of VERIFIED_NER_RESOURCES) {
    await prisma.localResource.upsert({
      where: {
        name_district: {
          name: item.name,
          district: item.district,
        },
      },
      update: {},
      create: item,
    });
  }
  resourcesSeeded = true;
}

export async function GET(request: Request) {
  try {
    const user = await RBAC.requireSession(['PATIENT', 'CAREGIVER', 'CLINICIAN']);
    await ensureResourcesSeeded();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category')?.trim().toUpperCase();
    const state = searchParams.get('state')?.trim();
    const q = searchParams.get('q')?.trim();
    const requestedPatientId = searchParams.get('patientId') || undefined;

    const where: {
      category?: string;
      state?: { contains: string };
      OR?: Array<{
        name?: { contains: string };
        locality?: { contains: string };
        district?: { contains: string };
        description?: { contains: string };
      }>;
    } = {};

    if (category && category !== 'ALL') {
      where.category = category;
    }
    if (state && state !== 'ALL') {
      where.state = { contains: state };
    }
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { locality: { contains: q } },
        { district: { contains: q } },
        { description: { contains: q } },
      ];
    }

    const resources = await prisma.localResource.findMany({
      where,
      orderBy: [{ verificationStatus: 'desc' }, { category: 'asc' }, { name: 'asc' }],
    });

    let savedResourceIds: string[] = [];
    let resolvedPatientId: string | null = null;
    if (requestedPatientId || user.role === 'PATIENT') {
      const access = await RBAC.requirePatientAccess(requestedPatientId, ['PATIENT', 'CAREGIVER', 'CLINICIAN']);
      resolvedPatientId = access.patientId;
      if (resolvedPatientId) {
        const saved = await prisma.savedResource.findMany({
          where: { patientId: resolvedPatientId },
          select: { resourceId: true },
        });
        savedResourceIds = saved.map((s) => s.resourceId);
      }
    }

    return NextResponse.json({
      success: true,
      patientId: resolvedPatientId,
      resources,
      savedResourceIds,
    });
  } catch (error) {
    return handleApiError(error, 'Resources GET');
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const requestedPatientId = typeof body.patientId === 'string' ? body.patientId : undefined;
    const { patientId } = await RBAC.requirePatientAccess(requestedPatientId, ['PATIENT', 'CAREGIVER']);

    if (!patientId) {
      throw new BadRequestError('An active paired patient is required to bookmark resources');
    }

    const resourceId = typeof body.resourceId === 'string' ? body.resourceId.trim() : '';
    if (!resourceId) {
      throw new BadRequestError('resourceId is required');
    }

    const resourceExists = await prisma.localResource.findUnique({
      where: { id: resourceId },
      select: { id: true },
    });
    if (!resourceExists) {
      throw new NotFoundError('Resource not found');
    }

    const existing = await prisma.savedResource.findUnique({
      where: {
        patientId_resourceId: { patientId, resourceId },
      },
    });

    if (existing) {
      await prisma.savedResource.delete({ where: { id: existing.id } });
      return NextResponse.json({ success: true, saved: false, resourceId });
    }

    const created = await prisma.savedResource.create({
      data: {
        patientId,
        resourceId,
        notes: typeof body.notes === 'string' ? body.notes.trim().slice(0, 300) : null,
      },
    });

    return NextResponse.json({ success: true, saved: true, resourceId: created.resourceId }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Resources POST');
  }
}
