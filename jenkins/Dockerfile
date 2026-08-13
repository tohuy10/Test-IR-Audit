FROM jenkins/jenkins:lts

USER root

# Install Docker CLI, Go, and curl
RUN apt-get update && apt-get install -y \
    docker.io \
    curl \
    ca-certificates \
    golang-go \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Docker Compose CLI plugin
RUN mkdir -p /usr/libexec/docker/cli-plugins && \
    curl -SL https://github.com/docker/compose/releases/download/v2.27.0/docker-compose-linux-x86_64 -o /usr/libexec/docker/cli-plugins/docker-compose && \
    chmod +x /usr/libexec/docker/cli-plugins/docker-compose

USER jenkins
