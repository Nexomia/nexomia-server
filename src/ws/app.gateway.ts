import { Server } from 'ws'
import { AccessToken } from 'interfaces/access-token.interface'
import { UniqueID } from 'nodejs-snowflake'
import { CACHE_MANAGER, Inject, Logger } from '@nestjs/common'
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsResponse,
} from '@nestjs/websockets'
import { Cache } from 'cache-manager'
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter'
import { ParserUtils } from 'utils/parser/parser.utils'
import { config } from '../app.config'
import { JwtService } from '../utils/jwt/jwt.service'
import { UsersService } from '../api/users/users.service'
import { AuthGatewayDto } from './dto/auth.dto'
import { ComputedPermissions } from './../api/guilds/schemas/role.schema'
import {
  CachedUser,
  UserConnection,
} from './../interfaces/cached-user.interface'

@WebSocketGateway()
export class AppGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private jwtService: JwtService,
    private userService: UsersService,
    private parser: ParserUtils,
    private eventEmitter: EventEmitter2,
    @Inject(CACHE_MANAGER) private onlineManager: Cache,
  ) {}
  private logger: Logger = new Logger('AppGateway')

  @WebSocketServer()
  server: Server

  afterInit(server: any) {
    return this.logger.log('Websocket Initialized')
  }

  async handleConnection(client: any, ...args: any[]) {
    const user: AccessToken | boolean = await this.jwtService.decodeAccessToken(
      args[0].headers.authorization || args[0].url.split('token=')[1],
    )
    if (!user) return client.close()
    const time = user.exp * 1000 - Date.now() - 60000
    client.id = new UniqueID(config.snowflake).getUniqueID().toString()
    client.uid = user.id
    client.type =
      parseInt(args[0].headers.type) >= 0 && parseInt(args[0].headers.type) < 2
        ? parseInt(args[0].headers.type)
        : 0
    client.timer = setTimeout(this.notifyClient.bind(this), time, client)
    this.logger.log(client.id, 'Connected to socket')

    const cachedUser: CachedUser = JSON.parse(
      (await this.onlineManager.get(user.id)) || '{}',
    )
    if (!cachedUser.id) {
      const guilds = await this.userService.getGuilds(user.id, {})
      const guildIds: string[] = []
      if (guilds) {
        for (const guild of guilds) {
          guildIds.push(guild.id)
          const cachedGuild = await this.onlineManager.get(guild.id)
          if (!cachedGuild) {
            const members: string[] = []
            members.push(user.id)
            await this.onlineManager.set(guild.id, JSON.stringify(members))
          } else {
            const members: string[] = JSON.parse(
              await this.onlineManager.get(guild.id),
            )
            members.push(user.id)
            await this.onlineManager.set(guild.id, JSON.stringify(members))
          }
        }
      }
      const channels = await this.userService.getChannels(user.id)
      const channelIds: string[] = []
      if (channels) {
        for (const channel of channels) {
          channelIds.push(channel.id)
          const cachedChannel = await this.onlineManager.get(channel.id)
          if (!cachedChannel) {
            const members: string[] = []
            members.push(user.id)
            await this.onlineManager.set(channel.id, JSON.stringify(members))
          } else {
            const members: string[] = JSON.parse(
              await this.onlineManager.get(channel.id),
            )
            members.push(user.id)
            await this.onlineManager.set(channel.id, JSON.stringify(members))
          }
        }
      }
      cachedUser.id = user.id
      cachedUser.guilds = guildIds
      cachedUser.channels = channelIds
      const connection = new UserConnection()
      connection.id = client.id
      connection.type = client.type
      cachedUser.connections = []
      cachedUser.connections.push(connection)
      await this.onlineManager.set(client.uid, JSON.stringify(cachedUser))
    } else {
      const connection = new UserConnection()
      connection.id = client.id
      connection.type = client.type
      cachedUser.connections.push(connection)
      await this.onlineManager.set(client.uid, JSON.stringify(cachedUser))
    }

    const data2 = {
      event: 'user.connected',
      data: {
        id: client.uid,
      },
    }
    this.eventEmitter.emit('user.connected', data2, user.id)

    const event = 'auth.succeed'
    const data = {
      id: client.id,
      uid: client.uid,
      code: 0,
      status: 'Connected.',
    }
    return client.send(JSON.stringify({ event, data }))
  }
  async handleDisconnect(client: any) {
    if (!client.id) return
    this.logger.log(client.id, 'Disconnected from socket')
    const data = {
      event: 'user.disconnected',
      data: {
        id: client.uid,
      },
    }
    this.eventEmitter.emit('user.disconnected', data, client.uid)

    const cachedUser: CachedUser = JSON.parse(
      await this.onlineManager.get(client.uid),
    )
    if (cachedUser.connections.length === 1) {
      if (cachedUser.guilds.length) {
        for (const guild of cachedUser.guilds) {
          const cachedGuild: string[] = JSON.parse(
            await this.onlineManager.get(guild),
          )
          cachedGuild.splice(cachedGuild.indexOf(client.uid), 1)
          await this.onlineManager.set(guild, JSON.stringify(cachedGuild))
        }
      }
      if (cachedUser.channels.length) {
        for (const channel of cachedUser.channels) {
          const cachedChannel: string[] = JSON.parse(
            await this.onlineManager.get(channel),
          )
          cachedChannel.splice(cachedChannel.indexOf(client.uid), 1)
          await this.onlineManager.set(channel, JSON.stringify(cachedChannel))
        }
      }
      await this.onlineManager.del(client.uid)
    } else {
      const connectionIndex = cachedUser.connections.findIndex(
        (connection) => connection.id == client.id,
      )
      cachedUser.connections.splice(connectionIndex, 1)
      await this.onlineManager.set(client.uid, JSON.stringify(cachedUser))
    }

    return
  }

  @SubscribeMessage('auth.refresh_token')
  async handleMessage(
    @MessageBody() auth: AuthGatewayDto,
    @ConnectedSocket() client,
  ): Promise<WsResponse<unknown>> {
    const user: AccessToken | boolean = await this.jwtService.decodeAccessToken(
      auth.authorization,
    )
    let event: string
    let data = {}
    if (!user) {
      event = 'auth.unauthorized'
      data = {
        id: client.id,
        uid: client.uid,
        code: 4,
        status: 'Unauthorized.',
      }
    } else {
      event = 'auth.successed'
      const time = user.exp * 1000 - Date.now() - 60000
      clearTimeout(client.timer)
      client.timer = setTimeout(this.notifyClient.bind(this), time, client)
      data = {
        id: client.id,
        uid: client.uid,
        code: 3,
        status: 'Token refreshed.',
      }
    }
    return client.send(JSON.stringify({ event, data }))
  }

  notifyClient(client) {
    const event = 'auth.warning'
    const data = {
      id: client.id,
      uid: client.uid,
      code: 2,
      status:
        'Disconnection warning! Refresh auth token in 60s and stay connected.',
    }
    client.timer = setTimeout(this.disconnectClient, 60000, client)

    return client.send(JSON.stringify({ event, data }))
  }

  disconnectClient(client) {
    const event = 'auth.disconnected'
    const data = {
      id: client.id,
      uid: client.uid,
      code: 1,
      status: 'Disconnected.',
    }

    client.send(JSON.stringify({ event, data }))
    return client.close()
  }

  @OnEvent('message.*')
  async message(data, guildId) {
    let recipients: string[] = []
    if (guildId) {
      const membersStr: string = await this.onlineManager.get(guildId)
      if (membersStr) recipients = JSON.parse(membersStr)
      for (const recipient of recipients) {
        const perms = await this.parser.computePermissions(
          guildId,
          recipient,
          data.data.channel_id,
        )
        if (
          !(
            perms &
            (ComputedPermissions.OWNER |
              ComputedPermissions.ADMINISTRATOR |
              ComputedPermissions.READ_MESSAGES)
          )
        )
          recipients.splice(recipients.indexOf(recipient), 1)
      }
      recipients = recipients.filter((v, i, r) => r.indexOf(v) === i)
    } else {
      const membersStr: string = await this.onlineManager.get(
        data.data.channel_id,
      )
      if (membersStr) recipients = JSON.parse(membersStr)
    }
    this.server.clients.forEach(async (client: any) => {
      if (!recipients.includes(client.uid)) return
      return client.send(JSON.stringify(data))
    })
  }

  @OnEvent('channel.*')
  async channel(data, userId: string) {
    if (data.event === 'channel.typing') return this.message(data, userId)
    const cachedUser: CachedUser = JSON.parse(
      (await this.onlineManager.get(userId)) || '{}',
    )
    let recipients: string[] = []
    if (cachedUser.guilds && cachedUser.guilds.length) {
      for (const guild of cachedUser.guilds) {
        const membersStr: string = await this.onlineManager.get(guild)
        if (membersStr) recipients = recipients.concat(JSON.parse(membersStr))
      }
    }
    if (cachedUser.channels && cachedUser.channels.length) {
      for (const channel of cachedUser.channels) {
        const membersStr: string = await this.onlineManager.get(channel)
        if (membersStr) recipients = recipients.concat(JSON.parse(membersStr))
      }
    }
    recipients = recipients.filter((v, i, r) => r.indexOf(v) === i)

    this.server.clients.forEach(async (client: any) => {
      if (!recipients.includes(client.uid)) return
      return client.send(JSON.stringify(data))
    })
  }

  @OnEvent('guild.*')
  async guild(data, guildId: string) {
    let recipients: string[] = []
    const membersStr: string = await this.onlineManager.get(guildId)
    if (membersStr) recipients = JSON.parse(membersStr)
    this.server.clients.forEach(async (client: any) => {
      if (!recipients.includes(client.uid)) return
      return client.send(JSON.stringify(data))
    })
  }

  @OnEvent('user.*')
  async user(data, userId: string) {
    const cachedUser: CachedUser = JSON.parse(
      (await this.onlineManager.get(userId)) || '{}',
    )
    let recipients: string[] = []
    if (cachedUser.guilds && cachedUser.guilds.length) {
      for (const guild of cachedUser.guilds) {
        const membersStr: string = await this.onlineManager.get(guild)
        if (membersStr) recipients = recipients.concat(JSON.parse(membersStr))
      }
    }
    if (cachedUser.channels && cachedUser.channels.length) {
      for (const channel of cachedUser.channels) {
        const membersStr: string = await this.onlineManager.get(channel)
        if (membersStr) recipients = recipients.concat(JSON.parse(membersStr))
      }
    }

    recipients = recipients.filter((v, i, r) => r.indexOf(v) === i)
    this.server.clients.forEach(async (client: any) => {
      if (!recipients.includes(client.uid)) return
      return client.send(JSON.stringify(data))
    })
  }

  @OnEvent('ROOT.*')
  async root_events(ev) {
    if (ev.event === 'ROOT.client_token_update') {
      this.server.clients.forEach(async (client: any) => {
        if (client.id == ev.session_id) {
          const user:
            | AccessToken
            | boolean = await this.jwtService.decodeAccessToken(ev.token)
          if (!user) return
          const time = user.exp * 1000 - Date.now() - 60000
          clearTimeout(client.timer)
          client.timer = setTimeout(this.notifyClient.bind(this), time, client)
          const event = 'auth.status'
          const data = {
            id: client.id,
            uid: client.uid,
            code: 3,
            status: 'Token refreshed.',
          }
          return client.send(JSON.stringify({ event, data }))
        }
      })
    }
    return
  }
}
