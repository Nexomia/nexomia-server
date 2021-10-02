import { IsArray } from 'class-validator'

export class BulkDeleteDto {
  /**
   * An array of message ids to delete (2-100)
   */
  @IsArray()
  messages: string[]
}
