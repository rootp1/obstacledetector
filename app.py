from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import onnxruntime as ort
import base64
import os
import tempfile

app = Flask(__name__)
CORS(app)  # React se connection allow karta hai

# ══ CONFIG (same as tumhara code) ══
FOCAL_LENGTH = 540
CAMERA_HEIGHT = 0.5
THRESHOLD_DIST = 5.0
CONF_THRESHOLD = 0.4
INPUT_SIZE = 320

# ══ ONNX MODEL LOAD ══
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "best.onnx")
session = ort.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])
input_name = session.get_inputs()[0].name

def calculate_distance(bbox_bottom_y, frame_height):
    pixel_offset = bbox_bottom_y - (frame_height / 2)
    if pixel_offset <= 0:
        return 9999
    return round((CAMERA_HEIGHT * FOCAL_LENGTH) / pixel_offset, 2)

def preprocess(img):
    img_resized = cv2.resize(img, (INPUT_SIZE, INPUT_SIZE))
    img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB)
    img_float = img_rgb.astype(np.float32) / 255.0
    img_transposed = np.transpose(img_float, (2, 0, 1))
    return np.expand_dims(img_transposed, axis=0)

def postprocess(outputs, orig_h, orig_w):
    predictions = outputs[0][0]  # shape: (num_detections, 6)
    results = []
    for pred in predictions.T:
        x_c, y_c, w, h = pred[0], pred[1], pred[2], pred[3]
        scores = pred[4:]
        conf = float(np.max(scores))
        if conf < CONF_THRESHOLD:
            continue
        # Convert to pixel coords (original frame size)
        x1 = int((x_c - w/2) / INPUT_SIZE * orig_w)
        y1 = int((y_c - h/2) / INPUT_SIZE * orig_h)
        x2 = int((x_c + w/2) / INPUT_SIZE * orig_w)
        y2 = int((y_c + h/2) / INPUT_SIZE * orig_h)
        results.append({
            "x1": x1, "y1": y1, "x2": x2, "y2": y2,
            "confidence": round(conf, 3)
        })
    return results

def detect_frame(frame):
    orig_h, orig_w = frame.shape[:2]
    input_tensor = preprocess(frame)
    outputs = session.run(None, {input_name: input_tensor})
    detections = postprocess(outputs, orig_h, orig_w)

    if not detections:
        return {
            "detected": False,
            "distance": None,
            "confidence": None,
            "bbox": None,
        }

    best = max(detections, key=lambda d: d["confidence"])
    distance = calculate_distance(best["y2"], orig_h)

    return {
        "detected": True,
        "distance": distance,
        "confidence": best["confidence"],
        "bbox": {
            "x1_pct": round(best["x1"] / orig_w * 100, 1),
            "y1_pct": round(best["y1"] / orig_h * 100, 1),
            "x2_pct": round(best["x2"] / orig_w * 100, 1),
            "y2_pct": round(best["y2"] / orig_h * 100, 1),
        },
    }

@app.route("/detect", methods=["POST"])
def detect():
    try:
        data = request.get_json()
        img_data = base64.b64decode(data["image"])
        np_arr = np.frombuffer(img_data, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        result = detect_frame(frame)
        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/detect-video", methods=["POST"])
def detect_video():
    temp_path = None
    try:
        if "video" not in request.files:
            return jsonify({"error": "No video file uploaded. Use form field 'video'."}), 400

        video_file = request.files["video"]
        if video_file.filename == "":
            return jsonify({"error": "Empty filename."}), 400

        frame_stride = request.form.get("frame_stride", default=10, type=int)
        frame_stride = max(1, frame_stride)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp_video:
            video_file.save(temp_video.name)
            temp_path = temp_video.name

        cap = cv2.VideoCapture(temp_path)
        if not cap.isOpened():
            return jsonify({"error": "Unable to read uploaded video."}), 400

        fps = cap.get(cv2.CAP_PROP_FPS)
        if not fps or fps <= 0:
            fps = 30.0

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        processed_count = 0
        frame_results = []

        frame_index = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_index % frame_stride == 0:
                result = detect_frame(frame)
                frame_results.append({
                    "frame_index": frame_index,
                    "time_sec": round(frame_index / fps, 2),
                    **result,
                })
                processed_count += 1

            frame_index += 1

        cap.release()

        detected_frames = [item for item in frame_results if item["detected"]]
        closest = min(detected_frames, key=lambda x: x["distance"]) if detected_frames else None

        return jsonify({
            "video": {
                "total_frames": total_frames,
                "processed_frames": processed_count,
                "fps": round(fps, 2),
                "frame_stride": frame_stride,
            },
            "summary": {
                "obstacle_frames": len(detected_frames),
                "obstacle_ratio": round(len(detected_frames) / processed_count, 3) if processed_count else 0,
                "closest_obstacle": closest,
            },
            "results": frame_results,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

if __name__ == "__main__":
    print("✅ Backend chal raha hai — http://localhost:5000")
    app.run(debug=True, port=5000)