# Node.js 22 LTS（Dev Containers 官方镜像）
FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bullseye

# 可选：常用工具
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    bash-completion \
 && rm -rf /var/lib/apt/lists/*

# 使用 devcontainers 预置用户
WORKDIR /workspaces