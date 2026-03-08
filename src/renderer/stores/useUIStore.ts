import { create } from 'zustand'

type ViewMode = 'chat' | 'settings'

interface UIState {
  viewMode: ViewMode
  todoOpen: boolean
  sprintFile: string | null  // 현재 열린 스프린트 문서 (null이면 닫힘)
  setViewMode: (mode: ViewMode) => void
  toggleTodo: () => void
  openSprintFile: (fileName: string) => void
  closeSprintFile: () => void
}

export const useUIStore = create<UIState>((set) => ({
  viewMode: 'chat',
  todoOpen: false,
  sprintFile: null,
  setViewMode: (viewMode: ViewMode) => set({ viewMode }),
  toggleTodo: () => set((state) => ({ todoOpen: !state.todoOpen })),
  openSprintFile: (fileName: string) => set({ sprintFile: fileName, todoOpen: false }),
  closeSprintFile: () => set({ sprintFile: null })
}))
