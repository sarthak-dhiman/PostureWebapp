const WebSocket = require('ws');

const NODE_ID = '8963003c-cd17-48ca-9a63-fee509d99d8b';
const wsUrl = `ws://localhost:8000/ws/api/v1/cctv/stream/${NODE_ID}/`;

console.log(`[CLIENT TEST] Connecting to ${wsUrl}...`);

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
    console.log('[CLIENT TEST] Connected successfully!');
    // Wait to see if we receive any frames
    console.log('[CLIENT TEST] Waiting for frames...');
});

ws.on('message', (data) => {
    if (typeof data === 'string') {
        const json = JSON.parse(data);
        if (json.type === 'frame') {
            console.log(`[CLIENT TEST] Received frame for camera ${json.camera_uid}. Size: ${json.data ? json.data.length : 0} bytes`);
            // We got a frame! We can exit success.
            process.exit(0);
        } else {
            console.log(`[CLIENT TEST] Received unknown JSON message type: ${json.type}`);
        }
    } else {
        console.log(`[CLIENT TEST] Received binary data of size: ${data.length}`);
    }
});

ws.on('error', (err) => {
    console.error('[CLIENT TEST] Connection Error:', err);
    process.exit(1);
});

ws.on('close', (code, reason) => {
    console.log(`[CLIENT TEST] Connection Closed: ${code} ${reason}`);
    process.exit(1);
});

// Timeout after 15 seconds
setTimeout(() => {
    console.log('[CLIENT TEST] Timeout - no frames received :(');
    process.exit(1);
}, 15000);
