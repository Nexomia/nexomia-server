import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

@Schema({ _id: false, versionKey: false })
export class Invite {
  @Prop({ unique: true })
  code: string

  @Prop()
  guild_id?: string

  @Prop()
  channel_id?: string

  @Prop()
  inviter_id?: string

  @Prop()
  expires_at?: number

  @Prop()
  max_uses?: number

  @Prop({ default: 0 })
  uses?: number

  @Prop({ default: [] })
  user_ids?: string[]

  @Prop({ default: false })
  temporary?: boolean
}

export type InviteDocument = Invite & Document

export const InviteSchema = SchemaFactory.createForClass(Invite)
