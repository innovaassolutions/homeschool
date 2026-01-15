import React, { useState } from 'react';

// Simple standalone camera demo
function App() {
  const [showDemo, setShowDemo] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);

  const handleStartDemo = () => {
    setShowDemo(true);
  };

  const handleOpenCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }
      });

      // Create video element
      const video = document.getElementById('camera-video') as HTMLVideoElement;
      if (video) {
        video.srcObject = stream;
        video.play();
        setCameraActive(true);
      }
    } catch (error) {
      console.error('Camera access denied:', error);
      alert('Camera access is required to test the photo capture features. Please allow camera permissions and try again.');
    }
  };

  const handleCapturePhoto = () => {
    const video = document.getElementById('camera-video') as HTMLVideoElement;
    const canvas = document.getElementById('capture-canvas') as HTMLCanvasElement;

    if (video && canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        const photoData = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedPhotos(prev => [...prev, photoData]);

        // Stop camera after capture for demo
        const stream = video.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        setCameraActive(false);
      }
    }
  };

  const handleCloseCamera = () => {
    const video = document.getElementById('camera-video') as HTMLVideoElement;
    if (video && video.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setCameraActive(false);
  };

  if (!showDemo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-blue-600 mb-2">📚 Homeschool Learning</h1>
            <p className="text-gray-600">AI-Powered Camera Integration Demo</p>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3">✨ Camera Features Demo:</h2>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• 📸 WebRTC camera access</li>
              <li>• 🎯 Photo capture interface</li>
              <li>• 📊 Photo gallery display</li>
              <li>• 🖼️ Session photo management</li>
              <li>• 🔍 Content detection ready</li>
            </ul>
          </div>

          <button
            onClick={handleStartDemo}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            🚀 Start Camera Demo
          </button>

          <p className="text-xs text-gray-500 text-center mt-4">
            * Requires camera permissions
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-blue-600">📸 Camera Integration Demo</h1>
            <p className="text-sm text-gray-600">Testing WebRTC photo capture for AI tutoring</p>
          </div>
          <button
            onClick={() => setShowDemo(false)}
            className="text-gray-600 hover:text-gray-800 text-sm"
          >
            ← Back
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Camera Interface */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📷 Camera Capture</h2>

          {!cameraActive ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📸</div>
              <h3 className="text-lg font-medium mb-2">Ready to capture photos</h3>
              <p className="text-gray-600 mb-6">
                Click below to open camera and test photo capture functionality
              </p>
              <button
                onClick={handleOpenCamera}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                📸 Open Camera
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  id="camera-video"
                  className="w-full h-64 object-cover"
                  autoPlay
                  playsInline
                  muted
                />
                <div className="absolute top-4 right-4 flex gap-2">
                  <button
                    onClick={handleCapturePhoto}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    📷 Capture
                  </button>
                  <button
                    onClick={handleCloseCamera}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors"
                  >
                    ✕ Close
                  </button>
                </div>
              </div>

              <p className="text-sm text-gray-600 text-center">
                Position your work or materials in the camera view and click "Capture" to take a photo
              </p>
            </div>
          )}
        </div>

        {/* Photo Gallery */}
        {capturedPhotos.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">🖼️ Captured Photos ({capturedPhotos.length})</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {capturedPhotos.map((photo, index) => (
                <div key={index} className="relative group">
                  <img
                    src={photo}
                    alt={`Captured photo ${index + 1}`}
                    className="w-full h-48 object-cover rounded-lg border border-gray-200"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg" />
                  <div className="absolute bottom-2 left-2 bg-white bg-opacity-90 px-2 py-1 rounded text-xs font-medium">
                    Photo {index + 1}
                  </div>

                  {/* Demo quality indicators */}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <span className="bg-green-500 text-white text-xs px-2 py-1 rounded">✅ Good Quality</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-800 mb-2">🔍 AI Analysis Ready</h3>
              <p className="text-sm text-blue-700">
                In the full system, these photos would be processed for:
              </p>
              <ul className="text-sm text-blue-700 mt-2 space-y-1">
                <li>• Quality assessment and optimization</li>
                <li>• Text and handwriting detection</li>
                <li>• Math problem identification</li>
                <li>• Content analysis for tutoring context</li>
                <li>• Secure temporary storage with auto-cleanup</li>
              </ul>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-yellow-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-800 mb-3">💡 Demo Instructions</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-yellow-700">
            <li>Click "📸 Open Camera" to access your device camera</li>
            <li>Allow camera permissions when prompted by your browser</li>
            <li>Position worksheets, books, or materials in the camera view</li>
            <li>Click "📷 Capture" to take a photo</li>
            <li>View captured photos in the gallery below</li>
            <li>In the full system, photos integrate with learning sessions</li>
          </ol>

          <div className="mt-4 p-3 bg-yellow-100 border border-yellow-200 rounded">
            <p className="text-xs text-yellow-800">
              <strong>Note:</strong> This is a simplified demo. The full implementation includes
              age-adaptive interfaces, session management, photo quality assessment, and AI analysis preparation.
            </p>
          </div>
        </div>
      </main>

      {/* Hidden canvas for photo capture */}
      <canvas id="capture-canvas" style={{ display: 'none' }} />
    </div>
  );
}

export default App;