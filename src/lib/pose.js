import { PoseLandmarker, FilesetResolver, } from "@mediapipe/tasks-vision";
/**
 * MediaPipe Pose landmark indices. Reference:
 * https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
 */
export const LM = {
    NOSE: 0,
    LEFT_EAR: 7,
    RIGHT_EAR: 8,
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13,
    RIGHT_ELBOW: 14,
    LEFT_WRIST: 15,
    RIGHT_WRIST: 16,
    LEFT_HIP: 23,
    RIGHT_HIP: 24,
    LEFT_KNEE: 25,
    RIGHT_KNEE: 26,
    LEFT_ANKLE: 27,
    RIGHT_ANKLE: 28,
    LEFT_HEEL: 29,
    RIGHT_HEEL: 30,
    LEFT_FOOT_INDEX: 31,
    RIGHT_FOOT_INDEX: 32,
};
export async function createPoseEngine(opts = {}) {
    const { useGPU = true, modelVariant = "full" } = opts;
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm");
    const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${modelVariant}/float16/1/pose_landmarker_${modelVariant}.task`,
            delegate: useGPU ? "GPU" : "CPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.6,
        minPosePresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
    });
    return {
        landmarker,
        dispose: () => landmarker.close(),
    };
}
/**
 * Pose connections for drawing a skeleton. Pairs of landmark indices.
 */
export const POSE_CONNECTIONS = [
    [11, 12], // shoulders
    [11, 13], [13, 15], // left arm
    [12, 14], [14, 16], // right arm
    [11, 23], [12, 24], // torso sides
    [23, 24], // hips
    [23, 25], [25, 27], // left leg
    [24, 26], [26, 28], // right leg
];
