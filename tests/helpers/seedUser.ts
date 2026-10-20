import { getPayload } from 'payload'
import config from '../../src/payload.config.js'
import type { User } from '../../src/payload-types.js'

export const testUser = {
  email: 'dev@payloadcms.com',
  password: 'test',
  // The admin e2e tests sign in to the panel, which is admin-only.
  roles: ['admin'],
} satisfies Pick<User, 'email' | 'roles'> & { password: string }

/**
 * Seeds a test user for e2e admin tests.
 */
export async function seedTestUser(): Promise<void> {
  const payload = await getPayload({ config })

  // Delete existing test user if any
  await payload.delete({
    collection: 'users',
    where: {
      email: {
        equals: testUser.email,
      },
    },
  })

  // Create fresh test user
  await payload.create({
    collection: 'users',
    data: testUser,
  })
}

/**
 * Cleans up test user after tests
 */
export async function cleanupTestUser(): Promise<void> {
  const payload = await getPayload({ config })

  await payload.delete({
    collection: 'users',
    where: {
      email: {
        equals: testUser.email,
      },
    },
  })
}
