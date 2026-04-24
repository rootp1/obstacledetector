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
    <main className="page">
      <div className="container">
        <header className="hero">
          <h1>Obstacle Detector</h1>
          <p>
            Upload a video to analyze obstacle presence frame-by-frame and review
            key detection metrics.
          </p>
        </header>

        <form className="card form-card" onSubmit={onSubmit}>
          <div className="form-grid">
            <label>
              Video File
              <input
                type="file"
                accept="video/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>

            <label>
              Frame Stride
              <input
                type="number"
                min="1"
                value={frameStride}
                onChange={(e) => setFrameStride(Number(e.target.value || 1))}
              />
              <small>Process every Nth frame</small>
            </label>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Processing...' : 'Upload & Detect'}
          </button>
        </form>

        {error && <p className="error">{error}</p>}

        {result && (
          <section className="grid">
            <article className="card">
              <div className="section-head">
                <h2>Video Summary</h2>
              </div>

              <div className="stats">
                <div className="stat-item">
                  <span>Total Frames</span>
                  <strong>{result.video.total_frames}</strong>
                </div>
                <div className="stat-item">
                  <span>Processed Frames</span>
                  <strong>{result.video.processed_frames}</strong>
                </div>
                <div className="stat-item">
                  <span>FPS</span>
                  <strong>{result.video.fps}</strong>
                </div>
                <div className="stat-item">
                  <span>Obstacle Frames</span>
                  <strong>{result.summary.obstacle_frames}</strong>
                </div>
                <div className="stat-item">
                  <span>Obstacle Ratio</span>
                  <strong>{result.summary.obstacle_ratio}</strong>
                </div>
              </div>

              {result.summary.closest_obstacle ? (
                <div className="highlight">
                  <p>
                    Closest obstacle is <strong>{result.summary.closest_obstacle.distance} m</strong>
                    {' '}away at frame{' '}
                    <strong>{result.summary.closest_obstacle.frame_index}</strong>
                    {' '}({result.summary.closest_obstacle.time_sec}s).
                  </p>
                </div>
              ) : (
                <div className="highlight">
                  <p>No obstacles detected in processed frames.</p>
                </div>
              )}
            </article>

            <article className="card">
              <div className="section-head">
                <h2>Detected Frames</h2>
                <span className="badge">{detectedFrames.length}</span>
              </div>

              <div className="table-head">
                <span>Frame</span>
                <span>Time</span>
                <span>Distance</span>
                <span>Confidence</span>
              </div>

              <div className="list">
                {detectedFrames.length === 0 && (
                  <p className="empty">No detections found.</p>
                )}
                {detectedFrames.map((item) => (
                  <div className="row" key={item.frame_index}>
                    <span>#{item.frame_index}</span>
                    <span>{item.time_sec}s</span>
                    <span>{item.distance} m</span>
                    <span>{item.confidence}</span>
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}
      </div>
    </main>
  )
}

export default App
