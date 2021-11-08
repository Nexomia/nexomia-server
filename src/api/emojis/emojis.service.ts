import { Guild, GuildDocument } from 'api/guilds/schemas/guild.schema'
import { config } from 'app.config'
import { UniqueID } from 'nodejs-snowflake'
import { User, UserDocument } from 'api/users/schemas/user.schema'
import { InjectModel } from '@nestjs/mongoose'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Model } from 'mongoose'
import { UserResponseValidate } from './../users/responses/user.response'
import { EditEmojiPackDto } from './dto/edit-emojiPack.dto'
import { EditEmojiDto } from './dto/edit-emoji.dto'
import { AddEmojiDto } from './dto/add-emoji.dto'
import { FileType } from './../files/schemas/file.schema'
import { CreateEmojiPackDto } from './dto/emojiPack-create.dto'
import {
  EmojiPackResponseValidate,
  EmojiPackResponse,
} from './responses/emojiPack.response'
import {
  EmojiResponseValidate,
  EmojiResponse,
} from './responses/emoji.response'
import { Emoji, EmojiDocument } from './schemas/emoji.schema'
import { EmojiPack, EmojiPackDocument } from './schemas/emojiPack.schema'
import { FilesService } from './../files/files.service'

@Injectable()
export class EmojisService {
  constructor(
    @InjectModel(EmojiPack.name)
    private emojiPackModel: Model<EmojiPackDocument>,
    @InjectModel(Emoji.name)
    private emojiModel: Model<EmojiDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(Guild.name)
    private guildModel: Model<GuildDocument>,
    private filesService: FilesService,
  ) {}
  async getPack(
    packId: string,
    includeEmojis: boolean,
    userId: string,
  ): Promise<EmojiPackResponse> {
    const user = (await this.userModel.findOne({ id: userId })).toObject()
    const pack = (await this.emojiPackModel.findOne({ id: packId })).toObject()
    if (
      !user.emoji_packs_ids.includes(packId) &&
      pack.owner_id !== userId &&
      (pack.access.disallowedUsers.includes(userId) ||
        (!pack.access.open_for_new_users &&
          !pack.access.allowedUsers.includes(userId)))
    )
      throw new ForbiddenException()

    let emojis: EmojiResponse[]
    if (includeEmojis) {
      const emojisRaw = await this.emojiModel.find({
        pack_id: pack.id,
        deleted: false,
      })
      console.log(emojisRaw)
      emojis = emojisRaw.map((em) => {
        em.url = `https://cdn.nx.wtf/${em.id}/${
          pack.type ? 'sticker' : 'emoji' // 1 - sticker, 0 - emoji (true/else)
        }.webp`
        return EmojiResponseValidate(em)
      })
      console.log(emojis)
      pack.emojis = emojis
    }
    if (pack.icon) pack.icon = `https://cdn.nx.wtf/${pack.icon}/avatar.webp`
    const packResponse = EmojiPackResponseValidate(pack)
    return packResponse
  }

  async createPack(
    userId: string,
    dto: CreateEmojiPackDto,
  ): Promise<EmojiPackResponse> {
    if (dto.name.replaceAll(' ', '') === '') throw new BadRequestException()
    const pack = await new this.emojiPackModel()
    pack.id = new UniqueID(config.snowflake).getUniqueID()
    pack.owner_id = userId
    pack.name = dto.name.replaceAll(/(\s){2,}/gm, ' ')
    if (dto.description && dto.description.replaceAll(' ', '') !== '')
      pack.description = dto.description.replaceAll(/(\s){2,}/gm, ' ')

    pack.type = dto.type
    if (dto.icon) {
      const file = await this.filesService.getFileInfo(dto.icon)
      if (file.owner_id !== userId || file.type !== FileType.AVATAR)
        throw new BadRequestException()
      pack.icon = dto.icon
    }
    await pack.save()
    const extendedPack = pack.toObject()
    extendedPack.icon = `https://cdn.nx.wtf/${pack.icon}/avatar.webp`

    return EmojiPackResponseValidate(extendedPack)
  }

