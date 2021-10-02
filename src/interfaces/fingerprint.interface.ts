export class Fingerprint {
  hash: string
  components: {
    useragent: {
      browser: {
        family: string
        version: number
      }
      device: {
        family: string
        version: number
      }
      os: {
        family: string
        major: number
        minor: number
      }
      acceptHeaders: {
        accept: string
        encoding: string
        language: string
      }
      geoip: {
        country: string
        resion: string
        city: string
      }
    }
  }
}
