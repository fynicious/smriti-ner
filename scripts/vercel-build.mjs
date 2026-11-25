import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function run(cmd, env = process.env) {
  console.log(`[vercel-build] Running: ${cmd}`);
  execSync(cmd, { stdio: 'inherit', env });
}

function main() {
  const dbUrl = (process.env.DATABASE_URL || '').trim();
  const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');

  if (isPostgres) {
    const pgSchema = path.join('prisma', 'postgres', 'schema.prisma');
    if (!fs.existsSync(pgSchema)) {
      throw new Error(`Missing PostgreSQL Prisma schema at ${pgSchema}`);
    }
    const directUrl =
      process.env.DIRECT_URL?.trim() ||
      process.env.DATABASE_URL_UNPOOLED?.trim() ||
      process.env.POSTGRES_URL_NON_POOLING?.trim() ||
      dbUrl.replace('-pooler.', '.');
    const pgEnv = { ...process.env, DIRECT_URL: directUrl };
    run(`npx prisma generate --schema "${pgSchema}"`, pgEnv);
    if (process.env.SKIP_DB_MIGRATE !== '1') {
      run(`npx prisma migrate deploy --schema "${pgSchema}"`, pgEnv);
    }
    if (process.env.SEED_SYNTHETIC_DEMO === '1') {
      run('node scripts/seed-synthetic-demo.mjs', pgEnv);
    }
  } else {
    run('npx prisma generate');
  }

  run('npx next build');
}

main();
