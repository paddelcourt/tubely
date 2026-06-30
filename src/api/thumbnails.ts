import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";

const path = require('node:path');
const crypto = require('crypto');

type Thumbnail = {
  data: ArrayBuffer;
  mediaType: string;
};

const videoThumbnails: Map<string, Thumbnail> = new Map();

export async function handlerGetThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }

  const thumbnail = videoThumbnails.get(videoId);
  if (!thumbnail) {
    throw new NotFoundError("Thumbnail not found");
  }

  return new Response(thumbnail.data, {
    headers: {
      "Content-Type": thumbnail.mediaType,
      "Cache-Control": "no-store",
    },
  });
}

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);


  // TODO: implement the upload here
  const formData = await req.formData();
  const file = formData.get("thumbnail");
  if (!(file instanceof File)) {
    throw new BadRequestError("Thumbnail file missing");
  }

  const MAX_UPLOAD_SIZE = 10 << 20
  const mediaType = file.type
  console.log(mediaType)
  const arrayBuffer = await file.arrayBuffer()
  const videoMetaData = getVideo(cfg.db, videoId)
  if (videoMetaData?.userID !== userID) {
    throw new UserForbiddenError("Unauthorized access to video")
  }
  const videoThumbnail: Thumbnail = { 
    data: arrayBuffer,
    mediaType: mediaType || " "
  }

  const fileExtension = mediaType.split("/")[1]
  const buffer = Buffer.from(arrayBuffer)
  const base64ImageString = buffer.toString("base64")
  videoThumbnails.set( videoId, videoThumbnail)
  console.log(fileExtension)
  const dataURL = `data:thumbnail;base64,${base64ImageString}`
  const fileNameBuf = crypto.randomBytes(32).toString("base64url")
  console.log(fileNameBuf)
  const filePath = path.join(cfg.assetsRoot, `${fileNameBuf}.${fileExtension}`)
  const URL = `http://localhost:${cfg.port}/assets/${fileNameBuf}.${fileExtension}`
  videoMetaData.thumbnailURL = URL
  updateVideo(cfg.db, videoMetaData)
  Bun.write(filePath, file)
  return respondWithJSON(200, videoMetaData);
  
}
