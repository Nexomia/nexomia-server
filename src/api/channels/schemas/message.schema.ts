import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { User } from 'src/api/users/schemas/user.schema';

export type MessageDocument = Message & Document;

@Schema({ versionKey: false })
export class Message {
  /**
   * Id of the message
   */
  @Prop({ unique: true })
  id?: string;

  /**
   * Type of message
   */
  @Prop()
  type: number;


  /**
   * Id of the channel the message was sent in
   */
  @Prop()
  channel_id: string;

  /**
   * Id of the author od this message
   */
  @Prop()
  author: string;

  /**
   * Contents of the message
   */
  @Prop()
  content?: string;

  /**
   * When this message was created
   */
  @Prop()
  created: number;

  /**
   * whether this message was edited
   */
  @Prop({ default: false })
  edited: boolean;

  /**
   * when this message was edited
   */
  @Prop()
  edit_time?: number | null;

  /**
   * @Message array with this message revisions
   */
  @Prop()
  edit_history?: Message[] | null;
  
  /**
   * Any attached files
   */
  @Prop()
  attachments?: Attachment[] | null;

  /**
   * Ids of resent messages
   */
  @Prop()
  resentIds?: string[] | null;

  /**
   * Revision numbers of resent messages
   */
  @Prop()
  resentRevs?: string[] | null;

  /**
   * Reactions to the message
   */
  @Prop()
  reactions?: Reaction[] | null;

  /**
   * Ids of users specifically mentioned in the message
   */
  @Prop()
  mentions?: string[] | null;

  /**
   * 	Id of attached sticker
   */
  @Prop()
  sticker?: string;

  /**
   * Whether this message was deleted
   */
  @Prop({ default: false })
  deleted: boolean;

  /**
   * Any embedded content
   */
  @Prop()
  embeds?: Embed[] | null;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

export class Embed {
  /**
   * Title of embed
   */
  title?: string;

  /**
   * Type of embed (always "rich" for webhook embeds)
   * @rich - generic embed rendered from embed attributes
   * @image - image embed
   * @video - video embed
   * @gifv - animated gif image embed rendered as a video embed
   * @article - article embed
   * @link -	link embed
   * !!! Embed types should be considered deprecated and might be removed in a future API version. !!!
   */
  type?: 'rich' | 'image' | 'video' | 'gifv' | 'article' | 'link';

  /**
   * Description of embed
   */
  description?: string;

  /**
   * Url of embed
   */
  url?: string;

  /**
   * Timestamp of embed content
   */
  timestamp?: number;

  /**
   * Color code of the embed
   */
  color?: number;

  /**
   * Footer information
   */
  footer?: EmbedFooter;

  /**
   * Image information
   */
  image?: EmbedImage;

  /**
   * Thumbnail information
   */
  thumbnail?: EmbedThumbnail;

  /**
   * Video information
   */
  video?: EmbedVideo;

  /**
   * Provider information
   */
  provider?: EmbedProvider;

  /**
   * Author information
   */
  author?: EmbedAuthor;

  /**
   * Fields information
   */
  fields?: EmbedField[];
}

class EmbedThumbnail {
  /**
   * Source url of thumbnail (only supports http(s) and attachments)
   */
  url?: string;

  /**
   * A proxied url of the thumbnail
   */
  proxy_url?: string;

  /**
   * Height of thumbnail
   */
  height?: number;

  /**
   * Width of thumbnail
   */
  width?: number;
}

class EmbedVideo {
  /**
   * Source url of video
   */
  url?: string;

  /**
   * A proxied url of the video
   */
  proxy_url?: string;

  /**
   * Height of video
   */
  height?: number;

  /**
   * Width of video
   */
  width?: number;
}

class EmbedImage {
  /**
   * Source url of image (only supports http(s) and attachments)
   */
  url?: string;

  /**
   * A proxied url of the image
   */
  proxy_url?: string;

  /**
   * Height of image
   */
  height?: number;

  /**
   * Width of image
   */
  width?: number;
}

class EmbedProvider {
  /**
   * Name of provider
   */
  name?: string;

  /**
   * Url of provider
   */
  url?: string;
}

class EmbedAuthor {
  /**
   * Name of author
   */
  name?: string;

  /**
   * Url of author
   */
  url?: string;

  /**
   * Url of author icon (only supports http(s) and attachments)
   */
  icon_url?: string;

  /**
   * A proxied url of author icon
   */
  proxy_icon_url?: string;
}

class EmbedFooter {
  /**
   * Footer text
   */
  text: string;

  /**
   * Url of footer icon (only supports http(s) and attachments)
   */
  icon_url?: string;

  /**
   * A proxied url of footer icon
   */
  proxy_icon_url?: string;
}

class EmbedField {
  /**
   * Name of the field
   */
  name?: string;

  /**
   * Value of the field
   */
  value?: string;

  /**
   * Whether or not this field should display inline
   */
  inline?: boolean;
}

export class AllowedMentions {
  /**
   * An array of allowed mention types to parse from the content.
   * @roles - Controls role mentions
   * @users - Controls user mentions
   * @everyone - Controls everyone and here mentions
   */
  parse?: AllowedMentionsTypes[];

  /**
   * Array of role_ids to mention (Max size of 100)
   */
  roles?: string[];

  /**
   * Array of user_ids to mention (Max size of 100)
   */
  users?: string[];

  /**
   * For replies, whether to mention the author of the message being replied to (default false)
   */
  replied_user?: boolean;
}

type AllowedMentionsTypes = 'roles' | 'users' | 'everyone';

export class MessageReference {
  /**
   * Id of the originating message
   */
  message_id?: string;

  /**
   * Id of the originating message's channel
   */
  channel_id?: string;

  /**
   * Id of the originating message's guild
   */
  guild_id?: string;

  /**
   * When sending, whether to error if the referenced message doesn't exist instead of sending as a normal (non-reply) message, default true
   */
  fail_if_not_exists?: boolean;
}

export class Attachment {
  /**
   * Attachment id
   */
   id: string;

  /**
   * Name of file attached
   */
   filename: string;

  /**
   * The attachment's media type
   * https://en.wikipedia.org/wiki/Media_type
   */
   content_type?: string;

  /**
   * Size of file in bytes
   */
  size: number;

  /**
   * Source url of file
   */
  url: string;
  
  /**
   * A proxied url of file
   */
  proxy_url: string;

  /**
   * Height of file (if image)
   */
  height?: number;

  /**
   * Width of file (if image)
   */
   width?: number;
}

class Reaction {
  emoji_id: string;
  users: string[];
}

export enum MessageType {
  TEXT = 0,
  VOICE = 1,
  STICKER = 2,
  PIN = 3,
  JOIN = 4,
  LEAVE = 5,
}
