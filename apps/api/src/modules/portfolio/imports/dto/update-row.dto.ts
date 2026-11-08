import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** The only per-row user action this phase supports: force-importing a SKIP row despite its probable-duplicate flag. Full merge/link-as-program-relationship (the other FLOW-A exception options) need Program/a merge workflow — deferred, see docs/DECISIONS.md. */
export class UpdateImportRowDto {
  @ApiProperty()
  @IsBoolean()
  forceCreate!: boolean;
}
