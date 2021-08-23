import { IsArray, IsNumber, IsNumberString, IsOptional } from 'class-validator';
export class GetChannelMessagesDto {

  @IsOptional()
  @IsArray()
  ids?: string[];

  @IsOptional()
  @IsNumberString()
  offset?: string;

  @IsOptional()
  @IsNumberString()
  count?: string;

  @IsOptional()
  @IsNumberString()
  after?: string;

  @IsOptional()
  @IsNumberString()
  before?: string;
}
