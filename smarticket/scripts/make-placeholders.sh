#!/usr/bin/env bash
# Generates synthetic placeholder clips (for previewing the page before the real videos are ready).
# Usage: ./scripts/make-placeholders.sh   → writes into ./raw, then run compress-videos.sh
set -euo pipefail
mkdir -p raw
D=8
ffmpeg -y -hide_banner -loglevel error -f lavfi \
  -i "life=s=320x180:mold=10:rate=30:ratio=0.12:death_color=#070B14:life_color=#EF4444:mold_color=#7C2D12,scale=1920:1080:flags=neighbor,gblur=sigma=1.5" \
  -t $D -pix_fmt yuv420p raw/scene1_chaos.mp4
ffmpeg -y -hide_banner -loglevel error -f lavfi \
  -i "mandelbrot=s=1920x1080:rate=30:end_scale=0.02,format=gray,lutrgb=r=val*0.15:g=val*0.7:b=val" \
  -t $D -pix_fmt yuv420p raw/scene2_transition.mp4
ffmpeg -y -hide_banner -loglevel error -f lavfi \
  -i "gradients=s=1920x1080:rate=30:c0=0x070B14:c1=0x2563EB:c2=0x06B6D4:c3=0x0F172A:n=4:speed=0.03" \
  -t $D -pix_fmt yuv420p raw/scene3_solution.mp4
echo "placeholders written to ./raw"
