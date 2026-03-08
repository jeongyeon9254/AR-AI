import { create } from 'zustand'

interface SprintDoc {
  name: string
  path: string
}

interface SprintState {
  docs: SprintDoc[]
  content: string
  loading: boolean
  loadDocs: () => Promise<void>
  readDoc: (fileName: string) => Promise<void>
}

export const useSprintStore = create<SprintState>((set) => ({
  docs: [],
  content: '',
  loading: false,

  loadDocs: async () => {
    const docs = await window.electronAPI.listSprintDocs()
    set({ docs })
  },

  readDoc: async (fileName: string) => {
    set({ loading: true })
    const result = await window.electronAPI.readSprintDoc(fileName)
    set({ content: result.success ? result.content || '' : `오류: ${result.error}`, loading: false })
  }
}))
