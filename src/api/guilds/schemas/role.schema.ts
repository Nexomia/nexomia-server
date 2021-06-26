import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RoleDocument = Role & Document;

@Schema({ versionKey: false })
export class Role {

  @Prop({ unique: true })
  id?: string;

  @Prop({ default: 'new role' })
  name?: string;

  @Prop()
  members: string[];

  // @Prop()
  // permissions: Permissions;

  @Prop({ default: '#fff' })
  color?: string;

  @Prop({ default: false })
  hoist?: boolean;

  @Prop()
  position?: number;

  @Prop({ default: true })
  mentionable?: boolean;

}

export const RoleSchema = SchemaFactory.createForClass(Role);
