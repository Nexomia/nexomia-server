import myzod, { Infer } from 'myzod'
import { EmojiPackResponseSchema } from 'api/emojis/responses/emojiPack.response'
import { User } from './../schemas/user.schema'

const UserResponseSchema = myzod.object({
  id: myzod.string(),
  username: myzod.string(),
  discriminator: myzod.string(),
  email: myzod.string(),
  avatar: myzod.string().optional(),
  banner: myzod.string().optional(),
  presence: myzod.number(),
  status: myzod.string().optional(),
  description: myzod.string().optional(),
  emoji_packs: myzod
    .array(EmojiPackResponseSchema.allowUnknownKeys().optional())
    .optional(),
  verified: myzod.boolean(),
  premium_type: myzod.boolean(),
  public_flags: myzod.number().optional(),
  connected: myzod.boolean().optional(),
})

export type UserResponse = Infer<typeof UserResponseSchema>

export const UserResponseValidate = (user: User) => {
  return <UserResponse>UserResponseSchema.allowUnknownKeys().parse(user)
}
