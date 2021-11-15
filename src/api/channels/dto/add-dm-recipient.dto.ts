import { IsNumberString, IsOptional, IsString, Length } from 'class-validator'

export class AddDMRecipientDto {
  @IsNumberString()
  /**
   * User id
   */
  id: string

  /**
   * Nickname of the user being added
   */
  @IsOptional()
  @IsString()
  @Length(1, 20)
  nick?: string
}
