import { AuditActionType } from '../audit-actions.constants';

export interface AuditEntryData {
    actorId: string | null;
    actorRole: string | null;

    entityType: string;
    entityId: string;

    action: AuditActionType;

    beforeState?: Record<string, unknown> | null;
    afterState?: Record<string, unknown> | null;

    metadata?: Record<string, unknown> | null;
}