import { IsOptional, IsString } from 'class-validator'

export class FindUsersDto {
  @IsOptional()
  @IsString()
  ids: string

  @IsOptional()
  @IsString()
  tags: string
}
