import { create } from 'zustand'

const useAppStore = create((set) => ({
  projects: [],
  turbines: [],
  selectedTurbineIds: [],

  setProjects: (projects) => set({ projects }),
  setTurbines: (turbines) => set({ turbines }),

  selectTurbine: (id) =>
    set((state) => {
      if (state.selectedTurbineIds.includes(id)) return state
      if (state.selectedTurbineIds.length >= 3) return state
      return { selectedTurbineIds: [...state.selectedTurbineIds, id] }
    }),

  deselectTurbine: (id) =>
    set((state) => ({
      selectedTurbineIds: state.selectedTurbineIds.filter((t) => t !== id),
    })),

  clearSelection: () => set({ selectedTurbineIds: [] }),
}))

export default useAppStore
