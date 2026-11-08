/** Access-token claims. Kept minimal — anything else a request handler needs
 *  is looked up fresh from the database, not trusted from the token. */
export interface JwtPayload {
  sub: string;
  email: string;
}
