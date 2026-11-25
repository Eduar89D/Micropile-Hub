import { afterEach, describe, expect, it } from 'vitest'
import { defaults } from './model'
import { deleteProject, loadProjects, newId, upsertProject, type SavedProject } from './storage'

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => {
      map.delete(key)
    },
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
  }
}

afterEach(() => {
  localStorage.clear()
})

describe('saved projects', () => {
  it('saves, reloads, and deletes a project', () => {
    Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage(), configurable: true })
    const project: SavedProject = {
      id: newId(),
      savedAt: '2026-11-25T00:00:00.000Z',
      inputs: { ...defaults(), projectName: 'River Road', pileCount: 10 },
    }
    upsertProject(project)
    const loaded = loadProjects()
    expect(loaded).toHaveLength(1)
    expect(loaded[0]?.inputs.projectName).toBe('River Road')
    expect(loaded[0]?.inputs.pileCount).toBe(10)
    expect(loaded[0]?.inputs.lbPerBag).toBe(94)
    deleteProject(project.id)
    expect(loadProjects()).toHaveLength(0)
  })
})
