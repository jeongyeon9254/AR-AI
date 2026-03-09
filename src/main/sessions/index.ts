import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { randomUUID } from 'crypto'

export interface Session {
  id: string
  agentType: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface Todo {
  id: string
  agentType: string
  content: string
  done: boolean
  createdAt: string
  updatedAt: string
}

export class SessionManager {
  private db: Database.Database

  constructor() {
    const dbPath = join(app.getPath('userData'), 'sessions.db')
    this.db = new Database(dbPath)
    this.init()
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        agentType TEXT NOT NULL,
        title TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS todos (
        id TEXT PRIMARY KEY,
        agentType TEXT NOT NULL,
        content TEXT NOT NULL,
        done INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_messages_session_created
        ON messages(sessionId, createdAt);
    `)
  }

  create(agentType: string): Session {
    const session: Session = {
      id: randomUUID(),
      agentType,
      title: `${agentType} - 새 대화`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    this.db.prepare(
      'INSERT INTO sessions (id, agentType, title, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)'
    ).run(session.id, session.agentType, session.title, session.createdAt, session.updatedAt)
    return session
  }

  list(): Session[] {
    return this.db.prepare('SELECT * FROM sessions ORDER BY updatedAt DESC').all() as Session[]
  }

  get(id: string): { session: Session; messages: Message[] } | null {
    const session = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session | undefined
    if (!session) return null
    const messages = this.db.prepare(
      'SELECT * FROM messages WHERE sessionId = ? ORDER BY createdAt ASC'
    ).all(id) as Message[]
    return { session, messages }
  }

  /** 세션 메타데이터만 조회 (메시지 로드 없이) */
  getSession(id: string): Session | null {
    return (this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session) || null
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id)
    return result.changes > 0
  }

  // === Todo CRUD ===
  createTodo(agentType: string, content: string): Todo {
    const todo: Todo = {
      id: randomUUID(),
      agentType,
      content,
      done: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    this.db.prepare(
      'INSERT INTO todos (id, agentType, content, done, createdAt, updatedAt) VALUES (?, ?, ?, 0, ?, ?)'
    ).run(todo.id, todo.agentType, todo.content, todo.createdAt, todo.updatedAt)
    return todo
  }

  listTodos(agentType: string): Todo[] {
    return this.db.prepare(
      'SELECT * FROM todos WHERE agentType = ? ORDER BY createdAt ASC'
    ).all(agentType).map((row: any) => ({ ...row, done: !!row.done })) as Todo[]
  }

  listAllTodos(): Todo[] {
    return this.db.prepare(
      'SELECT * FROM todos ORDER BY createdAt ASC'
    ).all().map((row: any) => ({ ...row, done: !!row.done })) as Todo[]
  }

  updateTodo(id: string, updates: { content?: string; done?: boolean }): Todo | null {
    const existing = this.db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as any
    if (!existing) return null
    const content = updates.content ?? existing.content
    const done = updates.done ?? !!existing.done
    const updatedAt = new Date().toISOString()
    this.db.prepare(
      'UPDATE todos SET content = ?, done = ?, updatedAt = ? WHERE id = ?'
    ).run(content, done ? 1 : 0, updatedAt, id)
    return { ...existing, content, done, updatedAt }
  }

  deleteTodo(id: string): boolean {
    return this.db.prepare('DELETE FROM todos WHERE id = ?').run(id).changes > 0
  }

  /** 세션의 메시지 수 반환 */
  getMessageCount(sessionId: string): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE sessionId = ?').get(sessionId) as any
    return row?.cnt || 0
  }

  /** 세션의 오래된 메시지 정리 (최근 keepCount개만 유지) */
  pruneMessages(sessionId: string, keepCount = 200): number {
    const result = this.db.prepare(`
      DELETE FROM messages WHERE sessionId = ? AND id NOT IN (
        SELECT id FROM messages WHERE sessionId = ? ORDER BY createdAt DESC LIMIT ?
      )
    `).run(sessionId, sessionId, keepCount)
    return result.changes
  }

  /** 세션 메시지 전체 삭제 (대화 초기화) */
  clearMessages(sessionId: string): number {
    const result = this.db.prepare('DELETE FROM messages WHERE sessionId = ?').run(sessionId)
    return result.changes
  }

  /** DB 파일 크기 반환 (bytes) */
  getDbSize(): number {
    const fs = require('fs')
    const dbPath = join(app.getPath('userData'), 'sessions.db')
    try {
      return fs.statSync(dbPath).size
    } catch {
      return 0
    }
  }

  /** SQLite VACUUM 실행 (디스크 공간 회수) */
  vacuum(): void {
    this.db.exec('VACUUM')
  }

  addMessage(sessionId: string, role: 'user' | 'assistant', content: string): Message {
    const message: Message = {
      id: randomUUID(),
      sessionId,
      role,
      content,
      createdAt: new Date().toISOString()
    }
    this.db.prepare(
      'INSERT INTO messages (id, sessionId, role, content, createdAt) VALUES (?, ?, ?, ?, ?)'
    ).run(message.id, message.sessionId, message.role, message.content, message.createdAt)
    this.db.prepare('UPDATE sessions SET updatedAt = ? WHERE id = ?')
      .run(new Date().toISOString(), sessionId)
    return message
  }
}
