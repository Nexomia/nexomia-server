import { FileResponseValidate } from './responses/file.response';
import { UniqueID } from 'nodejs-snowflake';
import { config } from './../../app.config';
import { File, FileDocument, FileServer, FileType, AllowedFileExtensions, VK } from './schemas/file.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable, InternalServerErrorException, NotFoundException, PayloadTooLargeException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Model } from 'mongoose';
import axios from 'axios';
import fs from 'promise-fs';
import * as FormData from 'form-data';

@Injectable()
export class FilesService {
  constructor(
    @InjectModel(File.name) private fileModel: Model<FileDocument>
  ) {}

  async getFile(fileId, fileName, res, preview?) {
    // const file = await this.fileModel.findOne({ id: fileId, name: fileName })
    // if (!file) throw new NotFoundException()

    // if (preview && !file.vk.file_preview) throw new NotFoundException()

    // if (file.mime_type.startsWith('image')) {
    //   res.setHeader('Cache-Control', 'public')
    //   res.setHeader('Cache-Control', 'max-age=360000')
    // }

    // res.setHeader('Content-type', preview ? 'image/jpeg' : file.mime_type)
    // res.setHeader('content-disposition', `attachment; filename*=UTF-8''${this.fixedEncodeURIComponent(preview ? 'preview' : '' + file.name)}`)
    // if (!preview) res.setHeader('Content-Length', file.size)

    // const response = await axios({
    //   url: preview ? file.vk.file_preview : file.vk.file_url,
    //   method: 'GET',
    //   responseType: 'stream'
    // })

    // response.data.pipe(res)
  }

  async getFileServer(fileType, userId) {
    if (!fileType || fileType < 1 || fileType > 4) throw new BadRequestException()

    const file = new this.fileModel()
    file.id = new UniqueID(config.snowflake).getUniqueID() 
    file.type = fileType
    file.owner_id = userId
    file.file_server = FileServer.SELECTEL
    await file.save()
    //Сделаю потом
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
      (file.type === FileType.AVATAR && !AllowedFileExtensions.AVATAR.includes(multerFile.mimetype.split('/')[1]))
      ||
      (file.type === FileType.BANNER && !AllowedFileExtensions.BANNER.includes(multerFile.mimetype.split('/')[1]))
      ||
      (file.type === FileType.BACKGROUND && !AllowedFileExtensions.BACKGROUND.includes(multerFile.mimetype.split('/')[1]))
    ) throw new BadRequestException(
        Object.keys(AllowedFileExtensions)[file.type - 2] + 
        ' must be with one of these extensions: ' +
        AllowedFileExtensions[Object.keys(AllowedFileExtensions)[file.type - 2]].join(', ')
      )

    const fileMime = multerFile.mimetype.split('/')[0]
    const uploaded = await axios.put(
      `https://api.selcdn.ru/v1/SEL_${config.selectel.user}/${config.selectel.container}/${file.id}/${this.fixedEncodeURIComponent(multerFile.originalname)}`,
      await fs.createReadStream(multerFile.path),
      {
        headers: {
          'Content-Type': multerFile.mimetype,
          'Content-Length': multerFile.size,
          'X-Auth-Token': await this.getApiToken()
        },
        'maxContentLength': Infinity,
      }
    )
  
    if (!uploaded || uploaded.statusText != 'Created') {
      await fs.unlink(multerFile.path)
      throw new InternalServerErrorException()
    }

    await fs.unlink(multerFile.path)

    file.mime_type = multerFile.mimetype
    file.name = multerFile.originalname
    file.size = multerFile.size
    file.saved = true
    await file.save()
    
    let extendedFile = file.toObject()
    extendedFile.url = `https://cdn.nx.wtf/${file.id}/${this.fixedEncodeURIComponent(file.name)}`

    return FileResponseValidate(extendedFile)
  }

  async getFileInfo(fileId): Promise<File> {
    const file = await this.fileModel.findOne({ id: fileId })
    let extendedFile = file.toObject()
    extendedFile.url = `https://cdn.nx.wtf/${file.id}/${this.fixedEncodeURIComponent(file.name)}`
    return extendedFile
  }

  private getApiToken = async () => {
    return (await axios({
      method: 'get',
      url: 'https://api.selcdn.ru/auth/v1.0',
      headers: {
        "X-Auth-User": config.selectel.user,
        "X-Auth-Key" : config.selectel.pass
      }
    })).headers["x-storage-token"]
  }

  private fixedEncodeURIComponent = (str) => {
    return encodeURIComponent(str)
      .replace(/['()]/g, escape)
      .replace(/\*/g, '%2A')
      .replace(/%(?:7C|60|5E)/g, unescape)
  }
}
