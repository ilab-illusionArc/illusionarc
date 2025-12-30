export default defineEventHandler((event) => {
    // Basic hardening
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    setHeader(event, 'X-Frame-Options', 'SAMEORIGIN') // default

    // For embed routes we allow framing
    const url = event.node.req.url || ''
    if (url.startsWith('/embed/')) {
        // allow partners later by swapping SAMEORIGIN -> specific domains
        setHeader(event, 'X-Frame-Options', 'ALLOWALL')
        setHeader(event, 'Content-Security-Policy', "frame-ancestors *;")
    }
})
