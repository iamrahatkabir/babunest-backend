'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Shows how many orders are still waiting to be dealt with, beside Orders in
 * the nav.
 *
 * Only `processing` counts. The moment staff move an order on — confirmed, in
 * office, sent to the courier — it drops out, so the number is a queue to work
 * through rather than a running total of everything ever sold. At zero the
 * badge disappears entirely, which is the state you want to reach.
 *
 * Payload has no API for badging a nav link, so this renders through
 * `afterNavLinks` and portals the badge into the existing anchor. The link is
 * found by href rather than by position, so reordering the nav cannot break it.
 */
/**
 * Payload gives every nav entry a stable id of `nav-{slug}`.
 *
 * Matching on that rather than on the href matters twice over. On the Orders
 * page itself Payload renders the entry as a div rather than a link, so an
 * anchor selector finds nothing; and "Create New" is an anchor whose href also
 * contains /collections/orders, so a loose href match lands on the button
 * instead of the sidebar.
 */
const ORDERS_NAV_ID = 'nav-orders'

/** Roughly how long a stale count is tolerable while a tab sits open. */
const REFRESH_MS = 60_000

const findOrdersLink = (): HTMLElement | null => document.getElementById(ORDERS_NAV_ID)

export const ProcessingOrdersBadge = () => {
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [count, setCount] = useState<null | number>(null)

  // The nav renders after this component on a cold load, so the link is not
  // there on the first pass. Observing mutations alone proved unreliable — a
  // node added between StrictMode's two effect runs is missed — so a short
  // poll backs it up and stops once attached.
  useEffect(() => {
    let stopped = false

    const attach = () => {
      if (stopped) {
        return true
      }

      const link = findOrdersLink()

      if (link) {
        setHost(link)
        stopped = true
      }

      return Boolean(link)
    }

    if (attach()) {
      return
    }

    const observer = new MutationObserver(() => {
      if (attach()) {
        observer.disconnect()
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    const poll = window.setInterval(() => {
      if (attach()) {
        window.clearInterval(poll)
        observer.disconnect()
      }
    }, 200)

    // Give up quietly rather than polling for the life of the session.
    const giveUp = window.setTimeout(() => window.clearInterval(poll), 10_000)

    return () => {
      stopped = true
      observer.disconnect()
      window.clearInterval(poll)
      window.clearTimeout(giveUp)
    }
  }, [])

  useEffect(() => {
    let active = true

    const load = () => {
      // limit=0 asks for the count without the documents.
      void fetch('/api/orders?where[status][equals]=processing&limit=0&depth=0', {
        credentials: 'include',
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (active && typeof data?.totalDocs === 'number') {
            setCount(data.totalDocs)
          }
        })
        .catch(() => {
          // A failed count must never break the nav; the badge just stays as it
          // was, or absent.
        })
    }

    load()

    const timer = window.setInterval(load, REFRESH_MS)
    // Coming back to the tab is the moment a stale number is most obvious.
    window.addEventListener('focus', load)

    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', load)
    }
  }, [])

  if (count === null || count === 0) {
    return null
  }

  const badge = (
    <span
      aria-label={`${count} orders awaiting processing`}
      style={{
        background: 'var(--theme-error-500, #c0392b)',
        borderRadius: '999px',
        color: '#fff',
        display: 'inline-block',
        fontSize: '0.7rem',
        fontWeight: 600,
        lineHeight: 1.6,
        marginLeft: '0.5rem',
        minWidth: '1.4em',
        padding: '0 0.4em',
        textAlign: 'center',
      }}
    >
      {count}
    </span>
  )

  // Portalled into the Orders link when it can be found. If Payload ever
  // restructures its nav and the link cannot be located, the badge still shows
  // here in the slot with a label — visibly degraded rather than silently gone.
  // Nothing is drawn until the link is found; the badge belongs on Orders or
  // nowhere.
  return host ? createPortal(badge, host) : null
}
