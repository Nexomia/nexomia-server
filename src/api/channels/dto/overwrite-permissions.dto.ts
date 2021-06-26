export class OverwritePermissionsDto {
  /**
   * The bitwise value of all allowed permissions
   */
  allow: string;

  /**
   * The bitwise value of all disallowed permissions
   */
  deny: string;

  /**
   * 0 for a role or 1 for a member
   */
  type: number;
}
