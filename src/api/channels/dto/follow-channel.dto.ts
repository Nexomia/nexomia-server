import { IsNumberString } from "class-validator";

export class FollowChannelDto {
  /**
   * Id of target channel
   */
  @IsNumberString()
  webhook_channel_id: string;
}
