/**
 * Shared music style utilities
 * Used by both backend and frontend applications
 */

import { MUSIC_STYLE_DESCRIPTORS } from "./constants/music";

/**
 * Randomly select N style descriptors from the list
 */
export function getRandomStyles(count: number = 2): string[] {
  const styles = [...MUSIC_STYLE_DESCRIPTORS];
  const selected: string[] = [];
  
  for (let i = 0; i < count && styles.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * styles.length);
    selected.push(styles[randomIndex]);
    styles.splice(randomIndex, 1); // Remove to avoid duplicates
  }
  
  return selected;
}

// Re-export the constants for convenience
export { MUSIC_STYLE_DESCRIPTORS } from "./constants/music";

