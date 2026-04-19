# Virtual Gym Trainer: Measuring Squat Accuracy and Exercise Form

For a virtual gym trainer, don’t treat “correct squat” as one universal angle. A better system measures **movement quality**, not just whether someone hits one fixed number.

## 1. Track the key joints

You’ll usually want pose landmarks for:

- shoulder
- hip
- knee
- ankle
- heel
- toe / foot index
- sometimes spine or neck reference points

From those landmarks, calculate joint angles and body alignment.

For a squat, the most useful measurements are:

- **knee flexion angle**
- **hip flexion angle**
- **ankle dorsiflexion angle**
- **trunk lean angle**
- **pelvis / spine alignment**
- **knee tracking relative to toes**
- **left-right symmetry**

---

## 2. Evaluate the squat in phases

Don’t score the squat from one frozen frame. Break it into stages.

### Start position

Check:

- feet stable
- chest upright
- spine neutral
- knees unlocked, not collapsing inward
- hips centered

### Descent

Check:

- hips move back and down
- knees track in the same direction as toes
- heels stay grounded
- spine stays neutral
- descent is controlled

### Bottom position

Check:

- target depth reached
- knees do not cave inward
- heels still down
- trunk lean stays within an acceptable range
- no obvious lumbar rounding if you can detect it

### Ascent

Check:

- hips and chest rise together
- knees stay aligned
- no shift to one side
- full return to standing

This phase-based approach is much better than saying “the knee angle must be exactly X.”

---

## 3. Core measurements for squat accuracy

## A. Knee angle

This is the angle formed by:

`hip -> knee -> ankle`

Use it to estimate squat depth.

Typical interpretation:

- **~160–180°** = standing / nearly straight
- **~120–140°** = partial squat
- **~90° or less** = deep squat

Don’t hard-code one exact “correct” value for everyone. Body proportions and mobility change this a lot.

A better rule:

- beginner target depth: **thighs approaching parallel**
- standard target: **hip crease at or slightly below knee level**
- advanced target: depth depends on exercise goal

So knee angle helps, but **hip-to-knee vertical relationship** is often more useful than angle alone.

## B. Hip angle

Formed by:

`shoulder -> hip -> knee`

This tells you how much the trainee is hinging at the hip.

Too little hip flexion can mean:

- knees traveling too far forward
- poor hip loading

Too much can mean:

- excessive forward fold
- weak trunk control

You want balanced hip and knee bending, not one dominating the movement.

## C. Trunk angle

Measure the angle between:

- the torso line, `shoulder -> hip`
- and a vertical reference line

This helps detect excessive forward lean.

A little forward lean is normal in squats. Too much may suggest:

- poor ankle mobility
- weak core
- poor squat pattern
- balance compensation

## D. Knee valgus / knee tracking

This is a major form-quality signal.

You want to know whether the knees move:

- in line with toes
- inward
- outward too much

A simple measure:

- compare the horizontal alignment of **hip, knee, and ankle**
- or compute the angle of the thigh and shin in the frontal view

If the knee collapses inward relative to the foot, mark it as a form fault.

## E. Heel lift / foot stability

If the heels come off the ground, that often means:

- poor ankle mobility
- balance issues
- depth compensation

You can track:

- heel landmark height relative to the ground
- pressure, if you have wearable sensors
- or foot angle changes from video

## F. Symmetry

Compare left vs right for:

- knee angle
- hip angle
- descent timing
- depth
- weight shift

A squat may look “deep enough” overall but still be poor if one side does most of the work.

---

## 4. Don’t define “correct” as one fixed angle

This is the biggest mistake.

Correct form depends on:

- body proportions
- ankle mobility
- hip mobility
- exercise type
- training goal
- injury history
- variation used

For example:

- bodyweight squat
- goblet squat
- back squat
- pistol squat

These all have different ideal mechanics.

So your app should use:

### A. Safe movement rules

Examples:

- knees track with toes
- spine stays neutral
- heels stay grounded
- depth reaches target
- movement is controlled
- no major asymmetry

### B. Exercise-specific target ranges

For example, for a bodyweight squat:

- knee angle at bottom: acceptable range, not exact value
- trunk lean: acceptable range
- left-right asymmetry below a threshold

### C. User-specific baseline

This is even better.

Let the app learn the trainee’s:

- natural standing posture
- available mobility
- comfortable depth
- limb proportions

Then score them against:

1. general safe biomechanics  
2. their own calibrated best movement

That makes feedback much more realistic.

---

## 5. A good scoring model

Instead of “correct / wrong,” use a weighted score.

### Example squat score

- depth: **25%**
- knee tracking: **20%**
- spine / trunk control: **20%**
- heel stability: **15%**
- symmetry: **10%**
- tempo / control: **10%**

Then calculate a total score out of 100.

### Example feedback

- **92/100**: strong squat, good depth and alignment
- **78/100**: acceptable, but knees drift inward near the bottom
- **61/100**: limited depth, heels lift, excessive forward lean

This is much more useful than raw angles alone.

---

## 6. How to compute joint angles

For any three points `A`, `B`, `C`, the angle at `B` is:

```text
θ = arccos( ((A - B) · (C - B)) / (|A - B| |C - B|) )