export class CachedUser {
  id: string
  guilds: string[]
  channels: string[]
  friends: string[]
  connections: UserConnection[]
}

export class UserConnection {
  id: string
  type: number
}