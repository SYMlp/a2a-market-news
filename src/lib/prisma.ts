import { PrismaClient, Prisma } from '@prisma/client'

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 500
const RETRYABLE_OPERATIONS = new Set([
  'findUnique', 'findFirst', 'findMany', 'count', 'aggregate', 'groupBy',
])
const TRANSIENT_CODES = new Set(['P1001', 'P1002', 'P2024'])

function createPrismaClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? [{ emit: 'stdout', level: 'warn' }, { emit: 'stdout', level: 'error' }]
      : [{ emit: 'stdout', level: 'error' }],
  })

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!RETRYABLE_OPERATIONS.has(operation)) return query(args)

          let lastError: unknown
          for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
              return await query(args)
            } catch (error: unknown) {
              lastError = error
              const code = (error as { code?: string })?.code
              if (!code || !TRANSIENT_CODES.has(code) || attempt === MAX_RETRIES) throw error
              console.warn(
                `[Prisma] ${model}.${operation} failed (${code}), retry ${attempt + 1}/${MAX_RETRIES}...`
              )
              await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)))
            }
          }
          throw lastError
        },
      },
    },
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
