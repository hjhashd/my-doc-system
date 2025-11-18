#!/bin/bash

# 开发环境停止脚本
echo "停止文档系统开发环境..."

# 检查是否有正在运行的开发容器
if [ "$(docker ps -q -f name=doc-system-dev-container)" ]; then
    echo "正在停止开发容器..."
    docker stop doc-system-dev-container
    echo "开发容器已停止"
else
    echo "没有找到正在运行的开发容器"
fi

# 检查是否有已存在的开发容器
if [ "$(docker ps -aq -f name=doc-system-dev-container)" ]; then
    echo "删除已存在的开发容器..."
    docker rm doc-system-dev-container
    echo "开发容器已删除"
fi

echo "开发环境已清理完成！"