#!/bin/bash

echo "=== 停止生产环境 ==="

# 停止并删除生产容器
if [ "$(docker ps -aq -f name=doc-system-container)" ]; then
    echo "停止生产容器: docker stop doc-system-container"
    docker stop doc-system-container
    
    echo "删除生产容器: docker rm doc-system-container"
    docker rm doc-system-container
    
    echo "生产环境已停止并清理"
else
    echo "未找到运行中的生产容器"
fi

# 可选：删除生产镜像（取消注释以启用）
# echo "删除生产镜像..."
# docker rmi my-doc-system 2>/dev/null || echo "生产镜像不存在或已被使用"