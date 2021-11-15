import { EmojiPackResponseSchema } from 'api/emojis/responses/emojiPack.response'
import myzod, { Infer } from 'myzod'
import { Emoji } from './../schemas/emoji.schema'

export const EmojiResponseSchema = myzod.object({
  id: myzod.string(),
  pack_id: myzod.string(),
  name: myzod.string(),
  // user_id: myzod.string(),
  words: myzod.array(myzod.string()).optional(),
  animated: myzod.boolean().optional(),
  deleted: myzod.boolean().optional(),
  url: myzod.string(),
  emoji_pack: EmojiPackResponseSchema.allowUnknownKeys().optional(),
})

export type EmojiResponse = Infer<typeof EmojiResponseSchema>

export const EmojiResponseValidate = (Emoji: Emoji) => {
  return <EmojiResponse>EmojiResponseSchema.allowUnknownKeys().parse(Emoji)
}
