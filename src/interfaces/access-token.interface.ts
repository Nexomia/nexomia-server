export class AccessToken {
  id: string
  uid: string
  exp: number
  rules?: number | Array<string>
  bot: boolean
  hash?: string
}
