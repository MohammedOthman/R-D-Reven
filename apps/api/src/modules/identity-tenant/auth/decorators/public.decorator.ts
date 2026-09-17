import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Opts a route out of the global auth guard. Deny-by-default (PRD §2.2) — every route requires a valid session unless explicitly marked with this. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
