import { Request, Response } from 'express';
import { PrismaClient } from 'generated/prisma/client';
import { JwtPayload } from 'jsonwebtoken';

// Extended global types, interfaces or variables can be declared here
declare global {
  type request = Request & { user?: JwtPayload };
  type response = Response 
  

  var prisma: PrismaClient;
}

export {};
