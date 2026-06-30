import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
    if (!videoId) {
      throw new BadRequestError("Invalid video ID");
  }

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);
  const formData = await req.formData();
  const file = formData.get("video");
  if (!(file instanceof File)) {
    throw new BadRequestError("Video file missing");
  }
  const MAX_UPLOAD_SIZE = 1 << 30
  const mediaType = file.type
  console.log(mediaType)
  const videoMetaData = getVideo(cfg.db, videoId)
  if (videoMetaData?.userID !== userID) {
    throw new UserForbiddenError("Unauthorized access to video")
  }
  if (file.size > MAX_UPLOAD_SIZE){
    throw new BadRequestError("File size is too big")
  }

  if (mediaType !== "video/mp4") {
    throw new BadRequestError("File is not mp4")
  }
  const fileExtension = mediaType.split("/")[1]
  const fileName = `${videoId}.${fileExtension}`
  const URL = `https://${cfg.s3Bucket}.s3.${cfg.s3Region}.amazonaws.com/${videoId}.${fileExtension}`
  console.log(URL)
  const client = cfg.s3Client
  await client.write(fileName, file, {
    type: mediaType})
  videoMetaData.videoURL = URL
  updateVideo(cfg.db, videoMetaData)
  return respondWithJSON(200, videoMetaData);
}
