import { IsOptional } from 'class-validator'

export class GetUserGuildsDto {
  @IsOptional()
  before?: string

  @IsOptional()
  after?: string

  @IsOptional()
  limit?: number
}
