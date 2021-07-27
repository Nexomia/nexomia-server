import { Fingerprint } from './../../../interfaces/fingerprint.interface';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ versionKey: false })
export class User {
  /**
   * The user's id
   */  
  @Prop({ unique: true })
  id: string;

  /**
   * The user's username, not unique across the platform
   */
  @Prop({ required: true, unique: true })
  username?: string;

  /**
   * The user's 4-digit nexo-tag
   */
  @Prop({ required: true })
  discriminator?: string;

  /**
   * The user's email
   */
  @Prop({ required: true, unique: true })
  email?: string;

  /**
   * The user's password
   */
  @Prop({ required: true })
  password?: string;

  /**
   * Whether the user belongs to an OAuth2 application
   */
  @Prop({ default: false })
  bot?: boolean;

  /**
   * 	Whether the user is an Official Discord System user (part of the urgent message system)
   */
  @Prop({ default: false })
  system?: boolean;

  /**
   * Whether the email on this account has been verified
   */
  @Prop({ default: false })
  verified?: boolean;

  /**
   * The flags on a user's account
   */
  @Prop({ default: 0 })
  flags?: number;

  /**
   * The public flags on a user's account
   */
  @Prop({ default: 0 })
  public_flags?: number;

  /**
   * The type of Nitro subscription on a user's account
   */
  @Prop({ default: false })
  premium_type?: boolean;

  /**
   * whether the user is banned
   */
  @Prop({ default: false })
  banned?: boolean;

  /**
   * The user's refresh tokens
   */
  @Prop()
  tokens?: RefreshToken[];

  /**
   * The user's guilds
   */
  @Prop()
  guilds?: string[];

  /**
   * The user's friends
   */
  @Prop()
  friends?: string[];

  /**
   * The user's avatar
   */
  @Prop({ default: '' })
  avatar?: string;

  /**
   * The user's banner
   */
  @Prop({ default: '' })
  banner?: string;

  /**
   * The user's status
   */
  @Prop({ default: '' })
  status?: string;

  /**
   * The user's profile description
   */
  @Prop({ default: '' })
  description?: string;

  /**
   * The user's activity status
   * 1 - online
   * 2 - idle
   * 3 - DnD
   * 4 - offline
   */
  @Prop({ default: 4 })
  presence?: 1 | 2 | 3 | 4;
}

export class RefreshToken {
  token: string;
  ip: string;
  fingerprint: Fingerprint;
  created: number;
}

export type UserDocument = User & Document;

export const UserSchema = SchemaFactory.createForClass(User);
