<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useHead({ title: 'Admin — illusion Arc' })

const supabase = useSupabaseClient()

const stats = reactive({
  users: 0,
  scores: 0,
  messages: 0,
  requests: 0
})

const recentMessages = ref<any[]>([])
const recentScores = ref<any[]>([])

async function load() {
  // counts
  const u = await supabase.from('profiles').select('user_id', { count: 'exact', head: true })
  const s = await supabase.from('leaderboard_scores').select('id', { count: 'exact', head: true })
  const m = await supabase.from('contact_messages').select('id', { count: 'exact', head: true })
  const r = await supabase.from('contact_requests').select('id', { count: 'exact', head: true })

  stats.users = u.count || 0
  stats.scores = s.count || 0
  stats.messages = m.count || 0
  stats.requests = r.count || 0

  // recent lists
  const rm = await supabase
    .from('contact_messages')
    .select('id, created_at, name, email, subject, status')
    .order('created_at', { ascending: false })
    .limit(6)

  recentMessages.value = rm.data || []

  const rs = await supabase
    .from('leaderboard_scores')
    .select('id, created_at, game_slug, score, player_name, user_id')
    .order('created_at', { ascending: false })
    .limit(6)

  recentScores.value = rs.data || []
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="header">
      <div>
        <div class="h1">Admin Dashboard</div>
        <div class="sub">Manage users, scores, and incoming messages.</div>
      </div>
      <div class="actions">
        <UButton variant="soft" @click="() => navigateTo('/admin/messages')">Messages</UButton>
        <UButton color="primary" variant="solid" @click="() => navigateTo('/admin/users')">Users</UButton>
      </div>
    </div>

    <div class="cards">
      <div class="kpi">
        <div class="k">Users</div>
        <div class="v">{{ stats.users }}</div>
      </div>
      <div class="kpi">
        <div class="k">Scores</div>
        <div class="v">{{ stats.scores }}</div>
      </div>
      <div class="kpi">
        <div class="k">Messages</div>
        <div class="v">{{ stats.messages }}</div>
      </div>
      <div class="kpi">
        <div class="k">Requests</div>
        <div class="v">{{ stats.requests }}</div>
      </div>
    </div>

    <div class="grid">
      <section class="card">
        <div class="cardTitle">Recent Messages</div>

        <div v-if="recentMessages.length" class="list">
          <div v-for="m in recentMessages" :key="m.id" class="row">
            <div class="meta">
              <div class="t">{{ m.name }} <span class="dim">· {{ m.email }}</span></div>
              <div class="dim">{{ m.subject || 'No subject' }}</div>
            </div>
            <UBadge :label="m.status" variant="soft" />
          </div>
        </div>

        <div v-else class="empty">No messages yet.</div>
      </section>

      <section class="card">
        <div class="cardTitle">Recent Scores</div>

        <div v-if="recentScores.length" class="list">
          <div v-for="s in recentScores" :key="s.id" class="row">
            <div class="meta">
              <div class="t">{{ s.game_slug }} <span class="dim">· {{ s.player_name || 'Player' }}</span></div>
              <div class="dim">{{ new Date(s.created_at).toLocaleString() }}</div>
            </div>
            <div class="score">{{ s.score }}</div>
          </div>
        </div>

        <div v-else class="empty">No scores yet.</div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.page{ display:grid; gap:14px; }
.header{
  display:flex; align-items:flex-end; justify-content:space-between; gap:12px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.06);
  backdrop-filter: blur(10px);
}
.h1{ font-size: 1.35rem; font-weight: 900; letter-spacing: -.02em; }
.sub{ opacity:.7; margin-top:4px; }
.actions{ display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; }

.cards{
  display:grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
@media (max-width: 980px){ .cards{ grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 520px){ .cards{ grid-template-columns: 1fr; } }

.kpi{
  padding: 14px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.05);
  backdrop-filter: blur(10px);
}
.k{ font-size:.8rem; opacity:.7; }
.v{ margin-top:6px; font-size: 1.6rem; font-weight: 900; letter-spacing:-.02em; }

.grid{
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
@media (max-width: 980px){ .grid{ grid-template-columns: 1fr; } }

.card{
  padding: 14px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.05);
  backdrop-filter: blur(10px);
}
.cardTitle{ font-weight: 900; letter-spacing:-.02em; margin-bottom:10px; }
.list{ display:grid; gap:10px; }
.row{
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  padding: 10px 10px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.03);
}
.meta{ min-width:0; }
.t{ font-weight: 700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dim{ opacity:.65; font-size:.82rem; }
.score{ font-weight: 900; font-size: 1.1rem; }
.empty{ opacity:.65; padding: 10px 2px; }
</style>
