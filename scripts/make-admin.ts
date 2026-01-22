/**
 * Script to make a user an admin
 * Run with: npx ts-node scripts/make-admin.ts <email>
 */

import prisma from '../src/config/database';

async function makeAdmin(email: string) {
    console.log(`🔍 Looking for user with email: ${email}`);

    try {
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            console.log('❌ User not found. Available users:');
            const users = await prisma.user.findMany({
                select: { email: true, isAdmin: true },
                take: 10
            });
            users.forEach(u => console.log(`  - ${u.email} (admin: ${u.isAdmin})`));
            return;
        }

        if (user.isAdmin) {
            console.log('✅ User is already an admin!');
            return;
        }

        await prisma.user.update({
            where: { email },
            data: { isAdmin: true }
        });

        console.log(`✅ Successfully made ${email} an admin!`);
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

const email = process.argv[2] || 'tejv0251@gmail.com';
makeAdmin(email);
