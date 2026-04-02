import { create } from 'zustand'

export interface Project {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export type KanbanStatus = '대기' | '진행' | '검토' | '완료'

export interface KanbanTodo {
  id: string
  agentType: string
  projectId: string
  content: string
  done: boolean
  kanbanStatus: KanbanStatus
  createdAt: string
  updatedAt: string
}

interface ProjectState {
  projects: Project[]
  activeProjectId: string | null
  projectTodos: Record<string, KanbanTodo[]> // projectId → todos

  loadProjects: () => Promise<void>
  createProject: (name: string) => Promise<Project>
  deleteProject: (id: string) => Promise<void>
  setActiveProject: (id: string | null) => void
  loadProjectTodos: (projectId: string) => Promise<void>
  updateTodoKanban: (todoId: string, projectId: string, kanbanStatus: KanbanStatus) => Promise<void>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  projectTodos: {},

  loadProjects: async () => {
    const projects = await window.electronAPI.listProjects()
    set({ projects })
  },

  createProject: async (name: string) => {
    const { project } = await window.electronAPI.createProject(name)
    set((state) => ({ projects: [...state.projects, project] }))
    return project
  },

  deleteProject: async (id: string) => {
    await window.electronAPI.deleteProject(id)
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      activeProjectId: state.activeProjectId === id ? null : state.activeProjectId
    }))
  },

  setActiveProject: (id: string | null) => set({ activeProjectId: id }),

  loadProjectTodos: async (projectId: string) => {
    const todos = await window.electronAPI.getProjectTodos(projectId)
    set((state) => ({
      projectTodos: { ...state.projectTodos, [projectId]: todos }
    }))
  },

  updateTodoKanban: async (todoId: string, projectId: string, kanbanStatus: KanbanStatus) => {
    await window.electronAPI.updateTodo(todoId, { kanbanStatus })
    set((state) => ({
      projectTodos: {
        ...state.projectTodos,
        [projectId]: (state.projectTodos[projectId] || []).map((t) =>
          t.id === todoId ? { ...t, kanbanStatus } : t
        )
      }
    }))
  }
}))
