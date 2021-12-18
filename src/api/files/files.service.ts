import CP from 'child_process'
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
import ffmpegPath from 'ffmpeg-static'
import ffprobePath from 'ffprobe-static'
import ffmpeg from 'fluent-ffmpeg'
import {
  File,
  FileDocument,
  FileServer,
  FileType,
  AllowedFileExtensions,
} from './schemas/file.schema'
import { config } from './../../app.config'
import { FileResponseValidate } from './responses/file.response'

@Injectable()
export class FilesService {
  constructor(@InjectModel(File.name) private fileModel: Model<FileDocument>) {
    ffmpeg().setFfmpegPath(ffmpegPath)
    ffmpeg().setFfprobePath(ffprobePath.path)
  }

  /*async getFile(fileId, fileName, res, preview?) {
    const file = await this.fileModel.findOne({ id: fileId, name: fileName })
    if (!file) throw new NotFoundException()
    if (preview && !file.vk.file_preview) throw new NotFoundException()
    if (file.mime_type.startsWith('image')) {
      res.setHeader('Cache-Control', 'public')
      res.setHeader('Cache-Control', 'max-age=360000')
    }
    res.setHeader('Content-type', preview ? 'image/jpeg' : file.mime_type)
    res.setHeader('content-disposition', `attachment filename*=UTF-8''${this.fixedEncodeURIComponent(preview ? 'preview' : '' + file.name)}`)
    if (!preview) res.setHeader('Content-Length', file.size)
    const response = await axios({
      url: preview ? file.vk.file_preview : file.vk.file_url,
      method: 'GET',
      responseType: 'stream'
    })
    response.data.pipe(res)
  }*/

  async getFileServer(fileType, userId) {
    if (!fileType || fileType < 1 || fileType > 7)
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
    multerFile.mimetype = this.getMimeFromPath(multerFile.path)

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

    let uplData: UploadData[]
    if (file.type === FileType.ATTACHMENT) {
      uplData = await this.uploadAttachment(file.id, multerFile)
    } else if (file.type === FileType.AVATAR) {
      uplData = await this.cropAndUploadAvatar(file.id, multerFile.path)
    } else if (file.type === FileType.BANNER) {
      uplData = await this.cropAndUploadBanner(file.id, multerFile.path)
    } else if (file.type === FileType.EMOJI) {
      uplData = await this.scaleAndUploadEmoji(file.id, multerFile.path)
    } else if (file.type === FileType.STICKER) {
      uplData = await this.scaleAndUploadSticker(file.id, multerFile.path)
    } else if (file.type === FileType.VOICE) {
      uplData = await this.checkAndUploadVoice(file.id, multerFile.path)
    }
    await fs.unlink(multerFile.path)
    if (uplData[0].error) throw new BadRequestException(uplData[0].error)
    console.log(uplData[0])

    file.name = uplData[0].name
    file.mime_type = uplData[0].mime
    file.size = uplData[0].size

    if (uplData[0].preview) {
      file.data = {
        name: uplData[0].preview.name,
        width: uplData[0].preview.width,
        height: uplData[0].preview.height,
      }
      file.markModified('data')
    }
    if (uplData[0].animated) {
      if (!file.data) file.data = {}
      file.data.animated = true
      file.markModified('data')
    }
    file.saved = true
    await file.save()

    const extendedFile = file.toObject()
    extendedFile.url = `https://cdn.nx.wtf/${
      file.id
    }/${this.fixedEncodeURIComponent(file.name)}`
    if (file.data?.name)
      extendedFile.data.preview_url = `https://cdn.nx.wtf/${file.id}/${file.data.name}`

    return FileResponseValidate(extendedFile)
  }

  async getFileInfo(fileId): Promise<File> {
    const file = await this.fileModel.findOne({ id: fileId })
    const extendedFile = file.toObject()
    extendedFile.url =
      'https://cdn.nx.wtf/' +
      `${file.id}/${this.fixedEncodeURIComponent(file.name)}`
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
    return new Promise((resolve) => {
      ffmpeg.ffprobe(path, async (err, data) => {
        resolve(data)
      })
    })
  }

