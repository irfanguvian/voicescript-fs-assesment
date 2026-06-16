import { Module } from '@nestjs/common';
import { EditorsModule } from './editors/editors.module';
import { HealthController } from './health.controller';
import { JobsModule } from './jobs/jobs.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportersModule } from './reporters/reporters.module';

@Module({
  imports: [
    PrismaModule,
    JobsModule,
    ReportersModule,
    EditorsModule,
    PaymentsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
