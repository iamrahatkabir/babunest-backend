import React from 'react'

export const metadata = {
  description: 'Brownmoor.com commerce backend',
  title: 'Brownmoor.com Admin',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
