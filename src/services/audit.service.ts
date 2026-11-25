import { prisma } from '@/lib/prisma';

export class AuditService {
  /**
   * Logs an action securely to the database to maintain compliance and traceability.
   */
  static async log(params: {
    userId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    prevValue?: string;
    newValue?: string;
  }) {
    try {
      await prisma.auditLog.create({
        data: {
          userId: params.userId || null,
          action: params.action,
          resource: params.resource,
          resourceId: params.resourceId || null,
          prevValue: params.prevValue || null,
          newValue: params.newValue || null,
        }
      });
    } catch (e) {
      console.error('Failed to write audit log:', e);
      // We don't necessarily want to crash the main request if audit logging fails,
      // but in strict environments, you might throw here.
    }
  }
}
