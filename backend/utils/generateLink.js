import { v4 as uuidv4 } from "uuid";

export function generateStreamerLink() {
  return uuidv4(); // generates unique link ID for each streamer
}