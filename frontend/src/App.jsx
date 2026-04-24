import { useMemo, useState } from 'react'

const API_URL = 'http://localhost:5000/detect-video'

function App() {
  const [file, setFile] = useState(null)
  const [frameStride, setFrameStride] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const detectedFrames = useMemo(() => {
    if (!result?.results) return []
    return result.results.filter((r) => r.detected)
  }, [result])

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setResult(null)

    if (!file) {
      setError('Please select a video file.')
      return
    }

    try {
      setLoading(true)
      const formData = new FormData()
      formData.append('video', file)
      formData.append('frame_stride', String(frameStride))

      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Detection failed')
      }

      setResult(data)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="container">
      <h1>Obstacle Detector</h1>

      <form className="card" onSubmit={onSubmit}>
        <label>
          Video File
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>

        <label>
          Frame Stride (process every Nth frame)
          <input
            type="number"
            min="1"
            value={frameStride}
            onChange={(e) => setFrameStride(Number(e.target.value || 1))}
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? 'Processing...' : 'Upload & Detect'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {result && (
        <section className="grid">
          <article className="card">
            <h2>Video Summary</h2>
            <p>Total frames: {result.video.total_frames}</p>
            <p>Processed frames: {result.video.processed_frames}</p>
            <p>FPS: {result.video.fps}</p>
            <p>Obstacle frames: {result.summary.obstacle_frames}</p>
            <p>Obstacle ratio: {result.summary.obstacle_ratio}</p>
            {result.summary.closest_obstacle ? (
              <>
                <p>
                  Closest distance: {result.summary.closest_obstacle.distance} m
                </p>
                <p>
                  Closest frame: {result.summary.closest_obstacle.frame_index} (@{' '}
                  {result.summary.closest_obstacle.time_sec}s)
                </p>
              </>
            ) : (
              <p>No obstacles detected in processed frames.</p>
            )}
          </article>

          <article className="card">
            <h2>Detected Frames ({detectedFrames.length})</h2>
            <div className="list">
              {detectedFrames.length === 0 && <p>No detections found.</p>}
              {detectedFrames.map((item) => (
                <div className="row" key={item.frame_index}>
                  <span>Frame {item.frame_index}</span>
                  <span>{item.time_sec}s</span>
                  <span>{item.distance} m</span>
                  <span>{item.confidence}</span>
                </div>
              ))}
            </div>
          </article>
        </section>
      )}
    </main>
  )
}

export default App
