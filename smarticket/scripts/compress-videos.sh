#!/usr/bin/env bash
# =========================================================
# SmarTicket – compress scroll-scrub videos for the web
# Usage:  ./scripts/compress-videos.sh [raw_dir] [out_dir]
#   raw_dir  folder with the original scene1_chaos.mp4, scene2_transition.mp4, scene3_solution.mp4 (default: raw)
#   out_dir  output folder (default: videos)
#
# For every scene it produces:
#   <name>.mp4         desktop  – up to 1920px wide, CRF 25
#   <name>_mobile.mp4  mobile   – 720p,             CRF 27
#
# Why these flags:
#   -an                    no audio track (muted anyway → smaller file)
#   -g 6 -keyint_min 6     keyframe every 6 frames (0.2s) → fast seeks backwards & forwards
#   -sc_threshold 0        fixed GOP, no surprise keyframes
#   -bf 0                  no B-frames → cheaper decode on each seek
#   -movflags +faststart   moov atom at the start → playable before full download
#   -pix_fmt yuv420p       plays everywhere (Safari/iOS included)
#   For the absolute smoothest scrubbing use -g 1 (all-intra) – roughly 3–4x larger files.
# =========================================================
set -euo pipefail

RAW_DIR="${1:-raw}"
OUT_DIR="${2:-videos}"
mkdir -p "$OUT_DIR"

for NAME in scene1_chaos scene2_transition scene3_solution; do
  IN="$RAW_DIR/$NAME.mp4"
  [ -f "$IN" ] || { echo "skip: $IN not found"; continue; }

  echo "→ $NAME (desktop)"
  ffmpeg -y -hide_banner -loglevel error -i "$IN" -an -map_metadata -1 \
    -vf "scale='min(1920,iw)':-2:flags=lanczos,fps=30,format=yuv420p" \
    -c:v libx264 -preset slow -crf 25 -profile:v high -level 4.1 \
    -g 6 -keyint_min 6 -sc_threshold 0 -bf 0 \
    -movflags +faststart "$OUT_DIR/$NAME.mp4"

  echo "→ $NAME (mobile)"
  ffmpeg -y -hide_banner -loglevel error -i "$IN" -an -map_metadata -1 \
    -vf "scale=-2:'min(720,ih)':flags=lanczos,fps=30,format=yuv420p" \
    -c:v libx264 -preset slow -crf 27 -profile:v main -level 3.1 \
    -g 6 -keyint_min 6 -sc_threshold 0 -bf 0 \
    -movflags +faststart "$OUT_DIR/${NAME}_mobile.mp4"
done

ls -lh "$OUT_DIR"/*.mp4
