import { IsNumber } from 'class-validator'

export class OverwritePermissionsDto {
  /**
   * The bitwise value of all allowed permissions
   */
  @IsNumber()
  allow: number

  /**
   * The bitwise value of all disallowed permissions
   */
  @IsNumber()
  deny: number
}
