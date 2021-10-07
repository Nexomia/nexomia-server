import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Guild } from 'api/guilds/schemas/guild.schema'
import { Model } from 'mongoose'
import {
  Channel,
  ChannelDocument,
  PermissionsOverwrite,
} from 'api/channels/schemas/channel.schema'
import { GuildDocument, GuildMember } from 'api/guilds/schemas/guild.schema'
import {
  ComputedPermissions,
  Role,
  RoleDocument,
} from 'api/guilds/schemas/role.schema'

@Injectable()
export class Parser {
  constructor(
    @InjectModel(Guild.name) private guildModel: Model<GuildDocument>,
    @InjectModel(Channel.name) private channelModel: Model<ChannelDocument>,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
  ) {}

  /**
   * @param channelId optinonal, if you need get perms for channel
   * @returns int value for next compare with ComputedPermissions
   */
  async computePermissions(
    guildId: string,
    userId: string,
    channelId?: string,
  ): Promise<number> {
    const guildOwner = await this.guildModel.exists({
      id: guildId,
      owner_id: userId,
    })
    if (guildOwner) return 1 << 0

    const guildMember: GuildMember = (
      await this.guildModel.findOne(
        {
          id: guildId,
          'members.id': userId,
        },
        'members.$',
      )
    ).members[0]

    if (
      guildMember.permissions &&
      guildMember.permissions.allow &
        (ComputedPermissions.OWNER | ComputedPermissions.ADMINISTRATOR)
    )
      return guildMember.permissions.allow

    let permissions: number
    const roles = await this.roleModel.aggregate([
      { $match: { guild_id: guildId, members: userId } },
      { $project: { id: 1, position: 1, permissions: 1 } },
      { $sort: { position: -1 } },
    ])

    const rolePositions: number[] = []
    const rolesArray: string[] = []
    for (const role of roles) {
      rolesArray.push(role.id)
      rolePositions.push(role.position)

      permissions &= ~role.permissions.deny
      permissions |= role.permissions.allow
    }

    if (!channelId) {
      if (!guildMember.permissions) return permissions

      permissions &= ~guildMember.permissions.deny
      permissions |= guildMember.permissions.allow
      return permissions
    }

    rolesArray.push(userId)
    try {
      const channel: Channel = (
        await this.channelModel
          .find({
            id: channelId,
            'permission_overwrites.id': { $in: rolesArray },
          })
          .sort({ 'permission_overwrites.type': -1 })
      )[0]

      let overwite_user: PermissionsOverwrite
      if (channel.permission_overwrites[0].type === 1)
        overwite_user = channel.permission_overwrites.shift()
      const overwrites: PermissionsOverwrite[] = channel.permission_overwrites
      overwrites.sort((a, b) => {
        if (
          a.type === 0 &&
          b.type === 0 &&
          rolePositions[rolesArray.indexOf(a.id)] >
            rolePositions[rolesArray.indexOf(b.id)]
        )
          return -1
      })
      let allow: number
      let deny: number

      for (const overwrite of overwrites) {
        permissions &= ~overwrite.deny
        permissions |= overwrite.allow
      }

      if (overwite_user) {
        permissions &= ~overwite_user.deny
        permissions |= overwite_user.allow
      }
    } catch {
      /**There's no overwrite object, so mongo can't parse my query */
    }

    if (guildMember.permissions) {
      permissions &= ~guildMember.permissions.deny
      permissions |= guildMember.permissions.allow
      return permissions
    }
  }

  encodeURI(text) {
    return encodeURIComponent(text)
      .replace(/['()]/g, escape)
      .replace(/\*/g, '%2A')
      .replace(/%(?:7C|60|5E)/g, unescape)
  }
}
