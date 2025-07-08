export interface TimerObjectType {
    progress: number,
    last: number,
    targetProgress: number,
    progressTracker: NodeJS.Timeout,
}

export function startTrackingProgress(progress: number, targetProgress?: number){
    const timerObject = {
        progress,
        last: progress,
        targetProgress: targetProgress ?? progress,
        progressTracker: setInterval(()=>{
            if (timerObject.progress !== timerObject.last){
                console.log(`Progress: ${(timerObject.progress/timerObject.targetProgress * 100).toFixed(1)}% (${timerObject.progress}/${timerObject.targetProgress})`);
                timerObject.last = timerObject.progress;
            }
        },50)
    }
    return timerObject as TimerObjectType;
}

export function stopTrackingProgress(timerObject: TimerObjectType){
    if (timerObject.progressTracker) {
        clearInterval(timerObject.progressTracker);
    }
}
