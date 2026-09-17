import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  PayloadTooLargeException,
  Post,
  Req,
  Res,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ImportsService } from './imports.service';
import { SetMappingDto } from './dto/set-mapping.dto';
import { UpdateImportRowDto } from './dto/update-row.dto';
import { RoleGuard } from '../../identity-tenant/tenants/guards/role.guard';
import { RequireRole } from '../../identity-tenant/tenants/decorators/require-role.decorator';
import { CurrentUser } from '../../identity-tenant/auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../identity-tenant/auth/jwt-payload.type';

// S03's own screen-actor line names "Admin" specifically (narrower than
// FLOW-A's broader "Tenant Admin and Partnership Manager," which covers the
// whole golden workflow including the later manual-activation step Managers
// already do through the existing Partnership UI) — see docs/DECISIONS.md.
const WRITE_ROLES = ['OWNER', 'ADMIN'] as const;
// Batch visibility follows "Portfolio read," same as Partner/Partnership.
const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'] as const;

@ApiTags('imports')
@Controller('tenants/:tenantId/imports')
@UseGuards(RoleGuard)
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Get()
  @RequireRole(...READ_ROLES)
  @ApiOperation({ summary: 'List CSV import batches for this organization.' })
  async list(@Param('tenantId') tenantId: string) {
    const batches = await this.importsService.list(tenantId);
    return { batches };
  }

  @Get(':batchId')
  @RequireRole(...READ_ROLES)
  @ApiOperation({ summary: 'Get an import batch with its staged rows.' })
  async get(@Param('tenantId') tenantId: string, @Param('batchId') batchId: string) {
    const batch = await this.importsService.get(tenantId, batchId);
    return { batch };
  }

  @Post()
  @RequireRole(...WRITE_ROLES)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      'Upload a CSV file and create a staging batch (IMP-01/02) — multipart/form-data, field name "file".',
  })
  async upload(
    @Param('tenantId') tenantId: string,
    @Req() request: FastifyRequest,
    @CurrentUser() claims: JwtPayload,
  ) {
    const data = await request.file();
    if (!data) {
      throw new UnprocessableEntityException('No file was uploaded.');
    }
    const buffer = await data.toBuffer();
    if (data.file.truncated) {
      throw new PayloadTooLargeException('This file is larger than the upload limit.');
    }

    const batch = await this.importsService.upload(
      tenantId,
      { filename: data.filename, mimetype: data.mimetype, buffer },
      claims.sub,
    );
    return { batch };
  }

  @Patch(':batchId/mapping')
  @RequireRole(...WRITE_ROLES)
  @ApiOperation({
    summary:
      'Set the source-column-to-field mapping and recompute the create/update/skip/reject preview (IMP-03/04/05/06).',
  })
  async setMapping(
    @Param('tenantId') tenantId: string,
    @Param('batchId') batchId: string,
    @Body() dto: SetMappingDto,
  ) {
    const batch = await this.importsService.setMapping(tenantId, batchId, dto);
    return { batch };
  }

  @Patch(':batchId/rows/:rowId')
  @RequireRole(...WRITE_ROLES)
  @ApiOperation({ summary: 'Force-import a skipped (probable-duplicate) row anyway.' })
  async updateRow(
    @Param('tenantId') tenantId: string,
    @Param('batchId') batchId: string,
    @Param('rowId') rowId: string,
    @Body() dto: UpdateImportRowDto,
  ) {
    await this.importsService.updateRow(tenantId, batchId, rowId, dto.forceCreate);
    const batch = await this.importsService.get(tenantId, batchId);
    return { batch };
  }

  @Post(':batchId/commit')
  @RequireRole(...WRITE_ROLES)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      'Commit the reviewed batch (IMP-07) — idempotent: committing an already-committed batch returns the existing result.',
  })
  async commit(
    @Param('tenantId') tenantId: string,
    @Param('batchId') batchId: string,
    @CurrentUser() claims: JwtPayload,
  ) {
    const batch = await this.importsService.commit(tenantId, batchId, claims.sub);
    return { batch };
  }

  @Get(':batchId/rejected.csv')
  @RequireRole(...READ_ROLES)
  @ApiOperation({
    summary: 'Download rejected rows as CSV (FLOW-A: "rejected rows remain downloadable").',
  })
  async rejectedCsv(
    @Param('tenantId') tenantId: string,
    @Param('batchId') batchId: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const { fileName, csv } = await this.importsService.rejectedCsv(tenantId, batchId);
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
    return csv;
  }
}
