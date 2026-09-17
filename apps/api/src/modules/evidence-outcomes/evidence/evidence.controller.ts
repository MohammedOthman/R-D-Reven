import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  PayloadTooLargeException,
  Post,
  Query,
  Req,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { EvidenceService } from './evidence.service';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { ReplaceEvidenceDto } from './dto/replace-evidence.dto';
import { MAX_EVIDENCE_FILE_SIZE_BYTES } from '../evidence-outcomes.constants';
import { RoleGuard } from '../../identity-tenant/tenants/guards/role.guard';
import { RequireRole } from '../../identity-tenant/tenants/decorators/require-role.decorator';
import { CurrentUser } from '../../identity-tenant/auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../identity-tenant/auth/jwt-payload.type';

// Same "Evidence/outcomes" row as Contributions/Outcomes — see docs/DECISIONS.md.
const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'] as const;
const WRITE_ROLES = ['OWNER', 'ADMIN', 'MANAGER'] as const;

@ApiTags('evidence-outcomes')
@Controller('tenants/:tenantId/evidence')
@UseGuards(RoleGuard)
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Get()
  @RequireRole(...READ_ROLES)
  @ApiOperation({ summary: 'List evidence — optionally scoped to a contribution or outcome.' })
  async list(
    @Param('tenantId') tenantId: string,
    @Query('contributionId') contributionId?: string,
    @Query('outcomeId') outcomeId?: string,
  ) {
    const evidence = await this.evidenceService.list(tenantId, { contributionId, outcomeId });
    return { evidence };
  }

  @Get(':evidenceId')
  @RequireRole(...READ_ROLES)
  @ApiOperation({ summary: 'Get a single evidence record.' })
  async get(@Param('tenantId') tenantId: string, @Param('evidenceId') evidenceId: string) {
    const evidence = await this.evidenceService.get(tenantId, evidenceId);
    return { evidence };
  }

  @Post()
  @RequireRole(...WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Create an evidence record referencing a contribution or outcome (EVD-02) — file attached separately.',
  })
  async create(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateEvidenceDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const evidence = await this.evidenceService.create(tenantId, dto, claims.sub);
    return { evidence };
  }

  @Post(':evidenceId/file')
  @RequireRole(...WRITE_ROLES)
  @ApiOperation({
    summary:
      'Upload the material file for an evidence record — multipart/form-data, field name "file".',
  })
  async uploadFile(
    @Param('tenantId') tenantId: string,
    @Param('evidenceId') evidenceId: string,
    @Req() request: FastifyRequest,
    @CurrentUser() claims: JwtPayload,
  ) {
    const data = await request.file({ limits: { fileSize: MAX_EVIDENCE_FILE_SIZE_BYTES } });
    if (!data) {
      throw new UnprocessableEntityException('No file was uploaded.');
    }
    const buffer = await data.toBuffer();
    if (data.file.truncated) {
      throw new PayloadTooLargeException('This file is larger than the upload limit.');
    }

    const evidence = await this.evidenceService.attachFile(
      tenantId,
      evidenceId,
      { filename: data.filename, mimetype: data.mimetype, buffer },
      claims.sub,
    );
    return { evidence };
  }

  @Post(':evidenceId/replace')
  @RequireRole(...WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Replace evidence with a new version — never overwrites the prior material file (EVD-04).',
  })
  async replace(
    @Param('tenantId') tenantId: string,
    @Param('evidenceId') evidenceId: string,
    @Body() dto: ReplaceEvidenceDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const evidence = await this.evidenceService.replace(tenantId, evidenceId, dto, claims.sub);
    return { evidence };
  }
}
