import { defaults, type Inputs } from './model'

const KEY = 'baseco.micropileHub.projects.v1'

export interface SavedProject {
  id: string
  savedAt: string
  inputs: Inputs
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `p-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const probe = '__baseco_probe__'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return localStorage
  } catch {
    return null
  }
}

export function storageAvailable(): boolean {
  return storage() !== null
}

function normalize(raw: Partial<Inputs> | undefined): Inputs {
  const base = defaults()
  if (!raw) return base
  const next = { ...base }
  for (const key of Object.keys(base) as Array<keyof Inputs>) {
    const value = raw[key]
    if (typeof value === 'string' && key === 'projectName') next.projectName = value
    if (typeof value === 'number' && Number.isFinite(value) && key !== 'projectName') {
      next[key] = value
    }
  }
  return next
}

export function loadProjects(): SavedProject[] {
  const store = storage()
  if (!store) return []
  try {
    const raw = store.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is { id?: unknown; savedAt?: unknown; inputs?: Partial<Inputs> } => {
        return typeof item === 'object' && item !== null
      })
      .map((item) => ({
        id: typeof item.id === 'string' ? item.id : newId(),
        savedAt: typeof item.savedAt === 'string' ? item.savedAt : new Date(0).toISOString(),
        inputs: normalize(item.inputs),
      }))
  } catch {
    return []
  }
}

export function saveAll(projects: SavedProject[]): void {
  const store = storage()
  if (!store) throw new Error('This phone blocked local storage. The calculator still runs, but projects cannot be saved.')
  store.setItem(KEY, JSON.stringify(projects))
}

export function upsertProject(project: SavedProject): SavedProject[] {
  const next = [project, ...loadProjects().filter((item) => item.id !== project.id)]
  saveAll(next)
  return next
}

export function deleteProject(id: string): SavedProject[] {
  const next = loadProjects().filter((item) => item.id !== id)
  saveAll(next)
  return next
}
