#!/usr/bin/env node

// Script to check webhook data in the database
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('Checking database for webhook data...\n');

    // Check users
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    console.log(`Users (${users.length} found):`);
    users.forEach(user => {
      console.log(`  - ${user.whopUserId} | ${user.email || 'No email'} | ${user.name || 'No name'}`);
    });

    // Check memberships
    const memberships = await prisma.membership.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { user: true, company: true }
    });
    console.log(`\nMemberships (${memberships.length} found):`);
    memberships.forEach(membership => {
      console.log(`  - ${membership.whopMembershipId} | Status: ${membership.status} | Expires: ${membership.expiresAt || 'Never'}`);
    });

    // Check companies
    const companies = await prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    console.log(`\nCompanies (${companies.length} found):`);
    companies.forEach(company => {
      console.log(`  - ${company.whopCompanyId} | ${company.name || 'No name'}`);
    });

    // Check access logs
    const accessLogs = await prisma.accessLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    console.log(`\nAccess Logs (${accessLogs.length} found):`);
    accessLogs.forEach(log => {
      console.log(`  - ${log.resource} | Allowed: ${log.allowed} | ${log.reason || ''} | ${log.createdAt.toISOString()}`);
    });

    // Count totals
    const counts = {
      users: await prisma.user.count(),
      memberships: await prisma.membership.count(),
      companies: await prisma.company.count(),
      products: await prisma.product.count(),
      subscriptions: await prisma.subscription.count(),
      payments: await prisma.payment.count(),
      accessLogs: await prisma.accessLog.count(),
    };

    console.log('\nTotal counts:');
    Object.entries(counts).forEach(([table, count]) => {
      console.log(`  ${table}: ${count}`);
    });

  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();