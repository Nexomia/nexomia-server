import myzod, { Infer } from 'myzod'
import { EmojiPack, EmojiPackOwnerInfo } from './../schemas/emojiPack.schema'

export const EmojiPackResponseValidate = (EmojiPack: EmojiPack) => {
  return <EmojiPackResponse>(
    EmojiPackResponseSchema.allowUnknownKeys().parse(EmojiPack)
  )
}

export const EmojiPackOwnerResponseSchema = myzod.object({
  id: myzod.string(),
  username: myzod.string(),
  discriminator: myzod.string(),
  avatar: myzod.string(),
  status: myzod.string(),
})

export type EmojiPackOwnerResponse = Infer<typeof EmojiPackResponseSchema>

export const EmojiPackOwnerResponseValidate = (
  EmojiPackOwner: EmojiPackOwnerInfo,
) => {
  return <EmojiPackOwnerResponse>(
    EmojiPackResponseSchema.allowUnknownKeys().parse(EmojiPackOwner)
  )
}

export const EmojiPackResponseSchema = myzod.object({
  id: myzod.string(),
  type: myzod.number(),
  name: myzod.string(),
  description: myzod.string().optional(),
  icon: myzod.string().optional(),
  owner_id: myzod.string(),
  owner: EmojiPackOwnerResponseSchema.allowUnknownKeys(),
  stats: myzod
    .object({
      users: myzod.number(),
      servers: myzod.number(),
    })
    .allowUnknownKeys()
    .optional(),
  emojis: myzod.array(myzod.unknown()).optional(),
})

export type EmojiPackResponse = Infer<typeof EmojiPackResponseSchema>
