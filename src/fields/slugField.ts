import type { TextField } from 'payload'

export const slugify = (input: string): string =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * URL segment for storefront routes. Derived from `sourceField` when left
 * blank, so staff never have to think about it, but still editable — changing a
 * product's name shouldn't silently break an indexed URL.
 */
export const slugField = (sourceField = 'title'): TextField => ({
  name: 'slug',
  type: 'text',
  admin: {
    description: 'URL segment. Generated from the title if left blank.',
    position: 'sidebar',
  },
  hooks: {
    beforeValidate: [
      ({ data, value }) => {
        if (typeof value === 'string' && value.length > 0) {
          return slugify(value)
        }

        const source = data?.[sourceField]

        return typeof source === 'string' ? slugify(source) : value
      },
    ],
  },
  index: true,
  required: true,
  unique: true,
})
