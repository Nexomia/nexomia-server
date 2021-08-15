import { IsArray, IsOptional, IsString, Length, MinLength } from "class-validator";

export class CreateUserChannelDto {
  @IsArray()
  recipient_ids: string[];

  @IsOptional()
  @IsString()
  @Length(1, 20)
  name?: string;

}
