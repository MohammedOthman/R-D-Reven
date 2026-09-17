import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { prisma } from '@revn/db';
import { Public } from '../modules/identity-tenant/auth/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
@Public()
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness check — process is up.' })
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check — dependencies (database) are reachable.' })
  async readiness() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up', timestamp: new Date().toISOString() };
    } catch {
      throw new HttpException(
        { error: 'service_unavailable', message: 'Database is unreachable.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
