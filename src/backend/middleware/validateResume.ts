import { Request, Response, NextFunction } from "express";
import multer from "multer";

// 1. Basic Gateway Filter Configuration (Only accepts files under 10MB)

export const uploadFilter = multer({
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("INVALID_FILE_FORMAT"));
    }
    cb(null, true);
  },
}).single("resume");

// 2. Advanced Middleware Validation for Checking Binary Content (Magic Bytes)
export const validateResumeMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  uploadFilter(req, res, (err) => {
    if (err) {
      if (err.message === "INVALID_FILE_FORMAT") {
        return res.status(400).json({
          status: "error",
          code: "HTTP_400_BAD_REQUEST",
          message:
            "Validation failed: Document must be a valid PDF format constraint!",
        });
      }

      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          status: "error",
          code: "HTTP_400_BAD_REQUEST",
          message: "Validation failed: File size boundary limits exceed 10MB!",
        });
      }
      return res.status(500).json({ status: "error", message: err.message });
    }

    if (!req.file) {
      return res
        .status(400)
        .json({ status: "error", message: "No file asset detected!" });
    }

    const buffer = req.file.buffer;

    if (buffer.toString("utf-8", 0, 4) !== "%PDF") {
      return res.status(400).json({
        status: "error",
        code: "HTTP_400_BAD_REQUEST",
        message:
          "Validation failed: Spoofed file asset detected. Magic byte do not match PDF!",
      });
    }
    next();
  });
};
