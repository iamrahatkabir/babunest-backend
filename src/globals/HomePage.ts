import type { GlobalConfig } from 'payload'

import { isAdmin } from '../access'

/** How many bands the homepage supports below the hero. */
const MAX_SECTIONS = 5

/**
 * Editable homepage content.
 *
 * A global rather than a collection because there is exactly one homepage —
 * staff edit this record in place, and the storefront reads it at
 * `/api/globals/home-page`. Changing the hero or the product bands needs no
 * deploy.
 */
export const HomePage: GlobalConfig = {
  slug: 'home-page',
  access: {
    // Public: the storefront fetches this unauthenticated on every render.
    read: () => true,
    update: isAdmin,
  },
  admin: {
    group: 'Storefront',
  },
  fields: [
    {
      name: 'heroSlides',
      type: 'array',
      admin: {
        description:
          'Banners at the top of the homepage, shown in this order with arrows to move between them. Drag to rearrange. Each slide is a finished design, so any wording belongs in the artwork itself. Leave empty to fall back to the single banner below.',
        initCollapsed: true,
      },
      fields: [
        {
          name: 'image',
          type: 'upload',
          admin: {
            description:
              'Landscape at 2400×1000, or any 12:5 ratio. The frame is that shape at every screen size, so a design supplied at these proportions is never cropped. Every slide should match.',
          },
          relationTo: 'media',
          required: true,
        },
        {
          name: 'link',
          type: 'text',
          admin: {
            description:
              'Where the banner takes a shopper who taps it, e.g. /category/cookware or /product/glass-bottle. Leave empty to make the slide unclickable.',
          },
        },
        {
          name: 'alt',
          type: 'text',
          admin: {
            description:
              'Describes the banner for screen readers and for when the image fails to load. Say what is being promoted, not "banner".',
          },
        },
      ],
      labels: {
        plural: 'Slides',
        singular: 'Slide',
      },
    },
    {
      name: 'heroAutoplaySeconds',
      type: 'number',
      admin: {
        condition: (data) => (data?.heroSlides ?? []).length > 1,
        description:
          'How long each slide is shown before the next one. Set to 0 to stop the banner moving on its own — shoppers can still swipe or use the dots.',
      },
      defaultValue: 5,
      label: 'Seconds per slide',
      min: 0,
    },
    {
      type: 'collapsible',
      admin: {
        description:
          'Used only when no slides are set above. Kept so the homepage still has a banner while the slider is being filled in.',
        initCollapsed: true,
      },
      fields: [
        {
          name: 'image',
          type: 'upload',
          admin: {
            description:
              'Full-width banner. Landscape works best — around 2400×1000 for a crisp result on large screens.',
          },
          relationTo: 'media',
        },
        {
          name: 'heading',
          type: 'text',
          admin: {
            description: 'Optional. Overlaid on the banner.',
          },
        },
        {
          name: 'subheading',
          type: 'textarea',
          maxLength: 200,
        },
        {
          type: 'row',
          fields: [
            {
              name: 'ctaLabel',
              type: 'text',
              admin: {
                description: 'e.g. "Shop cookware". Leave empty to hide the button.',
                width: '50%',
              },
            },
            {
              name: 'ctaLink',
              type: 'text',
              admin: {
                description: 'e.g. /category/cookware',
                width: '50%',
              },
            },
          ],
        },
      ],
      label: 'Hero banner (fallback)',
    },
    {
      type: 'collapsible',
      fields: [
        {
          name: 'topCollectionsHeading',
          type: 'text',
          admin: {
            description: 'Shown above the grid. Leave empty to hide the heading.',
          },
          defaultValue: 'Top Collections',
          label: 'Heading',
        },
        {
          name: 'topCollections',
          type: 'relationship',
          admin: {
            description:
              'Pick the categories to feature and drag to reorder. Each tile uses that category\'s own image, set on the category itself — so a picture chosen here is the same one used everywhere else. Leave empty to hide the whole section.',
          },
          hasMany: true,
          label: 'Categories',
          relationTo: 'categories',
        },
      ],
      label: 'Top collections',
    },
    {
      name: 'sections',
      type: 'array',
      admin: {
        description: `Product bands shown below the hero, in this order. Up to ${MAX_SECTIONS}. Drag to rearrange; delete one to remove it from the homepage.`,
        initCollapsed: true,
        // Without this every row reads "Section 01" in the collapsed list,
        // which makes reordering five of them guesswork.
        components: {
          RowLabel: '@/globals/SectionRowLabel#SectionRowLabel',
        },
      },
      fields: [
        {
          name: 'eyebrow',
          type: 'text',
          admin: {
            description: 'Small label above the heading. Leave empty to hide it.',
          },
        },
        {
          name: 'heading',
          type: 'text',
          required: true,
        },
        {
          name: 'intro',
          type: 'textarea',
          admin: {
            description: 'Short paragraph under the heading. Optional.',
          },
          maxLength: 300,
        },
        {
          name: 'products',
          type: 'relationship',
          admin: {
            description:
              'Pick any number of products and drag to reorder. The band is hidden if this is empty. The grid is four wide on desktop and two on mobile, so multiples of four fill the last row evenly.',
          },
          filterOptions: () => ({
            // A draft product would 404 for shoppers, so it should not be
            // offered as something to put on the homepage.
            _status: { equals: 'published' },
          }),
          // No maxRows on purpose: staff decide how long a band should be.
          hasMany: true,
          relationTo: 'products',
        },
        {
          type: 'row',
          fields: [
            {
              name: 'viewAllLabel',
              type: 'text',
              admin: {
                description: 'Button text. Leave empty to hide the button.',
                width: '50%',
              },
              defaultValue: 'View all',
            },
            {
              name: 'viewAllUrl',
              type: 'text',
              admin: {
                description: 'Where the button goes, e.g. /category/cookware',
                width: '50%',
              },
            },
          ],
        },
      ],
      label: 'Product sections',
      maxRows: MAX_SECTIONS,
    },
  ],
  label: 'Home Page',
}
