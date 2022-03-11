import myzod, { Infer } from 'myzod'
import { Channel } from './../../channels/schemas/channel.schema'

const UpdatedChannelsPositionsSchema = myzod.object({
  id: myzod.string(),
  parent_id: myzod.string(),
  position: myzod.number(),
})

export type UpdatedChannelsPositions = Infer<
  typeof UpdatedChannelsPositionsSchema
>

export const UpdatedChannelsPositionsValidate = (channel: Channel) => {
  return <UpdatedChannelsPositions>(
    UpdatedChannelsPositionsSchema.allowUnknownKeys().parse(channel)
  )
}
