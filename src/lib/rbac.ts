import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from './prisma';
import { ForbiddenError, UnauthorizedError } from './api-errors';

export type AppRole = 'PATIENT' | 'CAREGIVER' | 'CLINICIAN';

export type PermissionScope =
  | 'view_clinical'
  | 'edit_clinical'
  | 'view_routines'
  | 'edit_routines'
  | 'view_location'
  | 'contribute_memories'
  | 'view_memories'
  | 'view_updates'
  | 'manage_settings';

export interface AuthenticatedUser {
  id: string;
  email?: string | null;
  name?: string | null;
  role: string;
  profileId: string | null;
}

const CAREGIVER_DEFAULT_SCOPES = new Set<PermissionScope>([
  'view_clinical',
  'view_routines',
  'edit_routines',
  'view_location',
  'contribute_memories',
  'view_memories',
  'view_updates',
  'manage_settings',
]);

const CLINICIAN_DEFAULT_SCOPES = new Set<PermissionScope>([
  'view_clinical',
  'edit_clinical',
  'view_routines',
  'view_memories',
  'view_updates',
]);

function parsePermissions(raw: string | null | undefined): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

export class RBAC {
  /**
   * Ensures the caller has an authenticated session and optionally matches allowed roles.
   */
  static async requireSession(allowedRoles?: AppRole[]): Promise<AuthenticatedUser> {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      throw new UnauthorizedError('Unauthorized: No active session found');
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isActive: true, role: true },
    });
    if (!dbUser || !dbUser.isActive) {
      throw new UnauthorizedError('Unauthorized: Account is inactive or removed');
    }

    if (allowedRoles && !allowedRoles.includes(dbUser.role as AppRole)) {
      throw new ForbiddenError(`Forbidden: Requires role ${allowedRoles.join(' or ')}`);
    }

    return session.user;
  }

  /**
   * Validates that the current authenticated session is authorized to access the specified patient profile,
   * optionally enforcing fine-grained CareCircleMember permission scopes.
   */
  static async verifyPatientAccess(
    targetPatientProfileId: string,
    allowedRoles?: AppRole[],
    requiredScope?: PermissionScope
  ): Promise<AuthenticatedUser> {
    if (!targetPatientProfileId) {
      throw new ForbiddenError('Forbidden: Target patient ID is required');
    }

    const user = await RBAC.requireSession(allowedRoles);
    const { role, profileId } = user;

    if (!profileId) {
      throw new ForbiddenError('Forbidden: User profile is not initialized');
    }

    if (role === 'PATIENT') {
      if (profileId !== targetPatientProfileId) {
        throw new ForbiddenError('Forbidden: Patients can only access their own data');
      }
      if (requiredScope === 'edit_clinical') {
        throw new ForbiddenError('Forbidden: Patients cannot modify clinical prescriptions');
      }
      return user;
    }

    if (role === 'CAREGIVER') {
      const [pairing, circle] = await Promise.all([
        prisma.patientCaregiver.findFirst({
          where: {
            caregiverId: profileId,
            patientId: targetPatientProfileId,
            status: 'ACTIVE',
          },
          select: { id: true },
        }),
        prisma.careCircleMember.findFirst({
          where: {
            caregiverId: profileId,
            patientId: targetPatientProfileId,
            status: 'ACTIVE',
          },
          select: { id: true, role: true, permissions: true },
        }),
      ]);

      if (!pairing && !circle) {
        throw new ForbiddenError('Forbidden: Caregiver is not authorized for this patient');
      }

      if (requiredScope === 'edit_clinical') {
        throw new ForbiddenError('Forbidden: Prescriptions require clinician authorization');
      }

      // If accessed exclusively via CareCircleMember (e.g., secondary/family participant), enforce assigned scopes
      if (!pairing && circle) {
        if (requiredScope) {
          const perms = parsePermissions(circle.permissions);
          if (!perms.has(requiredScope)) {
            throw new ForbiddenError(`Forbidden: Missing Care Circle permission "${requiredScope}"`);
          }
        } else if (circle.role === 'FAMILY') {
          const perms = parsePermissions(circle.permissions);
          if (perms.size === 0) {
            throw new ForbiddenError('Forbidden: No permissions assigned to family member');
          }
        }
      } else if (pairing && requiredScope && !CAREGIVER_DEFAULT_SCOPES.has(requiredScope)) {
        throw new ForbiddenError(`Forbidden: Caregiver lacks scope "${requiredScope}"`);
      }

      return user;
    }

    if (role === 'CLINICIAN') {
      const [circle, assignedRx] = await Promise.all([
        prisma.careCircleMember.findFirst({
          where: {
            clinicianId: profileId,
            patientId: targetPatientProfileId,
            status: 'ACTIVE',
          },
          select: { id: true, permissions: true },
        }),
        prisma.medication.findFirst({
          where: {
            clinicianId: profileId,
            patientId: targetPatientProfileId,
          },
          select: { id: true },
        }),
      ]);

      if (!circle && !assignedRx) {
        throw new ForbiddenError('Forbidden: Clinician is not assigned to this patient');
      }

      if (requiredScope) {
        if (circle) {
          const perms = parsePermissions(circle.permissions);
          if (perms.size > 0 && !perms.has(requiredScope) && !CLINICIAN_DEFAULT_SCOPES.has(requiredScope)) {
            throw new ForbiddenError(`Forbidden: Clinician lacks scope "${requiredScope}"`);
          }
        } else if (!CLINICIAN_DEFAULT_SCOPES.has(requiredScope)) {
          throw new ForbiddenError(`Forbidden: Clinician lacks scope "${requiredScope}"`);
        }
      }

      return user;
    }

    throw new ForbiddenError('Forbidden: Unknown role');
  }

  /**
   * Resolves patient access when a route may or may not specify a patientId.
   */
  static async requirePatientAccess(
    targetPatientProfileId?: string,
    allowedRoles?: AppRole[],
    requiredScope?: PermissionScope
  ): Promise<{ user: AuthenticatedUser; patientId: string | null }> {
    const user = await RBAC.requireSession(allowedRoles);

    if (targetPatientProfileId) {
      await RBAC.verifyPatientAccess(targetPatientProfileId, allowedRoles, requiredScope);
      return { user, patientId: targetPatientProfileId };
    }

    if (user.role === 'PATIENT') {
      return { user, patientId: user.profileId };
    }

    if (user.role === 'CAREGIVER' && user.profileId) {
      const pairing = await prisma.patientCaregiver.findFirst({
        where: { caregiverId: user.profileId, status: 'ACTIVE' },
        select: { patientId: true },
        orderBy: { createdAt: 'asc' },
      });
      if (pairing) {
        await RBAC.verifyPatientAccess(pairing.patientId, allowedRoles, requiredScope);
        return { user, patientId: pairing.patientId };
      }
      const circle = await prisma.careCircleMember.findFirst({
        where: { caregiverId: user.profileId, status: 'ACTIVE' },
        select: { patientId: true },
        orderBy: { createdAt: 'asc' },
      });
      if (circle) {
        await RBAC.verifyPatientAccess(circle.patientId, allowedRoles, requiredScope);
        return { user, patientId: circle.patientId };
      }
      return { user, patientId: null };
    }

    if (user.role === 'CLINICIAN' && user.profileId) {
      const circle = await prisma.careCircleMember.findFirst({
        where: { clinicianId: user.profileId, status: 'ACTIVE' },
        select: { patientId: true },
        orderBy: { createdAt: 'asc' },
      });
      if (circle) {
        await RBAC.verifyPatientAccess(circle.patientId, allowedRoles, requiredScope);
        return { user, patientId: circle.patientId };
      }
      return { user, patientId: null };
    }

    return { user, patientId: null };
  }
}
