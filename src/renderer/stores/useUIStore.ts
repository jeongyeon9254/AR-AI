import { create } from 'zustand'

export type ViewMode = 'home' | 'chat' | 'settings'

interface UIState {
  viewMode: ViewMode
  todoOpen: boolean
  sprintFile: string | null
  setViewMode: (mode: ViewMode) => void
  toggleTodo: () => void
  openSprintFile: (fileName: string) => void
  closeSprintFile: () => void
  goHome: () => void
}

export const useUIStore = create<UIState>((set) => ({
  viewMode: 'home',
  todoOpen: false,
  sprintFile: null,
  setViewMode: (viewMode: ViewMode) => set({ viewMode }),
  toggleTodo: () => set((state) => ({ todoOpen: !state.todoOpen })),
  openSprintFile: (fileName: string) => set({ sprintFile: fileName, todoOpen: false }),
  closeSprintFile: () => set({ sprintFile: null }),
  goHome: () => set({ viewMode: 'home', todoOpen: false, sprintFile: null })
}))
