import path from 'path'
import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access'

/**
 * Product photography. Read is public so the storefront can render images
 * without authenticating; only staff can upload or remove them.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    create: isAdmin,
    delete: isAdmin,
    read: () => true,
    update: isAdmin,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      admin: {
        description: 'Describe the image for screen readers and for when it fails to load.',
      },
      required: true,
    },
  ],
  upload: {
    // Generated once at upload time so the storefront can request a size that
    // suits the layout instead of shipping the full-resolution original.
    imageSizes: [
      {
        name: 'thumbnail',
        height: 300,
        position: 'centre',
        width: 300,
      },
      {
        name: 'card',
        height: 640,
        position: 'centre',
        width: 640,
      },
      {
        name: 'feature',
        height: undefined,
        width: 1200,
      },
    ],
    mimeTypes: ['image/*'],
    // Uploads are written to local disk. In production MEDIA_DIR points at a
    // mounted volume (Railway: /data/media), because the container's own
    // filesystem is wiped on every deploy. Locally it defaults to ./media.
    staticDir: path.resolve(process.env.MEDIA_DIR || 'media'),
  },
}
