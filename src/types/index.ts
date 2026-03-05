import { Request, Response } from 'express';
import { JwtPayload } from 'jsonwebtoken';

declare global {
  type request = Request & { user?: JwtPayload };
  type response = Response 
  // interface Response {
  //   token?: {
  //     "token-refresh": string;
  //   }
  // }
}

export { };
