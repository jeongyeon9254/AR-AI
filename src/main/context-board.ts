import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { randomUUID } from 'crypto'

export interface ContextEntry {
  id: string
  agentType: string
  summary: string
  createdAt: string
}

class ContextBoard {
  private db: Database.Database

  constructor() {
    const dbPath = join(app.getPath('userData'), 'sessions.db')
    this.db = new Database(dbPath)
    this.init()
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS context_board (
        id TEXT PRIMARY KEY,
        agentType TEXT NOT NULL,
        summary TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
    `)
  }

  add(agentType: string, summary: string): ContextEntry {
    const entry: ContextEntry = {
      id: randomUUID(),
      agentType,
      summary,
      createdAt: new Date().toISOString()
    }
    this.db.prepare(
      'INSERT INTO context_board (id, agentType, summary, createdAt) VALUES (?, ?, ?, ?)'
    ).run(entry.id, entry.agentType, entry.summary, entry.createdAt)

    // 에이전트당 최근 10개만 유지
    this.db.prepare(`
      DELETE FROM context_board WHERE agentType = ? AND id NOT IN (
        SELECT id FROM context_board WHERE agentType = ? ORDER BY createdAt DESC LIMIT 10
      )
    `).run(agentType, agentType)

    return entry
  }

  getAll(): ContextEntry[] {
    return this.db.prepare(
      'SELECT * FROM context_board ORDER BY createdAt DESC LIMIT 50'
    ).all() as ContextEntry[]
  }

  /** 시스템 프롬프트에 삽입할 공유 컨텍스트 텍스트 생성 */
  buildContextText(): string {
    const entries = this.getAll()
    if (entries.length === 0) return ''

    const agentLabels: Record<string, string> = {
      'fe-developer': 'FE 개발자',
      'be-developer': 'BE 개발자',
      'issue-collector': '이슈 수집가',
      'policy-expert': '정책 전문가',
      'qa-expert': 'QA 전문가',
      'po': 'PO'
    }

    const lines = entries.map((e) => {
      const label = agentLabels[e.agentType] || e.agentType
      const date = e.createdAt.slice(0, 10)
      return `[${date}] ${label}: ${e.summary}`
    })

    return `\n\n---\n📋 팀 공유 컨텍스트 보드 (다른 에이전트들의 최근 활동):\n${lines.join('\n')}\n---`
  }
}

let instance: ContextBoard | null = null

export function getContextBoard(): ContextBoard {
  if (!instance) instance = new ContextBoard()
  return instance
}
