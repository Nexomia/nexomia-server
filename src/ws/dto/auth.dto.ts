import { IsString } from 'class-validator'

export class AuthGatewayDto {
  @IsString()
  authorization: string
}
