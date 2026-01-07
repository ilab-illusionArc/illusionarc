import { serverSupabaseClient, serverSupabaseSession } from '#supabase/server'

export default defineEventHandler(async (event) => {
    const client = await serverSupabaseClient(event)

    // session from SSR cookies
    const session = await serverSupabaseSession(event)

    // also try via auth.getUser (more direct)
    const { data } = await client.auth.getUser()

    return {
        sessionUser: session?.user ? { id: session.user.id, email: session.user.email } : null,
        getUser: data?.user ? { id: data.user.id, email: data.user.email } : null
    }
})
