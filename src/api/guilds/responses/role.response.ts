import { Role } from './../schemas/role.schema';
import myzod, { Infer } from 'myzod';

const RoleResponseSchema = myzod.object({
  id: myzod.string(),
  guild_id: myzod.string(),
  name: myzod.string(),
  permissions: myzod.object({
    allow: myzod.number(),
    deny: myzod.number()
  }),
  color: myzod.string().optional(),
  hoist: myzod.boolean().optional(),
  position: myzod.number().optional(),
  mentionable: myzod.boolean().optional(),
  default: myzod.boolean().optional(),
  members: myzod.array(myzod.string()).optional(),
})

export type RoleResponse = Infer<typeof RoleResponseSchema>;

export const RoleResponseValidate = (role: Role) => { return<RoleResponse> RoleResponseSchema.allowUnknownKeys().parse(role) }