  async removePack(packId: string, userId: string): Promise<void> {
    const pack = await this.emojiPackModel.findOne({ id: packId })
    if (!pack) throw new NotFoundException()
    if (pack.owner_id !== userId) throw new ForbiddenException()
    // Нужно будет потом для рассылки уведоблений об удалении пака
    // const users = await this.userModel.find({ emojiPacks_ids: { $in: packId } })

    Promise.all([
      this.userModel.updateMany(
        { emojiPacks_ids: packId },
        { $pull: { emojiPacks_ids: packId } },
      ),
      this.guildModel.updateMany(
        { emojiPacks_ids: packId },
        { $pull: { emojiPacks_ids: packId } },
      ),
    ])
    await pack.deleteOne()
    return
  }

  async editPack(
    packId: string,
    dto: EditEmojiPackDto,
    userId: string,
  ): Promise<EmojiPackResponse> {
    if (dto.name.replaceAll(' ', '') === '') throw new BadRequestException()
    const pack = await this.emojiPackModel.findOne({ id: packId })
    if (!pack) throw new NotFoundException()
    if (pack.owner_id !== userId) throw new ForbiddenException()

    if (dto.name) pack.name = dto.name.replaceAll(/(\s){2,}/gm, ' ')
    if (dto.description && dto.description.replaceAll(' ', '') !== '')
      pack.description = dto.description.replaceAll(/(\s){2,}/gm, ' ')
    if (dto.open_for_new_users)
      pack.access.open_for_new_users = dto.open_for_new_users
    if (dto.icon) pack.icon = dto.icon
    await pack.save()
    const extendedPack = pack.toObject()
    extendedPack.icon = `https://cdn.nx.wtf/${pack.icon}/avatar.webp`
    return EmojiPackResponseValidate(extendedPack)
  }
  async getWhiteListUsers(packId: string, userId: string) {
    const pack = await this.emojiPackModel.findOne({ id: packId })
    if (!pack) throw new NotFoundException()
    if (pack.owner_id !== userId) throw new ForbiddenException()
    if (!pack.access.allowedUsers.length) return []
    const users = await this.userModel.find({ id: pack.access.allowedUsers })
    return users.map(UserResponseValidate)
  }

  async addWhiteListUser(
    packId: string,
    allowedUserId: string,
    userId: string,
  ) {
    const pack = await this.emojiPackModel.findOne({ id: packId })
    if (!pack) throw new NotFoundException()
    if (pack.owner_id !== userId) throw new ForbiddenException()

    if (!(await this.userModel.exists({ id: allowedUserId })))
      throw new NotFoundException()

    if (pack.access.allowedUsers.indexOf(allowedUserId))
      throw new ConflictException()

    pack.access.disallowedUsers = []
    pack.access.allowedUsers.push(allowedUserId)
    pack.markModified('access')
    await pack.save()
  }

  async removeWhiteListUser(
    packId: string,
    allowedUserId: string,
    userId: string,
  ) {
    const pack = await this.emojiPackModel.findOne({ id: packId })
    if (!pack) throw new NotFoundException()
    if (pack.owner_id !== userId) throw new ForbiddenException()

    if (!pack.access.allowedUsers.indexOf(allowedUserId))
      throw new NotFoundException()

    pack.access.allowedUsers.splice(
      pack.access.allowedUsers.indexOf(allowedUserId),
      1,
    )
    pack.markModified('access')
    await pack.save()
  }

  async getBlackListUsers(packId: string, userId: string) {
    const pack = await this.emojiPackModel.findOne({ id: packId })
    if (!pack) throw new NotFoundException()
    if (pack.owner_id !== userId) throw new ForbiddenException()
    if (!pack.access.disallowedUsers.length) return []
    const users = await this.userModel.find({ id: pack.access.disallowedUsers })
    return users.map(UserResponseValidate)
  }

  async addBlackListUser(
    packId: string,
    disallowedUserId: string,
    userId: string,
  ) {
    const pack = await this.emojiPackModel.findOne({ id: packId })
    if (!pack) throw new NotFoundException()
    if (pack.owner_id !== userId) throw new ForbiddenException()

    if (!(await this.userModel.exists({ id: disallowedUserId })))
      throw new NotFoundException()

    if (pack.access.disallowedUsers.indexOf(disallowedUserId))
      throw new ConflictException()

    pack.access.allowedUsers = []
    pack.access.disallowedUsers.push(disallowedUserId)
    pack.markModified('access')
    await pack.save()
  }

