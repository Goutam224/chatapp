window.DownloadSpeed = {

    sessions: {},

    start(messageId, initialBytes = 0) {

        this.sessions[messageId] = {
            startTime: Date.now(),
            startBytes: initialBytes,
            lastBytes: initialBytes
        };

    },

    update(messageId, currentBytes, totalBytes) {

        const session = this.sessions[messageId];
        if (!session) return null;

        const now = Date.now();
        const elapsed = (now - session.startTime) / 1000;

        if (elapsed <= 0) return null;

        const bytesDownloaded = currentBytes - session.startBytes;

        const speed = bytesDownloaded / elapsed; // bytes/sec

        const remaining = totalBytes - currentBytes;

        const eta = remaining / speed;

        session.lastBytes = currentBytes;

        return {
            speedBytes: speed,
            speedMB: (speed / (1024 * 1024)).toFixed(2),
            etaSeconds: eta
        };
    },

    stop(messageId) {
        delete this.sessions[messageId];
    }

};