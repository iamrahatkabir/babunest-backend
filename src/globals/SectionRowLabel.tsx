'use client'

import { useRowLabel } from '@payloadcms/ui'

/**
 * Names each collapsed row in the homepage sections list by its heading.
 *
 * The default label is "Section 01", "Section 02" and so on, which makes
 * reordering five collapsed bands a matter of opening each one to find out
 * what it is.
 */
export const SectionRowLabel = () => {
  const { data, rowNumber } = useRowLabel<{ heading?: string }>()
  const position = String((rowNumber ?? 0) + 1).padStart(2, '0')

  return <span>{data?.heading ? `${position} — ${data.heading}` : `Section ${position}`}</span>
}
