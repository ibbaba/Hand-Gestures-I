const canvas = document.getElementById("drawingCanvas");
const ctx = canvas.getContext("2d");
const videoElement = document.getElementById("videoElement");
const backgroundVideo = document.getElementById("backgroundVideo");
const statusElement = document.getElementById("status");
const startBtn = document.getElementById("startBtn");
const toggleDrawingBtn = document.getElementById("toggleDrawingBtn");

let videoStream;
let hands;
let camera;
let isDrawingEnabled = true;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let cameraStarted = false;

// Set canvas to be transparent
ctx.globalCompositeOperation = 'source-over';

function updateStatus(message) {
    statusElement.textContent = `Status: ${message}`;
    console.log(message);
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateStatus("Canvas cleared");
}

function toggleDrawing() {
    isDrawingEnabled = !isDrawingEnabled;
    toggleDrawingBtn.textContent = `Toggle Drawing: ${isDrawingEnabled ? 'ON' : 'OFF'}`;
    updateStatus(`Drawing ${isDrawingEnabled ? 'enabled' : 'disabled'}`);
}

// Calculate if hand is in pointing gesture (index finger extended, others folded)
function isPointingGesture(landmarks) {
    // Index finger tip and pip (joint)
    const indexTip = landmarks[8];
    const indexPip = landmarks[6];
    const indexMcp = landmarks[5];
    
    // Middle finger tip and pip
    const middleTip = landmarks[12];
    const middlePip = landmarks[10];
    
    // Ring finger tip and pip
    const ringTip = landmarks[16];
    const ringPip = landmarks[14];
    
    // Pinky tip and pip
    const pinkyTip = landmarks[20];
    const pinkyPip = landmarks[18];
    
    // Check if index finger is extended (tip higher than pip)
    const indexExtended = indexTip.y < indexPip.y;
    
    // Check if other fingers are folded (tips lower than pips)
    const middleFolded = middleTip.y > middlePip.y;
    const ringFolded = ringTip.y > ringPip.y;
    const pinkyFolded = pinkyTip.y > pinkyPip.y;
    
    return indexExtended && middleFolded && ringFolded && pinkyFolded;
}

async function startCamera() {
    if (cameraStarted) {
        updateStatus("Camera already started");
        return;
    }

    try {
        updateStatus("Requesting camera access...");
        
        // Request camera access
        videoStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: "user",
                width: 640,
                height: 480
            } 
        });
        
        videoElement.srcObject = videoStream;
        backgroundVideo.srcObject = videoStream;
        await videoElement.play();
        await backgroundVideo.play();
        
        updateStatus("Camera accessed successfully. Initializing hand tracking...");

        // Initialize MediaPipe Hands
        hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.5
        });

        hands.onResults(onResults);

        // Set up camera
        camera = new Camera(videoElement, {
            onFrame: async () => {
                await hands.send({image: videoElement});
            },
            width: 640,
            height: 480
        });

        await camera.start();
        
        cameraStarted = true;
        startBtn.disabled = true;
        startBtn.textContent = "Camera Started";
        updateStatus("Hand tracking active! Point with your index finger to draw.");
        
    } catch (err) {
        console.error("Error accessing camera: ", err);
        updateStatus("Camera access failed. Please check permissions.");
        alert("Camera access failed. Please check your permissions and try again.");
    }
}

function onResults(results) {
    if (!isDrawingEnabled) return;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        // Get index finger tip position (landmark 8)
        const indexTip = landmarks[8];
        const x = indexTip.x * canvas.width;
        const y = indexTip.y * canvas.height;
        
        // Check if hand is in pointing gesture
        const isPointing = isPointingGesture(landmarks);
        
        if (isPointing) {
            if (!isDrawing) {
                // Start drawing
                isDrawing = true;
                lastX = x;
                lastY = y;
                updateStatus("Drawing started - move your finger to draw!");
            } else {
                // Continue drawing
                ctx.beginPath();
                ctx.moveTo(lastX, lastY);
                ctx.lineTo(x, y);
                ctx.strokeStyle = "#00ff00";
                ctx.lineWidth = 3;
                ctx.lineCap = "round";
                ctx.stroke();
                
                lastX = x;
                lastY = y;
            }
            
            // Draw finger position indicator
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, 2 * Math.PI);
            ctx.fillStyle = "#ff0000";
            ctx.fill();
            
        } else {
            // Hand is not pointing, stop drawing
            if (isDrawing) {
                isDrawing = false;
                updateStatus("Drawing stopped - point with index finger to continue");
            }
        }
    } else {
        // No hand detected
        if (isDrawing) {
            isDrawing = false;
            updateStatus("No hand detected - show your hand to continue");
        }
    }
}

// Fallback mouse drawing for testing
let mouseDrawing = false;

canvas.addEventListener('mousedown', (e) => {
    if (!isDrawingEnabled) return;
    mouseDrawing = true;
    const rect = canvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDrawingEnabled || !mouseDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#0099ff";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.stroke();
    
    lastX = x;
    lastY = y;
});

canvas.addEventListener('mouseup', () => {
    mouseDrawing = false;
});

// Initialize
updateStatus("Ready to start. Click 'Start Camera' button.");

