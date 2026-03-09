/*
|--------------------------------------------------------------------------
| Real-time Upload ETA + Speed Calculator (WhatsApp Style)
|--------------------------------------------------------------------------
*/

window.UploadETA = {

    trackers: {},

    start(id, fileSize)
    {
        this.trackers[id] = {
            startTime: Date.now(),
            lastLoaded: 0,
            fileSize: fileSize
        };
    },

    update(id, loadedBytes)
    {
        const tracker = this.trackers[id];
        if(!tracker) return null;

        const now = Date.now();
        const timeElapsed = (now - tracker.startTime) / 1000; // seconds

        if(timeElapsed <= 0) return null;

        const speed = loadedBytes / timeElapsed; // bytes per second

        const remainingBytes = tracker.fileSize - loadedBytes;
        const remainingSeconds = remainingBytes / speed;

        return {
            speed: this.formatSpeed(speed),
            eta: this.formatTime(remainingSeconds)
        };
    },

    finish(id)
    {
        delete this.trackers[id];
    },

    formatSpeed(bytesPerSecond)
    {
        if(bytesPerSecond > 1024 * 1024)
            return (bytesPerSecond / (1024*1024)).toFixed(1) + " MB/s";

        return (bytesPerSecond / 1024).toFixed(1) + " KB/s";
    },

    formatTime(seconds)
    {
        if(!isFinite(seconds) || seconds < 0) return "Calculating...";

        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);

        if(mins > 0)
            return mins + "m " + secs + "s";

        return secs + "s";
    }

};