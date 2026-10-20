import { api } from './api'
import { useAuthStore } from '../store/auth.store'

export interface Option {
  value: string
  label: string
}

export interface RoomConfig {
  maxMembers: number
  idLength: number
  joinCodeLength: number
  title: { min: number; max: number }
  shortDescriptionMax: number
  tags: { max: number; minLength: number; maxLength: number }
  chatMessageMax: number
  purposes: Option[]
  languages: Option[]
}

export interface RoomView {
  id: string
  title: string
  shortDescription: string
  language: string
  purpose: string
  tags: string[]
  visibility: 'public' | 'private'
  maxMembers: number
  createdAt: number
  createdBy: string
  participantCount: number
  /** only present for the creator and for people already inside */
  joinCode?: string
}

export type RoomPreview =
  | (RoomView & { requiresJoinCode: false })
  | {
      id: string
      visibility: 'private'
      requiresJoinCode: true
      participantCount: number
      maxMembers: number
    }

export interface RoomFilters {
  q: string
  language: string
  purpose: string
  tags: string
  hasSpace: boolean
}

export interface CreateRoomInput {
  title: string
  shortDescription: string
  language: string
  purpose: string
  tags: string[]
  visibility: 'public' | 'private'
}

const token = () => useAuthStore.getState().token

export const roomsApi = {
  config: () => api<RoomConfig>('/rooms/config', { token: token() }),

  list: (f: RoomFilters) => {
    const p = new URLSearchParams()
    if (f.q.trim()) p.set('q', f.q.trim())
    if (f.language) p.set('language', f.language)
    if (f.purpose) p.set('purpose', f.purpose)
    if (f.tags.trim()) p.set('tags', f.tags.trim())
    if (f.hasSpace) p.set('hasSpace', 'true')
    const qs = p.toString()
    return api<RoomView[]>(`/rooms${qs ? `?${qs}` : ''}`, { token: token() })
  },

  create: (input: CreateRoomInput) =>
    api<RoomView>('/rooms', { method: 'POST', body: input, token: token() }),

  preview: (roomId: string) => api<RoomPreview>(`/rooms/${roomId}`, { token: token() }),
}

let configPromise: Promise<RoomConfig> | null = null
/** Config is static per server start, so fetch it once. */
export function loadRoomConfig(): Promise<RoomConfig> {
  configPromise ??= roomsApi.config().catch((err) => {
    configPromise = null
    throw err
  })
  return configPromise
}

export function labelFor(options: Option[] | undefined, value: string): string {
  return options?.find((o) => o.value === value)?.label ?? value
}
