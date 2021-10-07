import { IsBoolean, IsNumber, IsOptional } from 'class-validator'

export class CreateInviteDto {
  /**
   * Duration of invite in seconds before expiry, or 0 for never. between 0 and 604800 (7 days)
   */
  @IsOptional()
  @IsNumber()
  max_age?: number

  /**
   * Max number of uses or 0 for unlimited. between 0 and 100
   */
  @IsOptional()
  @IsNumber()
  max_uses?: number

  /**
   * Whether this invite only grants temporary membership
   */
  @IsOptional()
  @IsBoolean()
  temporary?: boolean

  /**
   * If true, don't try to reuse a similar invite (useful for creating many unique one time use invites)
   */
  @IsOptional()
  @IsBoolean()
  unique?: boolean
}
