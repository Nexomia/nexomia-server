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
    const file = await this.fileModel.findOne({ id: fileId, name: fileName })
    if (!file) throw new NotFoundException()

    if (preview && !file.vk.file_preview) throw new NotFoundException()

    if (!preview && file.file_server === FileServer.VK && Date.now() - file.vk.file_url_updated > 3600000) {
      file.vk.file_url = (await this.updateFileUrl(file.vk.file_id, config.vk.getRandomToken(config.vk.tokens)))[0].url
      file.markModified('vk')
      await file.save()
    }

    if (file.mime_type.startsWith('image')) {
      res.setHeader('Cache-Control', 'public')
      res.setHeader('Cache-Control', 'max-age=360000')
    }

    res.setHeader('Content-type', preview ? 'image/jpeg' : file.mime_type)
    res.setHeader('content-disposition', `attachment; filename*=UTF-8''${this.fixedEncodeURIComponent(preview ? 'preview' : '' + file.name)}`)
    if (!preview) res.setHeader('Content-Length', file.size)

    const response = await axios({
      url: preview ? file.vk.file_preview : file.vk.file_url,
      method: 'GET',
      responseType: 'stream'
    })

    response.data.pipe(res)
  }

  async getFileServer(fileType, userId) {
    if (!fileType || fileType < 1 || fileType > 4) throw new BadRequestException()

    const file = new this.fileModel()
    file.id = new UniqueID(config.snowflake).getUniqueID() 
    file.type = fileType
    file.owner_id = userId
    file.file_server = FileServer.VK
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
    const newPath = fileMime === 'image'
      ? `${multerFile.path}_${multerFile.originalname}`
      : `${multerFile.path}.nexo`

    await fs.rename(multerFile.path, newPath)
    multerFile.path = newPath
  
    const token = config.vk.getRandomToken(config.vk.tokens)
    const vkFile = await this.uploadToServer(multerFile, (await this.getUploadServer(token)).upload_url, token, file.id)
    await fs.unlink(multerFile.path)
    if (!vkFile) throw new InternalServerErrorException()

    file.vk = new VK()
    if (vkFile.preview) {
      const vkImage = vkFile.preview.photo.sizes.find(size => size.type === 'o')
      const vkPreview = vkFile.preview.photo.sizes.find(size => size.type === 's')
      file.vk.file_width = vkImage.width
      file.vk.file_heigth = vkImage.height
      file.vk.file_preview = vkPreview.src
    }

    file.mime_type = multerFile.mimetype
    file.name = multerFile.originalname
    file.size = multerFile.size
    file.vk.file_id = `${vkFile.owner_id}_${vkFile.id}`
    file.vk.file_url = vkFile.url
    file.vk.file_url_updated = Date.now()
    file.saved = true
    await file.save()
    
    let extendedFile = file.toObject()
    if (file.file_server === FileServer.VK) {
      if (!config.production)
        extendedFile.url = `http://${config.domain}/api/files/${file.id}/${this.fixedEncodeURIComponent(file.name)}`

      if (file.vk.file_preview)
        extendedFile.preview = `http://${config.domain}/api/files/${file.id}/${this.fixedEncodeURIComponent(file.name)}/preview`
    }

    return FileResponseValidate(extendedFile)
  }

  private async uploadToServer(file, url, token, id) {
    const formData = new FormData()
    formData.append('file', fs.createReadStream(file.path))
  
    const uploaded = (await axios.post(url, formData, {
      headers: formData.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    })).data

    if (uploaded.error) throw new BadRequestException(uploaded.error)
    return (await this.saveInServer(uploaded.file, token)).doc
  }
  
  private async getUploadServer (token) {
    return (await axios.get(`https://api.vk.com/method/docs.getUploadServer?group_id=207174644&access_token=${token}&v=5.154`)).data.response
  }
  
  private async saveInServer (file, token) {
    return (await axios.get(`https://api.vk.com/method/docs.save?access_token=${token}&v=5.154&file=${file}`)).data.response
  }

  private async updateFileUrl (fileId, token) {
    return (await axios.get(`https://api.vk.com/method/docs.getById?docs=${fileId}&access_token=${token}&v=5.154`)).data.response
  }

  private fixedEncodeURIComponent (str) {
    return encodeURIComponent(str)
      .replace(/['()]/g, escape)
      .replace(/\*/g, '%2A')
      .replace(/%(?:7C|60|5E)/g, unescape)
  }
}
