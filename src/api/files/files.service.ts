import { UniqueID } from 'nodejs-snowflake'
import { InjectModel } from '@nestjs/mongoose'
import {
  Injectable,
  PayloadTooLargeException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common'
import { Model } from 'mongoose'
import axios from 'axios'
import fs from 'promise-fs'
import * as ffmpeg from 'fluent-ffmpeg'
import {
  File,
  FileDocument,
  FileServer,
  FileType,
  AllowedFileExtensions,
  FileData,
} from './schemas/file.schema'
import { config } from './../../app.config'
import { FileResponseValidate } from './responses/file.response'

@Injectable()
export class FilesService {
  constructor(@InjectModel(File.name) private fileModel: Model<FileDocument>) {}

  async getFile(fileId, fileName, res, preview?) {
    // const file = await this.fileModel.findOne({ id: fileId, name: fileName })
    // if (!file) throw new NotFoundException()
    // if (preview && !file.vk.file_preview) throw new NotFoundException()
    // if (file.mime_type.startsWith('image')) {
    //   res.setHeader('Cache-Control', 'public')
    //   res.setHeader('Cache-Control', 'max-age=360000')
    // }
    // res.setHeader('Content-type', preview ? 'image/jpeg' : file.mime_type)
    // res.setHeader('content-disposition', `attachment filename*=UTF-8''${this.fixedEncodeURIComponent(preview ? 'preview' : '' + file.name)}`)
    // if (!preview) res.setHeader('Content-Length', file.size)
    // const response = await axios({
    //   url: preview ? file.vk.file_preview : file.vk.file_url,
    //   method: 'GET',
    //   responseType: 'stream'
    // })
    // response.data.pipe(res)
  }

  async getFileServer(fileType, userId) {
    if (!fileType || fileType < 1 || fileType > 4)
      throw new BadRequestException()

    const file = new this.fileModel()
    file.id = new UniqueID(config.snowflake).getUniqueID()
    file.type = fileType
    file.owner_id = userId
    file.file_server = FileServer.SELECTEL
    await file.save()

    const upload_url = `http://${config.domain}/api/files/${file.id}`
    return { upload_url }
  }

  async uploadFile(multerFile: Express.Multer.File, fileId, userId) {
    if (!multerFile) throw new BadRequestException()
    if (multerFile.size > 52428800) throw new PayloadTooLargeException()

    const file = await this.fileModel.findOne({ id: fileId, owner_id: userId })
    if (!file) throw new BadRequestException()
    if (file.saved) throw new ForbiddenException()

    if (
      (file.type === FileType.AVATAR &&
        !AllowedFileExtensions.AVATAR.includes(
          multerFile.mimetype.split('/')[1],
        )) ||
      (file.type === FileType.BANNER &&
        !AllowedFileExtensions.BANNER.includes(
          multerFile.mimetype.split('/')[1],
        )) ||
      (file.type === FileType.BACKGROUND &&
        !AllowedFileExtensions.BACKGROUND.includes(
          multerFile.mimetype.split('/')[1],
        ))
    )
      throw new BadRequestException(
        Object.keys(AllowedFileExtensions)[file.type - 2] +
          ' must be with one of these extensions: ' +
          AllowedFileExtensions[
            Object.keys(AllowedFileExtensions)[file.type - 2]
          ].join(', '),
      )

    const mimetype = multerFile.mimetype.split('/')[0]

    let preview: FilePreview
    if (file.type === FileType.ATTACHMENT) {
      if (['video', 'image', 'audio'].includes(mimetype)) {
        preview = (
          await Promise.all([
            this.uploadToServer(file.id, {
              mime: multerFile.mimetype,
              name: multerFile.originalname,
              size: multerFile.size,
              path: multerFile.path,
            }),
            this.getAndUploadPreview(file.id, multerFile),
          ])
        )[1]
      } else {
        await this.uploadToServer(file.id, {
          mime: multerFile.mimetype,
          name: multerFile.originalname,
          size: multerFile.size,
          path: multerFile.path,
        })
      }
    } else if (file.type === FileType.AVATAR) {
      await this.compressAndUploadAvatar(file.id, multerFile)
      multerFile.originalname = 'avatar.webp'
    }
    await fs.unlink(multerFile.path)
    if (preview)
      file.data = {
        name: preview.name,
        width: preview.width,
        height: preview.height,
      }

    file.mime_type = multerFile.mimetype
    file.name = multerFile.originalname
    file.size = multerFile.size
    file.saved = true
    file.markModified('data')
    await file.save()

    const extendedFile = file.toObject()
    extendedFile.url = `https://cdn.nx.wtf/${
      file.id
    }/${this.fixedEncodeURIComponent(file.name)}`
    if (preview)
      extendedFile.data.preview_url = `https://cdn.nx.wtf/${file.id}/${preview.name}`

    return FileResponseValidate(extendedFile)
  }

  async getFileInfo(fileId): Promise<File> {
    const file = await this.fileModel.findOne({ id: fileId })
    const extendedFile = file.toObject()
    extendedFile.url = `https://cdn.nx.wtf/${
      file.id
    }/${this.fixedEncodeURIComponent(file.name)}`
    if (file.data)
      extendedFile.data.preview_url = `https://cdn.nx.wtf/${file.id}/${file.data.name}`

    return extendedFile
  }

  private getApiToken = async () => {
    return (
      await axios({
        method: 'get',
        url: 'https://api.selcdn.ru/auth/v1.0',
        headers: {
          'X-Auth-User': config.selectel.user,
          'X-Auth-Key': config.selectel.pass,
        },
      })
    ).headers['x-storage-token']
  }

  private uploadToServer = async (id: string, file: UploadData) => {
    return axios.put(
      `https://api.selcdn.ru/v1/SEL_${config.selectel.user}/${
        config.selectel.container
      }/${id}/${this.fixedEncodeURIComponent(file.name)}`,
      await fs.createReadStream(file.path),
      {
        headers: {
          'Content-Type': file.mime,
          'Content-Length': file.size,
          'X-Auth-Token': await this.getApiToken(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      },
    )
  }

  private fixedEncodeURIComponent = (str: string) => {
    return encodeURIComponent(str)
      .replace(/['()]/g, escape)
      .replace(/\*/g, '%2A')
      .replace(/%(?:7C|60|5E)/g, unescape)
  }
  private getFileData = async (path): Promise<ffmpeg.FfprobeData> => {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(path, async (err, data) => {
        resolve(data)
      })
    })
  }

  private getAndUploadPreview = async (
    fileId: string,
    file: Express.Multer.File,
  ): Promise<FilePreview> => {
    const filedata = (await this.getFileData(file.path)).streams
    let filename: string
    let ffOutputOptions: string[]
    let mime: string

    if (filedata[0].codec_type === 'video') {
      filename = 'preview.jpg'
      mime = 'image/jpeg'
      ffOutputOptions = ['-frames:v 1', '-compression_level 100']
    } else if (filedata[0].codec_type === 'images') {
      filename = 'preview.' + filedata[0].codec_name
      mime = 'image/' + filedata[0].codec_name
      ffOutputOptions = ['-vf scale=iw/2.5:ih/2.5', '-compression_level 100']
    } else if (filedata[0].codec_type === 'audio' && filedata[1]) {
      filename = 'cover.jpg'
      mime = 'image/jpeg'
      ffOutputOptions = ['-filter:v scale=-2:256', '-an']
    } else return
    const filePreviewPath = await new Promise((resolve, reject) => {
      ffmpeg(file.path)
        .outputOptions(ffOutputOptions)
        .saveToFile(`${file.path}.${filename}`)
        .on('end', () => {
          resolve(`${file.path}.${filename}`)
        })
    })
    const data = (await this.getFileData(filePreviewPath)).streams[0]
    const upload: UploadData = {
      name: filename,
      size: (await fs.stat(`${file.path}.${filename}`)).size,
      path: `${file.path}.${filename}`,
      mime,
    }
    await this.uploadToServer(fileId, upload)
    await fs.unlink(upload.path)
    const fileData: FilePreview = {
      name: filename,
      width: data.width,
      height: data.height,
    }
    return fileData
  }

  private compressAndUploadAvatar = async (
    fileId: string,
    file: Express.Multer.File,
  ) => {
    return Promise.all([
      new Promise((resolve, reject) => {
        ffmpeg(file.path)
          .outputOptions(['-vf scale=-256:256'])
          .saveToFile(`${file.path}.256.webp`)
          .on('end', async () => {
            this.uploadToServer(fileId, {
              name: 'avatar.webp',
              mime: 'image/webp',
              size: (await fs.stat(`${file.path}.256.webp`)).size,
              path: `${file.path}.256.webp`,
            }).then(async () => {
              fs.unlink(`${file.path}.256.webp`)
              resolve(true)
            })
          })
      }),
      new Promise((resolve, reject) => {
        ffmpeg(file.path)
          .outputOptions(['-vf scale=128:128'])
          .saveToFile(`${file.path}.128.webp`)
          .on('end', async () => {
            this.uploadToServer(fileId, {
              name: 'avatar_128.webp',
              mime: 'image/webp',
              size: (await fs.stat(`${file.path}.128.webp`)).size,
              path: `${file.path}.128.webp`,
            }).then(async () => {
              fs.unlink(`${file.path}.128.webp`)
              resolve(true)
            })
          })
      }),
      new Promise((resolve, reject) => {
        ffmpeg(file.path)
          .outputOptions(['-vf scale=64:64'])
          .saveToFile(`${file.path}.64.webp`)
          .on('end', async () => {
            this.uploadToServer(fileId, {
              name: 'avatar_64.webp',
              mime: 'image/webp',
              size: (await fs.stat(`${file.path}.64.webp`)).size,
              path: `${file.path}.64.webp`,
            }).then(async () => {
              fs.unlink(`${file.path}.64.webp`)
              resolve(true)
            })
          })
      }),
      new Promise((resolve, reject) => {
        ffmpeg(file.path)
          .outputOptions(['-vf scale=32:32'])
          .saveToFile(`${file.path}.32.webp`)
          .on('end', async () => {
            this.uploadToServer(fileId, {
              name: 'avatar_32.webp',
              mime: 'image/webp',
              size: (await fs.stat(`${file.path}.32.webp`)).size,
              path: `${file.path}.32.webp`,
            }).then(async () => {
              fs.unlink(`${file.path}.32.webp`)
              resolve(true)
            })
          })
      }),
    ])
  }
}

class FilePreview {
  name: string
  width: number
  height: number
}

class UploadData {
  name: string
  mime: string
  size: number
  path: string
}
