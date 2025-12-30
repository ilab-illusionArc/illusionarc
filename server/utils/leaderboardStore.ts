import { promises as fs } from 'node:fs'
import { join } from 'node:path'

export type ScoreRow = {
    id: string
    gameSlug: string
    player: string
    score: number
    createdAt: string
    source: 'arcade' | 'embed'
}

type Db = { scores: ScoreRow[] }

const DATA_DIR = join(process.cwd(), '.data')
const FILE = join(DATA_DIR, 'leaderboard.json')

async function ensureFile() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true })
        await fs.access(FILE)
    } catch {
        const init: Db = { scores: [] }
        await fs.writeFile(FILE, JSON.stringify(init, null, 2), 'utf8')
    }
}

export async function readDb(): Promise<Db> {
    await ensureFile()
    const raw = await fs.readFile(FILE, 'utf8')
    return JSON.parse(raw) as Db
}

export async function writeDb(db: Db) {
    await ensureFile()
    await fs.writeFile(FILE, JSON.stringify(db, null, 2), 'utf8')
}

export function topScores(scores: ScoreRow[], limit = 50) {
    return scores
        .slice()
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
}
