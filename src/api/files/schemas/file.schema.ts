import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type FileDocument = File & Document

export class FileData {
  name?: string
  preview_url?: string
  width?: number
  height?: number
  animated?: boolean
}

export class VK {
  file_id: string
  file_url: string
  file_url_updated: number
  file_width: number
  file_heigth: number
  file_preview: string
}

@Schema({ versionKey: false })
export class File {
  @Prop({ unique: true })
  id: string

  @Prop()
  type: number

  @Prop()
  name: string

  @Prop()
  mime_type: string

  @Prop()
  size: number

  @Prop()
  file_server: number

  @Prop()
  owner_id: string

  @Prop()
  provided: string[]

  @Prop({ default: false })
  saved: boolean

  @Prop()
  data: FileData

  url: string
}

export enum FileServer {
  VK = 1,
  SELECTEL = 2,
}

export enum FileType {
  ATTACHMENT = 1,
  AVATAR = 2,
  BANNER = 3,
  BACKGROUND = 4,
  STICKER = 5,
  EMOJI = 6,
  VOICE = 7,
}
export const AllowedFileExtensions = {
  AVATAR: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
  BANNER: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
  BACKGROUND: ['png', 'jpg', 'jpeg', 'webp'],
  STICKER: ['png', 'gif', 'webp'],
  EMOJI: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
  VOICE: ['opus'],
}

export const FileSchema = SchemaFactory.createForClass(File)
