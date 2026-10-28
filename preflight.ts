import { checkPreparedSession } from './support/settings.mjs';

export default function preflight() {
  process.env.PICSIO_VIDEO_URL = checkPreparedSession();
}
