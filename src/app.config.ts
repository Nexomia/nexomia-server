import axios from 'axios'

export interface Config {
  port: number
  db: string
  domain: string
  salt: string
  snowflake: {
    customEpoch?: number
    returnNumber?: boolean
    machineID?: number
  }
  selectel: {
    user: string
    pass: string
    container: string
  }
  smtp: {
    host: string
    port: number
    secure: boolean
    auth: {
      user: string
      pass: string
    }
  }
  jwt: {
    accessTokenExpires: string
    emailTokenExpires: string
    refreshTokenSecret: string
    refreshTokenExpires: string
    secret: string
  }
}

export const config = {} as Config

export async function loadConfig() {
  try {
    const newConfig = (
      await axios.get<Config>('http://config:20490/api/v1/server.json', {
        responseType: 'json',
      })
    ).data
    Object.assign(config, newConfig)
  } catch (e) {
    throw e
  }
}
