'use client'

import { useFormFields, useRowLabel } from '@payloadcms/ui'
import { useEffect, useState } from 'react'

/**
 * The two custom pieces of an ordered line: its collapsed label, and the
 * product photo shown above the fields when the row is open.
 *
 * Both need the same product, and an order often repeats one, so the lookup is
 * shared and cached here rather than duplicated per component. The order stores
 * a relationship id and the admin form does not populate it, so the picture has
 * to be fetched.
 */

type Summary = { thumb: null | string; title: string }

const cache = new Map<number, Promise<Summary>>()

const loadSummary = (id: number): Promise<Summary> => {
  const cached = cache.get(id)

  if (cached) {
    return cached
  }

  const request = fetch(`/api/products/${id}?depth=2`)
    .then((res) => (res.ok ? res.json() : null))
    .then((doc): Summary => {
      const image = doc?.gallery?.[0]?.image

      return {
        // The card size is 640px, comfortably above the 300px it is drawn at,
        // so it stays sharp on a high-density screen.
        thumb: image?.sizes?.card?.url ?? image?.sizes?.thumbnail?.url ?? image?.url ?? null,
        title: doc?.title ?? `Product ${id}`,
      }
    })
    .catch((): Summary => ({ thumb: null, title: `Product ${id}` }))

  cache.set(id, request)

  return request
}

const idOf = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return value
  }

  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id

    return typeof id === 'number' ? id : undefined
  }

  return undefined
}

const useSummary = (productId: number | undefined): null | Summary => {
  const [summary, setSummary] = useState<null | Summary>(null)

  useEffect(() => {
    if (typeof productId !== 'number') {
      return
    }

    let active = true

    void loadSummary(productId).then((result) => {
      if (active) {
        setSummary(result)
      }
    })

    return () => {
      active = false
    }
  }, [productId])

  return summary
}

/**
 * Names each collapsed line by its product rather than a row number, so an
 * order can be read without opening every row.
 */
export const OrderItemRowLabel = () => {
  const { data, rowNumber } = useRowLabel<{ product?: unknown; quantity?: number }>()
  const summary = useSummary(idOf(data?.product))

  const position = String((rowNumber ?? 0) + 1).padStart(2, '0')
  const quantity = data?.quantity ?? 0

  return (
    <span>
      {position} — {summary?.title ?? 'Loading…'}
      {quantity > 0 ? ` × ${quantity}` : ''}
    </span>
  )
}

/**
 * The product photo, above the fields of an open line.
 *
 * A `ui` field, so it stores nothing and only draws. It reads the sibling
 * `product` value out of the form rather than taking a prop, because Payload
 * gives a UI field its path and nothing else.
 */
export const OrderItemImage: React.FC<{ path?: string }> = ({ path }) => {
  const parentPath = (path ?? '').split('.').slice(0, -1).join('.')

  const productValue = useFormFields(
    ([fields]) => (parentPath ? fields[`${parentPath}.product`]?.value : undefined),
  )

  const summary = useSummary(idOf(productValue))

  return (
    <div className="field-type" style={{ marginBottom: '1rem' }}>
      <div style={{ marginBottom: '0.5rem' }}>Product image</div>

      {summary?.thumb ? (
        // Payload's admin provides no image component for a ui field, and the
        // file is already a generated size, so a plain img is correct here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={summary.title}
          height={300}
          src={summary.thumb}
          style={{
            border: '1px solid var(--theme-elevation-150)',
            borderRadius: 4,
            height: 300,
            objectFit: 'cover',
            width: 300,
          }}
          width={300}
        />
      ) : (
        <div
          style={{
            alignItems: 'center',
            background: 'var(--theme-elevation-100)',
            border: '1px solid var(--theme-elevation-150)',
            borderRadius: 4,
            color: 'var(--theme-elevation-400)',
            display: 'flex',
            fontSize: '0.7rem',
            height: 300,
            justifyContent: 'center',
            textAlign: 'center',
            width: 300,
          }}
        >
          {summary ? 'No image' : '…'}
        </div>
      )}
    </div>
  )
}