  async removeBlackListUser(
    packId: string,
    disallowedUserId: string,
    userId: string,
  ) {
    const pack = await this.emojiPackModel.findOne({ id: packId })
    if (!pack) throw new NotFoundException()
    if (pack.owner_id !== userId) throw new ForbiddenException()

    if (!pack.access.disallowedUsers.indexOf(disallowedUserId))
      throw new NotFoundException()

    pack.access.disallowedUsers.splice(
      pack.access.disallowedUsers.indexOf(disallowedUserId),
      1,
    )
    pack.markModified('access')
    await pack.save()
  }

  async getEmoji(packId: string, emojiId: string): Promise<EmojiResponse> {
    const pack = await this.emojiPackModel.findOne({ id: packId })
    if (!pack) throw new NotFoundException()
    const emoji = await this.emojiModel.findOne({
      id: emojiId,
      pack_id: packId,
      deleted: false,
    })
    if (!emoji) throw new NotFoundException()
    const extendedEmoji = emoji.toObject()
    extendedEmoji.url = `https://cdn.nx.wtf/${emoji.id}/${
      pack.type ? 'sticker' : 'emoji' // 1 - sticker, 0 - emoji (true/else)
    }.webp`
    return EmojiResponseValidate(extendedEmoji)
  }

  async addEmoji(
    packId: string,
    dto: AddEmojiDto,
    userId: string,
  ): Promise<EmojiResponse> {
    if (dto.name.replaceAll(' ', '') === '') throw new BadRequestException()

    const pack = await this.emojiPackModel.findOne({ id: packId })
    if (!pack) throw new NotFoundException()
    if (pack.owner_id !== userId) throw new ForbiddenException()

    const file = await this.filesService.getFileInfo(dto.file_id)
    if (
      file.owner_id !== userId ||
      (file.type !== FileType.EMOJI && file.type !== FileType.STICKER)
    )
      throw new ForbiddenException()
    const emoji = new this.emojiModel()
    emoji.id = file.id
    emoji.pack_id = packId
    emoji.name = dto.name.replaceAll(/(\s){2,}/gm, ' ')
    emoji.animated = file?.data?.animated
    emoji.user_id = userId
    if (dto.words) {
      let words: string[]
      dto.words.forEach((word) => {
        if (word.replaceAll(' ', '') !== '')
          words.push(word.replaceAll(/(\s){2,}/gm, ' '))
      })
      emoji.words = words
    }
    await emoji.save()
    const extendedEmoji = emoji.toObject()
    extendedEmoji.url = `https://cdn.nx.wtf/${file.id}/${
      pack.type ? 'sticker' : 'emoji' // 1 - sticker, 0 - emoji (true/else)
    }.webp`

    return EmojiResponseValidate(extendedEmoji)
  }

  async removeEmoji(
    packId: string,
    emojiId: string,
    userId: string,
  ): Promise<void> {
    const pack = await this.emojiPackModel.findOne({ id: packId })
    if (!pack) throw new NotFoundException()
    if (pack.owner_id !== userId) throw new ForbiddenException()

    const emoji = await this.emojiModel.findOne({
      id: emojiId,
      pack_id: packId,
      deleted: false,
    })
    if (!emoji) throw new NotFoundException()

    emoji.deleted = true
    await emoji.save()
    return
  }

  async editEmoji(
    packId: string,
    emojiId: string,
    dto: EditEmojiDto,
    userId: string,
  ): Promise<EmojiResponse> {
    if (dto.name.replaceAll(' ', '') === '') throw new BadRequestException()
    const pack = await this.emojiPackModel.findOne({ id: packId })
    if (!pack) throw new NotFoundException()
    if (pack.owner_id !== userId) throw new ForbiddenException()

    const emoji = await this.emojiModel.findOne({
      id: emojiId,
      pack_id: packId,
      deleted: false,
    })
    if (!emoji) throw new NotFoundException()

    if (dto.name) emoji.name = dto.name.replaceAll(/(\s){2,}/gm, ' ')
    if (dto.words) {
      let words: string[]
      dto.words.forEach((word) => {
        if (word.replaceAll(' ', '') !== '')
          words.push(word.replaceAll(/(\s){2,}/gm, ' '))
      })
    }
    await emoji.save()
    const extendedEmoji = emoji.toObject()
    extendedEmoji.url = `https://cdn.nx.wtf/${emoji.id}/${
      pack.type ? 'sticker' : 'emoji' // 1 - sticker, 0 - emoji (true/else)
    }.webp`
    return EmojiResponseValidate(extendedEmoji)
  }
}
