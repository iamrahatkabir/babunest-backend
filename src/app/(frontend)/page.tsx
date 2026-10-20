import { redirect } from 'next/navigation'

// This app is the Payload backend only: admin UI at /admin, REST at /api,
// GraphQL at /api/graphql. The storefront lives in the separate Frontend app.
export default function RootPage() {
  redirect('/admin')
}
