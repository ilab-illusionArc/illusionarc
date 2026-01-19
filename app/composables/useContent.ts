// app/composables/useContent.ts
import { GAMES } from '~/data/games'
import type { WorkCategory } from '~/types/content'
import { PLACEHOLDER_IMG } from '~/constants/media'

type WorkMediaRow = {
  id: string
  kind: 'hero' | 'gallery'
  path: string
  alt: string | null
  sort_order: number
}

type WorkRow = {
  id: string
  title: string
  slug: string
  category: string
  short_description: string | null
  year: number | null
  role: string | null
  tools: any
  tags: any
  highlights: any
  outcome: string | null
  cta: string | null
  is_active: boolean
  sort_order: number
  work_media?: WorkMediaRow[] | null
}

type ServiceRow = any

function safeArr(v: any): string[] {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean)
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean)
  return []
}

export function useContent() {
  const supabase = useSupabaseClient()

  // ✅ keep games static (unchanged)
  const games = GAMES
  const getGameBySlug = (slug: string) => games.find((g) => g.slug === slug)

  // ✅ storage URL helper
  const publicUrl = (path?: string | null) => {
    const p = String(path || '').trim()
    if (!p) return PLACEHOLDER_IMG
    const { data } = supabase.storage.from('works').getPublicUrl(p)
    return data?.publicUrl || PLACEHOLDER_IMG
  }

  // -------- WORKS (Supabase) --------
  const {
    data: worksRows,
    pending: worksPending,
    error: worksError,
    refresh: refreshWorks
  } = useAsyncData<WorkRow[]>(
    'content-works',
    async () => {
      const { data, error } = await supabase
        .from('works')
        .select(
          `
          id, title, slug, category,
          short_description, year, role,
          tools, tags, highlights,
          outcome, cta,
          is_active, sort_order,
          work_media ( id, kind, path, alt, sort_order )
        `
        )
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data || []) as WorkRow[]
    },
    { default: () => [] }
  )

  // ✅ reactive works (IMPORTANT)
  const works = computed(() => {
    const rows = (worksRows.value || []) as WorkRow[]
    return rows.map((r) => {
      const media = Array.isArray(r.work_media) ? r.work_media : []
      const heroRow = media.find((m) => m.kind === 'hero') || null
      const galleryRows = media
        .filter((m) => m.kind === 'gallery')
        .slice()
        .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))

      const title = String(r.title || '')

      return {
        title,
        slug: String(r.slug || ''),
        category: String(r.category || 'games'),
        shortDescription: String(r.short_description || ''),
        year: r.year != null ? Number(r.year) : null,
        role: r.role ? String(r.role) : null,
        tools: safeArr(r.tools),
        tags: safeArr(r.tags),
        highlights: safeArr(r.highlights),
        outcome: r.outcome ? String(r.outcome) : null,
        cta: r.cta ? String(r.cta) : null,
        hero: {
          type: 'image' as const,
          src: publicUrl(heroRow?.path),
          alt: String(heroRow?.alt || `${title} hero`)
        },
        gallery: galleryRows.map((m, i) => ({
          type: 'image' as const,
          src: publicUrl(m.path),
          alt: String(m.alt || `${title} image ${i + 1}`)
        }))
      }
    })
  })

  const getWorkBySlug = (slug: string) => works.value.find((w) => w.slug === slug)
  const worksByCategory = (cat: WorkCategory) => works.value.filter((w) => w.category === cat)

  // -------- SERVICES (Supabase) --------
  const {
    data: servicesRows,
    pending: servicesPending,
    error: servicesError,
    refresh: refreshServices
  } = useAsyncData<ServiceRow[]>(
    'content-services',
    async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data || []) as ServiceRow[]
    },
    { default: () => [] }
  )

  // ✅ reactive services
  const services = computed(() => servicesRows.value || [])

  return {
    // Works/services are now reactive again
    works,
    services,

    // Games still static
    games,

    // helpers
    getWorkBySlug,
    getGameBySlug,
    worksByCategory,

    // optional state
    worksPending,
    worksError,
    refreshWorks,
    servicesPending,
    servicesError,
    refreshServices
  }
}
