// The "How this site works" tour: one list of steps, read by the page and by scripts/capture-screens.mjs.
import manifest from "./screens.json";

export type TourTheme = "light" | "dark";
export type TourStep = {
  id: string;
  title: string;
  caption: string;
  /** How scripts/capture-screens.mjs reaches this screen. `/history/:latest` is the newest saved plan. */
  capture: { path: string; session: boolean; scrollTo?: string };
};

export const TOUR: TourStep[] = manifest.steps;

/** Screenshots are 390×844 phone viewports at 2× scale. */
export const TOUR_IMAGE = { width: 390, height: 844 };

/** Public URL of a step's screenshot; the file lives under public/. */
export const tourImage = (id: string, theme: TourTheme) => `/tour/${id}-${theme}.webp`;
