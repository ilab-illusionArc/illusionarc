// server/api/admin/tournaments/upsert.post.ts
import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, readBody } from 'h3'

async function requireAdmin(event: any) {
  const client = await serverSupabaseClient(event)
  const { data: auth, error: authErr } = await client.auth.getUser()
  const user = auth?.user
  if (authErr || !user?.id) throw createError({ statusCode: 401, statusMessage: 'Login required' })

  const { data: prof, error: profErr } = await client
    .from('profiles')
    .select('user_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profErr) throw createError({ statusCode: 500, statusMessage: profErr.message })
  if (String((prof as any)?.role || '').toLowerCase() !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admin only' })
  }

  return { userId: user.id }
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const adminDb = await serverSupabaseServiceRole(event)

  const body = await readBody(event)

  const id = String(body?.id || '').trim() || null
  const title = String(body?.title || '').trim()
  const slug = String(body?.slug || slugify(title)).trim()
  const description = String(body?.description || '').trim() || null
  const prize = String(body?.prize || '').trim() || null

  const game_slug = String(body?.game_slug || '').trim()
  const starts_at = String(body?.starts_at || '').trim()
  const ends_at = String(body?.ends_at || '').trim()

  const status = String(body?.status || 'scheduled').trim()
  const finalized = Boolean(body?.finalized ?? false)

  // ✅ NEW: thumbnail fields
  const thumbnail_url = String(body?.thumbnail_url || '').trim() || null
  const thumbnail_path = String(body?.thumbnail_path || '').trim() || null

  if (!title) throw createError({ statusCode: 400, statusMessage: 'Missing title' })
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' })
  if (!game_slug) throw createError({ statusCode: 400, statusMessage: 'Missing game_slug' })
  if (!starts_at) throw createError({ statusCode: 400, statusMessage: 'Missing starts_at' })
  if (!ends_at) throw createError({ statusCode: 400, statusMessage: 'Missing ends_at' })

  const sMs = new Date(starts_at).getTime()
  const eMs = new Date(ends_at).getTime()
  if (!Number.isFinite(sMs)) throw createError({ statusCode: 400, statusMessage: 'Invalid starts_at' })
  if (!Number.isFinite(eMs)) throw createError({ statusCode: 400, statusMessage: 'Invalid ends_at' })
  if (eMs <= sMs) throw createError({ statusCode: 400, statusMessage: 'ends_at must be after starts_at' })

  // slug uniqueness check (except self)
  {
    let check = adminDb.from('tournaments').select('id').eq('slug', slug)
    if (id) check = check.neq('id', id)
    const { data: exists, error: exErr } = await check.maybeSingle()
    if (exErr) throw createError({ statusCode: 400, statusMessage: exErr.message })
    if (exists?.id) throw createError({ statusCode: 409, statusMessage: 'Slug already exists' })
  }

  const payload = {
    slug,
    title,
    description,
    prize,
    game_slug,
    starts_at,
    ends_at,
    status,
    finalized,

    // ✅ NEW persisted fields
    thumbnail_url,
    thumbnail_path
  }

  if (!id) {
    const { data, error } = await adminDb
      .from('tournaments')
      .insert(payload)
      .select('*')
      .single()

    if (error) throw createError({ statusCode: 400, statusMessage: error.message })
    return { ok: true, tournament: data }
  }

  const { data, error } = await adminDb
    .from('tournaments')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { ok: true, tournament: data }
})
