---
title: Obstacle Detector
emoji: 🐳
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# Obstacle Detector

Flask + ONNX obstacle detection backend deployed as a Hugging Face Docker Space.

## API

- `GET /` health check
- `POST /detect` image detection (base64 JSON)
- `POST /detect-video` video detection (multipart form-data with `video`)
