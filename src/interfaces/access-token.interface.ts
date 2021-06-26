export class AccessToken {
  id: string;
  uid: string;
  expires: number;
  rules?: number | Array<string>;
  bot: boolean;
  hash?: string;
}
