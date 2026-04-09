# Task 4 Raw: API Contract Consistency

## Response format

- human-space-domain-map: { success: true, data } / { error }
- practices, points, my-reviews: use apiSuccess, apiError, apiPaginated from api-utils
- circles: NextResponse.json({ success: true, data }) — manual, consistent
- pa-directory: NextResponse.json({ success: true, data, pagination }) — pagination shape differs from apiPaginated (total, page)

## Auth

- requireAuth: points, daily-tasks, my-reviews, practices POST — throws 401
- getCurrentUser + if (!user) return 401: pa-action/*, developer/*, gm/*, etc.

Two patterns. Both achieve auth. requireAuth is stricter (throws). getCurrentUser allows optional auth for some routes (e.g. practices GET uses getCurrentUser for isOwnQuery).

## Error handling

- api-utils: apiError(msg, status) returns NextResponse.json({ error: msg }, { status })
- Manual: return NextResponse.json({ error: '...' }, { status })
- console.error for server-side logging

No centralized error middleware. Each route handles try-catch.
