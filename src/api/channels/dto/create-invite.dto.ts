export class CreateInviteDto {
  /**
   * Duration of invite in seconds before expiry, or 0 for never. between 0 and 604800 (7 days)
   */
  max_age?: number;

  /**
   * Max number of uses or 0 for unlimited. between 0 and 100
   */
  max_uses?: number;

  /**
   * Whether this invite only grants temporary membership
   */
  temporary?: boolean;

  /**
   * If true, don't try to reuse a similar invite (useful for creating many unique one time use invites)
   */
  unique?: boolean;
}
