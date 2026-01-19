// server/api/admin/works/save.post.ts
import { createClient } from '@supabase/supabase-js'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { createError, defineEventHandler, getHeader, readBody } from 'h3'

type Body = {
  id: string | null
  draftId: string

  pendingHeroPath: string | null
  pendingGalleryPaths: string[]
  heroAlt: string | null

  title: string
  category: string
  short_description: string | null
  year: number | null
  role: string | null
  tools: string[]
  tags: string[]
  highlights: string[]
  outcome: string | null
  cta: string | null
  is_active: boolean
  sort_order: number
}

function getBearerToken(event: any): string | null {
  const h = getHeader(event, 'authorization') || getHeader(event, 'Authorization')
  if (!h) return null
  const m = String(h).match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

function asUuidOrNull(v: any): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (!s || s === 'undefined' || s === 'null') return null
  const ok = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  return ok ? s : null
}

function asStringOrNull(v: any): string | null {
  const s = String(v ?? '').trim()
  if (!s || s === 'undefined' || s === 'null') return null
  return s
}

function baseSlugFromTitle(title: string) {
  return String(title || '')
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

async function generateUniqueSlug(db: any, title: string) {
  const base = baseSlugFromTitle(title)
  if (!base) throw createError({ statusCode: 400, statusMessage: 'Title is required.' })

  const { data, error } = await db.from('works').select('slug').ilike('slug', `${base}%`)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const slugs = (data || []).map((r: any) => String(r.slug))
  if (!slugs.includes(base)) return base

  let max = 1
  for (const s of slugs) {
    const m = s.match(new RegExp(`^${base}-(\\d+)$`))
    if (m) {
      const n = Number(m[1])
      if (Number.isFinite(n) && n >= max) max = n + 1
    }
  }
  return `${base}-${max}`
}

function extFromPath(path: string) {
  const m = String(path).match(/\.([a-zA-Z0-9]+)$/)
  return m ? m[1].toLowerCase() : 'png'
}

function nextGalleryIndexFromExisting(paths: string[]) {
  // looks for ".../gallery-001.xxx"
  let max = 0
  for (const p of paths) {
    const m = String(p).match(/gallery-(\d{3})\./)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max + 1
}

export default defineEventHandler(async (event) => {
  const runtime = useRuntimeConfig()
  const supabaseUrl = runtime.public.supabaseUrl || process.env.SUPABASE_URL
  const anonKey = runtime.public.supabaseAnonKey || process.env.SUPABASE_KEY
  const serviceKey = runtime.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) throw createError({ statusCode: 500, statusMessage: 'Missing NUXT_PUBLIC_SUPABASE_URL' })
  if (!anonKey) throw createError({ statusCode: 500, statusMessage: 'Missing NUXT_PUBLIC_SUPABASE_ANON_KEY' })
  if (!serviceKey) throw createError({ statusCode: 500, statusMessage: 'Missing SUPABASE_SERVICE_ROLE_KEY' })

  // --- auth bootstrap: cookie first, bearer fallback ---
  let user = await serverSupabaseUser(event)
  let db: any = await serverSupabaseClient(event)

  if (!user?.id) {
    const token = getBearerToken(event)
    if (!token) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

    db = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } }
    })

    const { data, error } = await db.auth.getUser()
    if (error || !data?.user?.id) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    user = data.user
  }

  // --- admin check ---
  const { data: prof, error: pErr } = await db.from('profiles').select('role').eq('user_id', user.id).single()
  if (pErr) throw createError({ statusCode: 403, statusMessage: pErr.message })
  if (prof?.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Admin only' })

  // --- normalize body ---
  const raw = (await readBody(event)) as any
  const body: Body = {
    id: asUuidOrNull(raw?.id),
    draftId: String(raw?.draftId || '').trim(),

    pendingHeroPath: asStringOrNull(raw?.pendingHeroPath),
    pendingGalleryPaths: Array.isArray(raw?.pendingGalleryPaths)
      ? raw.pendingGalleryPaths
          .filter((x: any) => typeof x === 'string')
          .map((s: string) => s.trim())
          .filter((s: string) => s && s !== 'undefined' && s !== 'null')
      : [],
    heroAlt: asStringOrNull(raw?.heroAlt),

    title: String(raw?.title || '').trim(),
    category: String(raw?.category || '').trim(),
    short_description: asStringOrNull(raw?.short_description),
    year: raw?.year == null ? null : Number(raw.year),
    role: asStringOrNull(raw?.role),
    tools: Array.isArray(raw?.tools) ? raw.tools.map(String) : [],
    tags: Array.isArray(raw?.tags) ? raw.tags.map(String) : [],
    highlights: Array.isArray(raw?.highlights) ? raw.highlights.map(String) : [],
    outcome: asStringOrNull(raw?.outcome),
    cta: asStringOrNull(raw?.cta),
    is_active: !!raw?.is_active,
    sort_order: Number(raw?.sort_order ?? 100)
  }

  if (!body.title) throw createError({ statusCode: 400, statusMessage: 'Title required' })
  if (!body.category) throw createError({ statusCode: 400, statusMessage: 'Category required' })
  if (!body.draftId) throw createError({ statusCode: 400, statusMessage: 'draftId required' })

  // Storage finalize uses service role (copy/delete reliably)
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const bucket = 'works'

  async function copyThenDelete(from: string, to: string) {
    // Try native copy
    const { error: copyErr } = await admin.storage.from(bucket).copy(from, to)
    if (copyErr) {
      // Fallback: download + upload
      const dl = await admin.storage.from(bucket).download(from)
      if (dl.error) throw dl.error
      const buf = await dl.data.arrayBuffer()
      const up = await admin.storage.from(bucket).upload(to, new Uint8Array(buf), { upsert: true })
      if (up.error) throw up.error
    }
    await admin.storage.from(bucket).remove([from])
  }

  // --- determine final slug ---
  // IMPORTANT: keep slug stable on edits to avoid breaking URLs + existing media.
  // New works: generate slug from title. Edits: keep existing slug.
  let workId = body.id
  let finalSlug: string

  if (workId) {
    const { data: existing, error } = await db.from('works').select('slug').eq('id', workId).single()
    if (error) throw createError({ statusCode: 403, statusMessage: error.message })
    finalSlug = String(existing.slug)
  } else {
    finalSlug = await generateUniqueSlug(db, body.title)
  }

  // --- upsert works row ---
  const payload = {
    slug: finalSlug,
    title: body.title,
    category: body.category,
    short_description: body.short_description,
    year: Number.isFinite(body.year as any) ? body.year : null,
    role: body.role,
    tools: body.tools,
    tags: body.tags,
    highlights: body.highlights,
    outcome: body.outcome,
    cta: body.cta,
    is_active: body.is_active,
    sort_order: Number.isFinite(body.sort_order) ? body.sort_order : 100,
    updated_at: new Date().toISOString()
  }

  if (workId) {
    const { error } = await db.from('works').update(payload as any).eq('id', workId)
    if (error) throw createError({ statusCode: 403, statusMessage: error.message })
  } else {
    const { data, error } = await db.from('works').insert(payload as any).select('id').single()
    if (error) throw createError({ statusCode: 403, statusMessage: error.message })
    workId = asUuidOrNull(data?.id)
    if (!workId) throw createError({ statusCode: 500, statusMessage: 'Insert returned invalid id' })
  }

  // --- finalize hero ---
  if (body.pendingHeroPath) {
    const ext = extFromPath(body.pendingHeroPath)
    const finalPath = `${finalSlug}/hero.${ext}`

    const { data: oldHero } = await db
      .from('work_media')
      .select('id, path')
      .eq('work_id', workId)
      .eq('kind', 'hero')
      .maybeSingle()

    // remove old hero object if different path
    if (oldHero?.path && oldHero.path !== finalPath) {
      try {
        await admin.storage.from(bucket).remove([oldHero.path])
      } catch {}
    }

    await copyThenDelete(body.pendingHeroPath, finalPath)

    if (oldHero?.id) {
      const { error } = await db
        .from('work_media')
        .update({ path: finalPath, alt: body.heroAlt || null, sort_order: 0 } as any)
        .eq('id', oldHero.id)
      if (error) throw createError({ statusCode: 403, statusMessage: error.message })
    } else {
      const { error } = await db.from('work_media').insert({
        work_id: workId,
        kind: 'hero',
        path: finalPath,
        alt: body.heroAlt || null,
        sort_order: 0
      } as any)
      if (error) throw createError({ statusCode: 403, statusMessage: error.message })
    }
  }

  // --- finalize gallery (append after existing max) ---
  if (body.pendingGalleryPaths.length) {
    const { data: existingGallery } = await db
      .from('work_media')
      .select('path')
      .eq('work_id', workId)
      .eq('kind', 'gallery')

    const existingPaths = (existingGallery || []).map((r: any) => String(r.path))
    let idx = nextGalleryIndexFromExisting(existingPaths)

    for (const tmpPath of body.pendingGalleryPaths) {
      const ext = extFromPath(tmpPath)
      const finalPath = `${finalSlug}/gallery-${String(idx).padStart(3, '0')}.${ext}`
      const sortOrder = idx * 10
      idx += 1

      await copyThenDelete(tmpPath, finalPath)

      const { error } = await db.from('work_media').insert({
        work_id: workId,
        kind: 'gallery',
        path: finalPath,
        alt: null,
        sort_order: sortOrder
      } as any)
      if (error) throw createError({ statusCode: 403, statusMessage: error.message })
    }
  }

  // --- cleanup tmp folder ---
  try {
    const prefix = `_tmp/${body.draftId}`
    const { data: objects } = await admin.storage.from(bucket).list(prefix, { limit: 200 })
    if (objects?.length) {
      const paths = objects.map((o: any) => `${prefix}/${o.name}`)
      await admin.storage.from(bucket).remove(paths)
    }
  } catch {}

  // --- return saved work + media ---
  const { data: work, error: wErr } = await db
    .from('works')
    .select(
      `
      id, title, slug, category,
      short_description, year, role,
      tools, tags, highlights,
      outcome, cta,
      is_active, sort_order,
      created_at, updated_at,
      work_media ( id, kind, path, alt, sort_order, created_at )
    `
    )
    .eq('id', workId)
    .single()

  if (wErr) throw createError({ statusCode: 403, statusMessage: wErr.message })
  return work
})
