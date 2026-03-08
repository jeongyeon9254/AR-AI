import { create } from 'zustand'

export interface Todo {
  id: string
  agentType: string
  content: string
  done: boolean
  createdAt: string
  updatedAt: string
}

interface TodoState {
  todos: Todo[]
  loadTodos: (agentType: string) => Promise<void>
  addTodo: (agentType: string, content: string) => Promise<void>
  toggleTodo: (id: string, done: boolean) => Promise<void>
  updateTodoContent: (id: string, content: string) => Promise<void>
  removeTodo: (id: string) => Promise<void>
}

export const useTodoStore = create<TodoState>((set) => ({
  todos: [],

  loadTodos: async (agentType: string) => {
    const todos = await window.electronAPI.listTodos(agentType)
    set({ todos })
  },

  addTodo: async (agentType: string, content: string) => {
    const todo = await window.electronAPI.createTodo(agentType, content)
    set((state) => ({ todos: [...state.todos, todo] }))
  },

  toggleTodo: async (id: string, done: boolean) => {
    const updated = await window.electronAPI.updateTodo(id, { done })
    if (updated) {
      set((state) => ({
        todos: state.todos.map((t) => (t.id === id ? { ...t, done } : t))
      }))
    }
  },

  updateTodoContent: async (id: string, content: string) => {
    const updated = await window.electronAPI.updateTodo(id, { content })
    if (updated) {
      set((state) => ({
        todos: state.todos.map((t) => (t.id === id ? { ...t, content } : t))
      }))
    }
  },

  removeTodo: async (id: string) => {
    await window.electronAPI.deleteTodo(id)
    set((state) => ({ todos: state.todos.filter((t) => t.id !== id) }))
  }
}))
