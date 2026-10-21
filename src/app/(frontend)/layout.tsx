import React from 'react'

export const metadata = {
  description: 'BabuNest.com commerce backend',
  title: 'BabuNest.com Admin',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
