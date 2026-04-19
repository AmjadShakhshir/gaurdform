import { useState, useEffect, useCallback, useRef } from "react";
import { getActiveTrainingPlan, saveTrainingPlan } from "../lib/localDb";
export function useWorkoutSession() {
    const [plan, setPlan] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [completedSets, setCompletedSets] = useState({});
    const [currentExerciseIdx, setCurrentExerciseIdx] = useState(0);
    const loadPlan = useCallback(async () => {
        setIsLoading(true);
        const p = await getActiveTrainingPlan();
        setPlan(p ?? null);
        setCompletedSets({});
        setCurrentExerciseIdx(0);
        setIsLoading(false);
    }, []);
    useEffect(() => {
        loadPlan();
    }, [loadPlan]);
    const todayWorkout = plan
        ? plan.days[plan.completedWorkoutCount % plan.days.length]
        : null;
    const todayDayIndex = plan ? plan.completedWorkoutCount % plan.days.length : 0;
    const isWorkoutComplete = !!todayWorkout &&
        todayWorkout.exercises.every((ex) => (completedSets[ex.exerciseId] ?? 0) >= ex.sets);
    // Auto-advance currentExerciseIdx in guided mode when a set is marked done
    const prevSetsRef = useRef({});
    useEffect(() => {
        if (!todayWorkout)
            return;
        const currentEx = todayWorkout.exercises[currentExerciseIdx];
        if (!currentEx)
            return;
        const newCount = completedSets[currentEx.exerciseId] ?? 0;
        const oldCount = prevSetsRef.current[currentEx.exerciseId] ?? 0;
        // A new set was just completed for the current exercise
        if (newCount > oldCount && newCount >= currentEx.sets) {
            const next = currentExerciseIdx + 1;
            if (next < todayWorkout.exercises.length) {
                setCurrentExerciseIdx(next);
            }
        }
        prevSetsRef.current = completedSets;
    }, [completedSets, currentExerciseIdx, todayWorkout]);
    const markSetDone = useCallback((exerciseId) => {
        setCompletedSets((prev) => ({
            ...prev,
            [exerciseId]: (prev[exerciseId] ?? 0) + 1,
        }));
    }, []);
    const advanceToNext = useCallback(() => {
        if (!todayWorkout)
            return;
        setCurrentExerciseIdx((idx) => Math.min(idx + 1, todayWorkout.exercises.length - 1));
    }, [todayWorkout]);
    const completeWorkout = useCallback(async () => {
        if (!plan)
            return;
        const today = new Date().toISOString().split("T")[0];
        // Don't advance if already completed today
        if (plan.lastWorkoutDate === today)
            return;
        const updated = {
            ...plan,
            completedWorkoutCount: plan.completedWorkoutCount + 1,
            lastWorkoutDate: today,
        };
        await saveTrainingPlan(updated);
        setPlan(updated);
        setCompletedSets({});
        setCurrentExerciseIdx(0);
    }, [plan]);
    return {
        plan,
        isLoading,
        todayWorkout,
        todayDayIndex,
        completedSets,
        currentExerciseIdx,
        isWorkoutComplete,
        markSetDone,
        advanceToNext,
        completeWorkout,
        reloadPlan: loadPlan,
    };
}
