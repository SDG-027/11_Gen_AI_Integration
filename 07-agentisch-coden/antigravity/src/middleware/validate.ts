import type { Request, Response, NextFunction } from 'express';
import type { AnyZodObject } from 'zod';

export const validate = (schema: AnyZodObject) => {

  
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      
      // Update requests with parsed and validated/cast data
      if (parsed.body) req.body = parsed.body;
      if (parsed.query) {
        // req.query is a getter/read-only property in Express, we overwrite its keys
        for (const key of Object.keys(req.query)) {
          delete req.query[key];
        }
        Object.assign(req.query, parsed.query);
      }
      if (parsed.params) {
        Object.assign(req.params, parsed.params);
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};
