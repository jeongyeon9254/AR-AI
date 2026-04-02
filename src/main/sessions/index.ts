import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { randomUUID } from 'crypto'

export interface Project {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface Session {
  id: string
  agentType: string
  projectId: string
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

export type KanbanStatus = '대기' | '진행중' | '검토중' | '완료'

export interface Todo {
  id: string
  agentType: string
  projectId: string
  content: string   // title 역할 (최대 100자)
  body: string      // 상세 설명 (최대 1000자)
  done: boolean
  kanbanStatus: KanbanStatus
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
    // 기본 테이블 생성 (기존 테이블은 변경 안 함)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

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

    // 마이그레이션: 컬럼 추가
    try {
      this.db.exec(`ALTER TABLE sessions ADD COLUMN projectId TEXT NOT NULL DEFAULT ''`)
    } catch { /* 이미 존재 */ }
    try {
      this.db.exec(`ALTER TABLE todos ADD COLUMN projectId TEXT NOT NULL DEFAULT ''`)
    } catch { /* 이미 존재 */ }
    try {
      this.db.exec(`ALTER TABLE todos ADD COLUMN kanbanStatus TEXT NOT NULL DEFAULT '대기'`)
    } catch { /* 이미 존재 */ }
    // body 컬럼 추가
    try {
      this.db.exec(`ALTER TABLE todos ADD COLUMN body TEXT NOT NULL DEFAULT ''`)
    } catch { /* 이미 존재 */ }
    // 상태 값 마이그레이션
    try {
      this.db.exec(`UPDATE todos SET kanbanStatus = '진행중' WHERE kanbanStatus = '진행'`)
      this.db.exec(`UPDATE todos SET kanbanStatus = '검토중' WHERE kanbanStatus = '검토'`)
    } catch { /* 무시 */ }

    // 마이그레이션 후 인덱스 생성
    try {
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(projectId)`)
    } catch { /* 무시 */ }
    try {
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_todos_project ON todos(projectId)`)
    } catch { /* 무시 */ }
  }

  // === Project CRUD ===
  createProject(name: string): Project {
    const project: Project = {
      id: randomUUID(),
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    this.db.prepare(
      'INSERT INTO projects (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)'
    ).run(project.id, project.name, project.createdAt, project.updatedAt)
    return project
  }

  listProjects(): Project[] {
    return this.db.prepare('SELECT * FROM projects ORDER BY createdAt ASC').all() as Project[]
  }

  getProjectById(id: string): Project | null {
    return (this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project) || null
  }

  deleteProject(id: string): boolean {
    // 세션/투두는 projectId로 연관되므로 함께 정리
    const sessions = this.db.prepare('SELECT id FROM sessions WHERE projectId = ?').all(id) as { id: string }[]
    for (const s of sessions) {
      this.db.prepare('DELETE FROM messages WHERE sessionId = ?').run(s.id)
    }
    this.db.prepare('DELETE FROM sessions WHERE projectId = ?').run(id)
    this.db.prepare('DELETE FROM todos WHERE projectId = ?').run(id)
    const result = this.db.prepare('DELETE FROM projects WHERE id = ?').run(id)
    return result.changes > 0
  }

  create(agentType: string, projectId = ''): Session {
    const session: Session = {
      id: randomUUID(),
      agentType,
      projectId,
      title: `${agentType} - 새 대화`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    this.db.prepare(
      'INSERT INTO sessions (id, agentType, projectId, title, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(session.id, session.agentType, session.projectId, session.title, session.createdAt, session.updatedAt)
    return session
  }

  list(): Session[] {
    return this.db.prepare('SELECT * FROM sessions ORDER BY updatedAt DESC').all() as Session[]
  }

  listByProject(projectId: string): Session[] {
    return this.db.prepare('SELECT * FROM sessions WHERE projectId = ? ORDER BY agentType ASC').all(projectId) as Session[]
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
  createTodo(agentType: string, content: string, projectId = '', body = ''): Todo {
    const todo: Todo = {
      id: randomUUID(),
      agentType,
      projectId,
      content,
      body,
      done: false,
      kanbanStatus: '대기',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    this.db.prepare(
      'INSERT INTO todos (id, agentType, projectId, content, body, done, kanbanStatus, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)'
    ).run(todo.id, todo.agentType, todo.projectId, todo.content, todo.body, todo.kanbanStatus, todo.createdAt, todo.updatedAt)
    return todo
  }

  listTodos(agentType: string): Todo[] {
    return this.db.prepare(
      'SELECT * FROM todos WHERE agentType = ? ORDER BY createdAt ASC'
    ).all(agentType).map((row: any) => ({ ...row, done: !!row.done, body: row.body ?? '' })) as Todo[]
  }

  listTodosByProject(projectId: string): Todo[] {
    return this.db.prepare(
      'SELECT * FROM todos WHERE projectId = ? ORDER BY createdAt ASC'
    ).all(projectId).map((row: any) => ({ ...row, done: !!row.done, body: row.body ?? '' })) as Todo[]
  }

  listAllTodos(): Todo[] {
    return this.db.prepare(
      'SELECT * FROM todos ORDER BY createdAt ASC'
    ).all().map((row: any) => ({ ...row, done: !!row.done, body: row.body ?? '' })) as Todo[]
  }

  updateTodo(id: string, updates: { content?: string; body?: string; done?: boolean; kanbanStatus?: KanbanStatus }): Todo | null {
    const existing = this.db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as any
    if (!existing) return null
    const content = updates.content ?? existing.content
    const body = updates.body ?? existing.body ?? ''
    const done = updates.done ?? !!existing.done
    const kanbanStatus = updates.kanbanStatus ?? existing.kanbanStatus ?? '대기'
    const updatedAt = new Date().toISOString()
    this.db.prepare(
      'UPDATE todos SET content = ?, body = ?, done = ?, kanbanStatus = ?, updatedAt = ? WHERE id = ?'
    ).run(content, body, done ? 1 : 0, kanbanStatus, updatedAt, id)
    return { ...existing, content, body, done, kanbanStatus, updatedAt }
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
