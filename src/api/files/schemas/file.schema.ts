import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type FileDocument = File & Document

export class Permissions {
  allow: number
  deny: number
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
  vk: VK

  @Prop()
  owner_id: string

  @Prop()
  provided: string[]

  @Prop({ default: false })
  saved: boolean

  url: string
  preview: string
  width: number
  height: number
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
}
export const AllowedFileExtensions = {
  AVATAR: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
  BANNER: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
  BACKGROUND: ['png', 'jpg', 'jpeg', 'webp'],
}
export const FileSchema = SchemaFactory.createForClass(File)
