const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('overlay');
const canvasCtx = canvasElement.getContext('2d');

let currentMode = null;
let earringImg = null;
let necklaceImg = null;
let earringSrc = '';
let necklaceSrc = '';
let lastSnapshotDataURL = '';

let smoothedLandmarks = null;

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });
}

function changeEarring(filename) {
  earringSrc = `earrings/${filename}`;
  loadImage(earringSrc).then(img => {
    if (img) earringImg = img;
  });
}

function changeNecklace(filename) {
  necklaceSrc = `necklaces/${filename}`;
  loadImage(necklaceSrc).then(img => {
    if (img) necklaceImg = img;
  });
}

function selectMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.options-group').forEach(group => group.style.display = 'none');
  if (mode) {
    document.getElementById(`${mode}-options`).style.display = 'flex';
  }
}

function insertJewelryOptions(type, containerId, startIndex, endIndex) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  for (let i = startIndex; i <= endIndex; i++) {
    const filename = `${type}${i}.png`;
    const btn = document.createElement('button');
    const img = document.createElement('img');
    img.src = `${type}s/${filename}`;
    btn.appendChild(img);
    btn.onclick = () => {
      if (type === 'earring') changeEarring(filename);
      if (type === 'necklace') changeNecklace(filename);
    };
    container.appendChild(btn);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  insertJewelryOptions('earring', 'earring-options', 1, 15);
  insertJewelryOptions('necklace', 'necklace-options', 1, 24);
});

const faceMesh = new FaceMesh({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

faceMesh.onResults((results) => {
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    const landmarks = results.multiFaceLandmarks[0];

    if (!smoothedLandmarks) {
      smoothedLandmarks = landmarks.map(p => ({ x: p.x, y: p.y }));
    } else {
      const smoothingFactor = 0.2; // lower is steadier
      for (let i = 0; i < landmarks.length; i++) {
        smoothedLandmarks[i].x = smoothedLandmarks[i].x * (1 - smoothingFactor) + landmarks[i].x * smoothingFactor;
        smoothedLandmarks[i].y = smoothedLandmarks[i].y * (1 - smoothingFactor) + landmarks[i].y * smoothingFactor;
      }
    }
  }
  // If no landmarks detected, keep previous smoothedLandmarks
  if (smoothedLandmarks) {
    drawJewelry(smoothedLandmarks, canvasCtx);
  }
});

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await faceMesh.send({ image: videoElement });
  },
  width: 1280,
  height: 720
});
camera.start();

videoElement.addEventListener('loadedmetadata', () => {
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
});

function drawJewelry(landmarks, ctx) {
  const earringScale = 0.09;
  const necklaceScale = 0.2;

  const left = {
    x: landmarks[234].x * canvasElement.width,
    y: landmarks[234].y * canvasElement.height + 8,
  };
  const right = {
    x: landmarks[454].x * canvasElement.width,
    y: landmarks[454].y * canvasElement.height + 8,
  };
  const chin = {
    x: landmarks[152].x * canvasElement.width,
    y: landmarks[152].y * canvasElement.height + 20,
  };

  if (currentMode === 'earring' && earringImg) {
    const width = earringImg.width * earringScale;
    const height = earringImg.height * earringScale;

    ctx.drawImage(
      earringImg,
      left.x - width / 2,
      left.y,
      width,
      height
    );
    ctx.drawImage(
      earringImg,
      right.x - width / 2,
      right.y,
      width,
      height
    );
  }

  if (currentMode === 'necklace' && necklaceImg) {
    const width = necklaceImg.width * necklaceScale;
    const height = necklaceImg.height * necklaceScale;

    ctx.drawImage(
      necklaceImg,
      chin.x - width / 2,
      chin.y,
      width,
      height
    );
  }
}

function takeSnapshot() {
  if (!smoothedLandmarks) {
    alert("Face not detected. Please try again.");
    return;
  }

  const snapshotCanvas = document.createElement('canvas');
  const ctx = snapshotCanvas.getContext('2d');

  snapshotCanvas.width = videoElement.videoWidth;
  snapshotCanvas.height = videoElement.videoHeight;
  ctx.drawImage(videoElement, 0, 0, snapshotCanvas.width, snapshotCanvas.height);

  drawJewelry(smoothedLandmarks, ctx);

  lastSnapshotDataURL = snapshotCanvas.toDataURL('image/png');
  document.getElementById('snapshot-preview').src = lastSnapshotDataURL;
  document.getElementById('snapshot-modal').style.display = 'block';
}

function saveSnapshot() {
  const link = document.createElement('a');
  link.href = lastSnapshotDataURL;
  link.download = `jewelry-tryon-${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function shareSnapshot() {
  if (navigator.share) {
    fetch(lastSnapshotDataURL)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], 'jewelry-tryon.png', { type: 'image/png' });
        navigator.share({
          title: 'Jewelry Try-On',
          text: 'Check out my look!',
          files: [file]
        });
      })
      .catch(console.error);
  } else {
    alert('Sharing not supported on this browser.');
  }
}

function closeSnapshotModal() {
  document.getElementById('snapshot-modal').style.display = 'none';
}

function toggleInfoModal() {
  const modal = document.getElementById('info-modal');
  modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
}
