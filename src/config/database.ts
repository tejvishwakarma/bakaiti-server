import { PrismaClient } from '@prisma/client';

// Create singleton Prisma client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Connection check
prisma.$connect().then(() => {
  console.log('✅ Database connected');
}).catch((err) => {
  console.error('❌ Database connection failed:', err);
});

export default prisma;
