import type { CSSProperties } from "react";
import type { StoryStyle } from "../types";
import { storyStyles } from "../lib/storyStyles";
import atlas from "../assets/story-styles.webp";
import voiceoverAtlas from "../assets/story-styles-voiceover.webp";
import spokenAtlas from "../assets/story-styles-spoken.webp";

import extendedVoiceoverAtlas from "../assets/story-styles-voiceover-extended.webp";
import extendedSpokenAtlas from "../assets/story-styles-spoken-extended.webp";
export function StyleSample({ value }: { value: StoryStyle }) {
  const index = Math.max(
    0,
    storyStyles.findIndex((s) => s.id === value),
  );
  const tile =
    index < 12
      ? index
      : index < 24
        ? index - 12
        : index < 34
          ? index - 24
          : index < 46
            ? index - 34
            : index - 46;
  const style: CSSProperties = {
    backgroundImage: `url(${index < 12 ? atlas : index < 24 ? voiceoverAtlas : index < 34 ? spokenAtlas : index < 46 ? extendedVoiceoverAtlas : extendedSpokenAtlas})`,
    backgroundPosition: `${((tile % 4) / 3) * 100}% ${(Math.floor(tile / 4) / 2) * 100}%`,
  };
  return (
    <span className="story-style-sample" style={style} aria-hidden="true" />
  );
}
