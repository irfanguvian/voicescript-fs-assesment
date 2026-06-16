import { PrismaClient } from '@prisma/client';
import { ulid } from 'ulid';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // Reporters — mixed cities, each with a zeroed balance row.
  const reporters = [
    { name: 'Andi Wijaya', city: 'Jakarta' },
    { name: 'Budi Santoso', city: 'Bandung' },
    { name: 'Citra Lestari', city: 'Jakarta' },
    { name: 'Dian Permata', city: 'Surabaya' },
  ];
  for (const r of reporters) {
    const reporter_id = ulid();
    await prisma.reporter.create({
      data: {
        reporter_id,
        name: r.name,
        city: r.city,
        balance: { create: { current_balance: 0 } },
      },
    });
  }

  // Editors — each with a zeroed balance row.
  const editors = [{ name: 'Dewi Anggraini' }, { name: 'Eko Prasetyo' }];
  for (const e of editors) {
    const editor_id = ulid();
    await prisma.editor.create({
      data: {
        editor_id,
        name: e.name,
        balance: { create: { current_balance: 0 } },
      },
    });
  }

  // Jobs — mix of PHYSICAL/REMOTE, all NEW (unassigned).
  const jobs = [
    {
      case_name: 'State v. Halim',
      duration_minutes: 90,
      location_type: 'PHYSICAL' as const,
      city: 'Jakarta',
    },
    {
      case_name: 'Pertiwi v. Nugroho',
      duration_minutes: 45,
      location_type: 'REMOTE' as const,
      city: null,
    },
    {
      case_name: 'In re Sari Estate',
      duration_minutes: 120,
      location_type: 'PHYSICAL' as const,
      city: 'Bandung',
    },
    {
      case_name: 'Hartono v. Surya',
      duration_minutes: 60,
      location_type: 'REMOTE' as const,
      city: null,
    },
    {
      case_name: 'Wibowo v. Lestari',
      duration_minutes: 75,
      location_type: 'PHYSICAL' as const,
      city: 'Surabaya',
    },
  ];
  for (const j of jobs) {
    await prisma.job.create({
      data: {
        job_id: ulid(),
        case_name: j.case_name,
        duration_minutes: j.duration_minutes,
        location_type: j.location_type,
        city: j.city,
        status: 'NEW',
      },
    });
  }

  const [rc, ec, jc] = await Promise.all([
    prisma.reporter.count(),
    prisma.editor.count(),
    prisma.job.count(),
  ]);
  console.log(`Seeded: ${rc} reporters, ${ec} editors, ${jc} jobs.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
