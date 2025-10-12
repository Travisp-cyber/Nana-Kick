import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Security: Only allow if admin secret is provided
    const authHeader = request.headers.get('authorization');
    const secret = process.env.ADMIN_SECRET || process.env.USAGE_CRON_SECRET;
    
    if (!authHeader || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Run the migration SQL directly
    console.log('🔄 Running database migration...');
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" 
      ADD COLUMN IF NOT EXISTS "currentTier" TEXT,
      ADD COLUMN IF NOT EXISTS "generationsUsed" INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "generationsLimit" INTEGER,
      ADD COLUMN IF NOT EXISTS "usageResetDate" TIMESTAMP(3);
    `);

    console.log('✅ Migration completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Database migration completed successfully'
    });
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Migration failed'
      },
      { status: 500 }
    );
  }
}

