#!/bin/bash
set -e

echo "🚀 Starting Standalone Jenkins Setup..."

# 1. Build custom Jenkins Docker image with Docker CLI, Docker Compose, and Go pre-installed
docker build -t custom-jenkins:latest -f jenkins/Dockerfile .

# 2. Stop & remove existing jenkins_local container if running
docker rm -f jenkins_local 2>/dev/null || true

# 3. Launch standalone Jenkins container with host Docker socket mounted
docker run -d \
  --name jenkins_local \
  -p 9090:8080 \
  -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --user root \
  custom-jenkins:latest

echo ""
echo "✅ Standalone Jenkins Setup Completed Successfully!"
echo "🌐 Access Jenkins at: http://localhost:9090"
echo "🔑 Initial Admin Password command:"
echo "   docker exec jenkins_local cat /var/jenkins_home/secrets/initialAdminPassword"
