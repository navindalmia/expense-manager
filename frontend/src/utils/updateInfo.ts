import * as Updates from 'expo-updates';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number): string => String(n).padStart(2, '0');

/** "upd a1b2c3d 12 Oct 19:04" for an OTA update, "embedded build" for the bundled JS, '' when unavailable. */
export function getUpdateLabel(): string {
  try {
    if (Updates.isEmbeddedLaunch || !Updates.updateId) {
      return Updates.isEmbeddedLaunch ? 'embedded build' : '';
    }
    const id = Updates.updateId.slice(0, 7);
    const d = Updates.createdAt;
    if (!d || isNaN(d.getTime())) return `upd ${id}`;
    return `upd ${id} ${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}
