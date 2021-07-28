import { Permissions } from "../schemas/role.schema"

export class RoleDto {
  name?: string
  color?: string
  hoist?: boolean
  position?: number
  mentionable?: boolean
  permissions?: Permissions
}