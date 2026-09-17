import { SetMetadata } from '@nestjs/common';
import type { MembershipRole } from '@revn/db';

export const REQUIRED_ROLES_KEY = 'requiredRoles';

/**
 * Restricts a route to callers whose membership role in the `:tenantId`
 * route param is one of the given roles — see PRD §2.3's MVP capability
 * matrix. Deliberately an explicit allow-list, not a "minimum rank": the
 * matrix's roles aren't a total order (Executive and Manager have different
 * capability *shapes* for the same row, not one strictly above the other),
 * so "at least MANAGER" would misrepresent it. `RoleGuard` is what reads
 * this metadata.
 */
export const RequireRole = (...roles: MembershipRole[]) => SetMetadata(REQUIRED_ROLES_KEY, roles);
