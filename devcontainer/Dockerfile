# Node.js 22 LTS (official Dev Containers image)
FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bullseye

# Optional: common utilities
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    bash-completion \
 && rm -rf /var/lib/apt/lists/*

# Use devcontainers default user
WORKDIR /workspaces