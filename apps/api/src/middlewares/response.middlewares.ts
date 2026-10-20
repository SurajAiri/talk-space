import type { NextFunction, Request, Response } from "express";

function responseFormatter(_req: Request, res: Response, next: NextFunction) {
  res.sendResponse = (statusCode, data, message = null, meta = undefined) => {
    if (statusCode < 300) {
      return res.status(statusCode).json({
        statusCode,
        data,
        meta,
        message: message || "Success",
      });
    }
    return res.status(statusCode).json({
      statusCode,
      error: data,
      message: message || "Error",
    });
  };
  next();
}

export default responseFormatter;
