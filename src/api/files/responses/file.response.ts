import myzod, { Infer } from 'myzod'
import { File } from './../schemas/file.schema'

const FileResponseSchema = myzod.object({
  id: myzod.string(),
  type: myzod.number(),
  name: myzod.string(),
  mime_type: myzod.string(),
  size: myzod.number(),
  owner_id: myzod.string(),
  url: myzod.string(),
  data: myzod
    .object({
      width: myzod.number().optional(),
      height: myzod.number().optional(),
      preview_url: myzod.string().optional(),
      animated: myzod.boolean().optional(),
    })
    .allowUnknownKeys()
    .optional(),
})

export type FileResponse = Infer<typeof FileResponseSchema>

export const FileResponseValidate = (file: File) => {
  return <FileResponse>FileResponseSchema.allowUnknownKeys().parse(file)
}