  private getAndUploadPreview = async (
    fileId: string,
    file: Express.Multer.File,
  ): Promise<FilePreview> => {
    const ffpData = await this.getFileData(file.path)
    let filedata
    if (ffpData?.streams) filedata = ffpData.streams
    else return

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
      ffOutputOptions = ['-vf -compression_level 100']
    } else if (filedata[0].codec_type === 'audio' && filedata[1]) {
      filename = 'cover.jpg'
      mime = 'image/jpeg'
      ffOutputOptions = ['-vf scale=256:256', '-an']
    } else return
    const filePreviewPath = await new Promise((resolve) => {
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

  private uploadAttachment = async (
    fileId: string,
    file: Express.Multer.File,
  ): Promise<UploadData[]> => {
    const fileInfo = await this.getFileData(file.path)
    let animated = false
    if (fileInfo?.streams[0].avg_frame_rate !== '0/0') animated = true
    const data: UploadData = {
      mime: file.mimetype,
      name: file.originalname,
      size: file.size,
      path: file.path,
      animated,
    }
    const files = await Promise.all([
      this.uploadToServer(fileId, data),
      this.getAndUploadPreview(fileId, file),
    ])
    if (files[1]) data.preview = files[1]
    return [data]
  }

  private cropAndUploadAvatar = async (
    fileId: string,
    path: string,
  ): Promise<UploadData[]> => {
    const fileInfo = await this.getFileData(path)
    if (!fileInfo?.streams) throw new BadRequestException()
    let animated = false
    if (fileInfo.streams[0].avg_frame_rate !== '0/0') animated = true
    const cropSize =
      fileInfo.streams[0].width > fileInfo.streams[0].height
        ? `${fileInfo.streams[0].height}:${fileInfo.streams[0].height}`
        : `${fileInfo.streams[0].width}:${fileInfo.streams[0].width}`
    return Promise.all([
      new Promise((resolve) => {
        ffmpeg(path)
          .outputOptions([`-vf crop=${cropSize},scale=256:256,setsar=1:1`])
          .saveToFile(`${path}.256.webp`)
          .on('end', async () => {
            const data = {
              name: 'avatar.webp',
              mime: 'image/webp',
              size: (await fs.stat(`${path}.256.webp`)).size,
              path: `${path}.256.webp`,
              animated,
            }
            this.uploadToServer(fileId, data).then(async () => {
              fs.unlink(`${path}.256.webp`)
              resolve(data)
            })
          })
      }),
      new Promise((resolve) => {
        ffmpeg(path)
          .outputOptions([`-vf crop=${cropSize},scale=112:112,setsar=1:1`])
          .saveToFile(`${path}.112.webp`)
          .on('end', async () => {
            const data = {
              name: 'avatar_112.webp',
              mime: 'image/webp',
              size: (await fs.stat(`${path}.112.webp`)).size,
              path: `${path}.112.webp`,
            }
            this.uploadToServer(fileId, data).then(async () => {
              fs.unlink(`${path}.112.webp`)
              resolve(data)
            })
          })
      }),
      new Promise((resolve) => {
        ffmpeg(path)
          .outputOptions([`-vf crop=${cropSize},scale=40:40,setsar=1:1`])
          .saveToFile(`${path}.40.webp`)
          .on('end', async () => {
            const data = {
              name: 'avatar_40.webp',
              mime: 'image/webp',
              size: (await fs.stat(`${path}.40.webp`)).size,
              path: `${path}.40.webp`,
            }
            this.uploadToServer(fileId, data).then(async () => {
              fs.unlink(`${path}.40.webp`)
              resolve(data)
            })
          })
      }),
      new Promise((resolve) => {
        ffmpeg(path)
          .outputOptions([`-vf crop=${cropSize},scale=34:34,setsar=1:1`])
          .saveToFile(`${path}.34.webp`)
          .on('end', async () => {
            const data = {
              name: 'avatar_34.webp',
              mime: 'image/webp',
              size: (await fs.stat(`${path}.34.webp`)).size,
              path: `${path}.34.webp`,
            }
            this.uploadToServer(fileId, data).then(async () => {
              fs.unlink(`${path}.34.webp`)
              resolve(data)
            })
          })
      }),
    ])
  }
  private cropAndUploadBanner = async (
    fileId: string,
    path: string,
  ): Promise<UploadData[]> => {
    const fileInfo = await this.getFileData(path)
    if (!fileInfo?.streams) throw new BadRequestException()
    let animated = false
    if (fileInfo.streams[0].avg_frame_rate !== '0/0') animated = true
    let cropSize: string
    if (fileInfo.streams[0].width / fileInfo.streams[0].height > 16 / 9) {
      cropSize = `${Math.round(fileInfo.streams[0].height * (16 / 9))}:${
        fileInfo.streams[0].height
      }`
    } else {
      cropSize = `${fileInfo.streams[0].width}:${Math.round(
        fileInfo.streams[0].width / (16 / 9),
      )}`
    }
    console.log(cropSize)
    return Promise.all([
      new Promise((resolve) => {
        ffmpeg(path)
          .outputOptions([`-vf crop=${cropSize},scale=1600:900,setsar=1:1`])
          .saveToFile(`${path}.banner.webp`)
          .on('end', async () => {
            const data = {
              name: 'banner.webp',
              mime: 'image/webp',
              size: (await fs.stat(`${path}.banner.webp`)).size,
              path: `${path}.banner.webp`,
              animated,
            }
            this.uploadToServer(fileId, data).then(async () => {
              fs.unlink(`${path}.banner.webp`)
              resolve(data)
            })
          })
      }),
      new Promise((resolve) => {
        ffmpeg(path)
          .outputOptions([`-vf crop=${cropSize},scale=320:180,setsar=1:1`])
          .saveToFile(`${path}.320.webp`)
          .on('end', async () => {
            const data = {
              name: 'banner_320.webp',
              mime: 'image/webp',
              size: (await fs.stat(`${path}.320.webp`)).size,
              path: `${path}.320.webp`,
            }
            this.uploadToServer(fileId, data).then(async () => {
              fs.unlink(`${path}.320.webp`)
              resolve(data)
            })
          })
      }),
    ])
  }
  private scaleAndUploadSticker = async (
    fileId: string,
    path: string,
  ): Promise<UploadData[]> => {
    const fileInfo = await this.getFileData(path)
    if (!fileInfo?.streams) throw new BadRequestException()

    let animated = false
    if (fileInfo.streams[0].avg_frame_rate !== '0/0') animated = true
    let cropSize: string
    if (fileInfo.streams[0].width === fileInfo.streams[0].height) {
      cropSize = `${fileInfo.streams[0].width}:${fileInfo.streams[0].height}`
    } else {
      const lowerSide =
        fileInfo.streams[0].width < fileInfo.streams[0].height
          ? fileInfo.streams[0].width
          : fileInfo.streams[0].height
      cropSize = `${lowerSide}:${lowerSide}`
    }
    return Promise.all([
      new Promise((resolve) => {
        ffmpeg(path)
          .outputOptions([`-vf crop=${cropSize},scale=256:256,setsar=1:1`])
          .saveToFile(`${path}.sticker.webp`)
          .on('end', async () => {
            const data = {
              name: 'sticker.webp',
              mime: 'image/webp',
              size: (await fs.stat(`${path}.sticker.webp`)).size,
              path: `${path}.sticker.webp`,
              animated,
            }
            this.uploadToServer(fileId, data).then(async () => {
              fs.unlink(`${path}.sticker.webp`)
              resolve(data)
            })
          })
      }),
      new Promise((resolve) => {
        ffmpeg(path)
          .outputOptions([`-vf crop=${cropSize},scale=128:128,setsar=1:1`])
          .saveToFile(`${path}.128.webp`)
          .on('end', async () => {
            const data = {
              name: 'sticker_128.webp',
              mime: 'image/webp',
              size: (await fs.stat(`${path}.128.webp`)).size,
              path: `${path}.128.webp`,
            }
            this.uploadToServer(fileId, data).then(async () => {
              fs.unlink(`${path}.128.webp`)
              resolve(data)
            })
          })
      }),
      new Promise((resolve) => {
        ffmpeg(path)
          .outputOptions([`-vf crop=${cropSize},scale=64:64,setsar=1:1`])
          .saveToFile(`${path}.64.webp`)
          .on('end', async () => {
            const data = {
              name: 'sticker_64.webp',
              mime: 'image/webp',
              size: (await fs.stat(`${path}.64.webp`)).size,
              path: `${path}.64.webp`,
            }
            this.uploadToServer(fileId, data).then(async () => {
              fs.unlink(`${path}.64.webp`)
              resolve(data)
            })
          })
      }),
      new Promise((resolve) => {
        ffmpeg(path)
          .outputOptions([`-vf crop=${cropSize},scale=32:32,setsar=1:1`])
          .saveToFile(`${path}.32.webp`)
          .on('end', async () => {
            const data = {
              name: 'sticker_32.webp',
              mime: 'image/webp',
              size: (await fs.stat(`${path}.32.webp`)).size,
              path: `${path}.32.webp`,
            }
            this.uploadToServer(fileId, data).then(async () => {
              fs.unlink(`${path}.32.webp`)
              resolve(data)
            })
          })
      }),
    ])
  }
  private scaleAndUploadEmoji = async (
    fileId: string,
    path: string,
  ): Promise<UploadData[]> => {
    const fileInfo = await this.getFileData(path)
    if (!fileInfo?.streams) throw new BadRequestException()

    let animated = false
    if (fileInfo.streams[0].avg_frame_rate !== '0/0') animated = true
    let cropSize: string
    if (fileInfo.streams[0].width === fileInfo.streams[0].height) {
      cropSize = `${fileInfo.streams[0].width}:${fileInfo.streams[0].height}`
    } else {
      const lowerSide =
        fileInfo.streams[0].width < fileInfo.streams[0].height
          ? fileInfo.streams[0].width
          : fileInfo.streams[0].height
      cropSize = `${lowerSide}:${lowerSide}`
    }
    return Promise.all([
      new Promise((resolve) => {
        ffmpeg(path)
          .outputOptions([`-vf crop=${cropSize},scale=-1:48,setsar=1:1`])
          .saveToFile(`${path}.emoji.webp`)
          .on('end', async () => {
            const data = {
              name: 'emoji.webp',
              mime: 'image/webp',
              size: (await fs.stat(`${path}.emoji.webp`)).size,
              path: `${path}.emoji.webp`,
              animated,
            }
            this.uploadToServer(fileId, data).then(async () => {
              fs.unlink(`${path}.emoji.webp`)
              resolve(data)
            })
          })
      }),
      new Promise((resolve) => {
        ffmpeg(path)
          .outputOptions([`-vf crop=${cropSize},scale=-1:32,setsar=1:1`])
          .saveToFile(`${path}.32.webp`)
          .on('end', async () => {
            const data = {
              name: 'emoji_32.webp',
              mime: 'image/webp',
              size: (await fs.stat(`${path}.32.webp`)).size,
              path: `${path}.32.webp`,
            }
            this.uploadToServer(fileId, data).then(async () => {
              fs.unlink(`${path}.32.webp`)
              resolve(data)
            })
          })
      }),
      new Promise((resolve) => {
        ffmpeg(path)
          .outputOptions([`-vf crop=${cropSize},scale=-1:22,setsar=1:1`])
          .saveToFile(`${path}.22.webp`)
          .on('end', async () => {
            const data = {
              name: 'emoji_22.webp',
              mime: 'image/webp',
              size: (await fs.stat(`${path}.22.webp`)).size,
              path: `${path}.22.webp`,
            }
            this.uploadToServer(fileId, data).then(async () => {
              fs.unlink(`${path}.22.webp`)
              resolve(data)
            })
          })
      }),
    ])
  }
  private checkAndUploadVoice = async (
    fileId: string,
    path: string,
  ): Promise<UploadData[]> => {
    return Promise.all([
      new Promise((resolve, reject) => {
        ffmpeg(path)
          .outputOptions(['-c:a copy'])
          .saveToFile(`${path}.voice.opus`)
          .on('error', async () => {
            resolve({ error: 'File must be in opus format' })
          })
          .on('end', async () => {
            const data = {
              name: 'voice.opus',
              mime: 'audio/opus',
              size: (await fs.stat(`${path}.voice.opus`)).size,
              path: `${path}.voice.opus`,
            }
            this.uploadToServer(fileId, data).then(async () => {
              fs.unlink(data.path)
              resolve(data)
            })
          })
      }),
    ])
  }
  private getMimeFromPath = (filePath) => {
    const execSync = CP.execSync
    const mimeType = execSync(
      'file --mime-type -b "' + filePath + '"',
    ).toString()
    return mimeType.trim()
  }
}

class FilePreview {
  name: string
  width: number
  height: number
}

class UploadData {
  name?: string
  mime?: string
  size?: number
  path?: string
  preview?: FilePreview
  error?: string
  animated?: boolean
}
