import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Length,
} from 'class-validator'
import { Permissions } from '../schemas/role.schema'

export class RoleDto {
  @IsOptional()
  @IsString()
  @Length(1, 20)
  name?: string

  @IsOptional()
  @IsString()
  color?: string

  @IsOptional()
  @IsBoolean()
  hoist?: boolean

  @IsOptional()
  @IsNumber()
  position?: number

  @IsOptional()
  @IsBoolean()
  mentionable?: boolean

  @IsOptional()
  permissions?: Permissions
}
