import type { ExerciseDefinition } from "./types";
import { squat } from "./squat";
import { pushUp } from "./pushUp";
import { plank } from "./plank";
import { bicepCurl } from "./bicepCurl";
import { lunge } from "./lunge";
import { rdl } from "./rdl";
import { bulgarianSplitSquat } from "./bulgarianSplitSquat";
import { legPress } from "./legPress";
import { calfRaise } from "./calfRaise";
import { overheadPress } from "./overheadPress";
import { deadlift } from "./deadlift";
import { bentOverRow } from "./bentOverRow";

export const EXERCISES: ExerciseDefinition[] = [
  squat,
  pushUp,
  plank,
  lunge,
  rdl,
  bulgarianSplitSquat,
  legPress,
  calfRaise,
  bicepCurl,
  overheadPress,
  deadlift,
  bentOverRow,
];

export const EXERCISE_CATEGORIES: Record<string, ExerciseDefinition[]> = {
  Legs: [squat, lunge, rdl, bulgarianSplitSquat, legPress, calfRaise],
  "Upper Body": [pushUp, plank, bicepCurl, overheadPress],
  Compound: [deadlift, bentOverRow],
};
