import { IsNumberString } from 'class-validator'

export class OverwritePermissionsDto {
  /**
   * The bitwise value of all allowed permissions
   */
  @IsNumberString()
  allow: string

  /**
   * The bitwise value of all disallowed permissions
   */
  @IsNumberString()
  deny: string

  /**
   * 0 for a role or 1 for a member
   */
  @IsNumberString()
  type: number
}
