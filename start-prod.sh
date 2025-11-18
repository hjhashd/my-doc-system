#!/bin/bash

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

echo "=== 构建并启动生产环境 ==="

# 检查3001端口是否被其他容器占用
PORT_OCCUPIED_CONTAINER=$(docker ps --filter "publish=3001" --format "{{.ID}} {{.Names}}" | grep -v "doc-system-container" | awk '{print $1}')

if [ ! -z "$PORT_OCCUPIED_CONTAINER" ]; then
    OCCUPIED_CONTAINER_NAME=$(docker ps --filter "publish=3001" --format "{{.ID}} {{.Names}}" | grep -v "doc-system-container" | awk '{print $2}')
    echo "警告: 检测到3001端口已被容器 '$OCCUPIED_CONTAINER_NAME' (ID: $PORT_OCCUPIED_CONTAINER) 占用"
    echo "这可能会导致生产环境启动失败或端口冲突"
    read -p "是否要停止并删除占用端口的容器? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "正在停止并删除容器 '$OCCUPIED_CONTAINER_NAME'..."
        docker stop $PORT_OCCUPIED_CONTAINER
        docker rm $PORT_OCCUPIED_CONTAINER
        echo "容器已停止并删除"
    else
        echo "继续启动生产环境，但可能会遇到端口冲突问题..."
    fi
fi

# 停止并删除现有的生产容器（如果有）
if [ "$(docker ps -aq -f name=doc-system-container)" ]; then
    echo "停止并删除现有生产容器..."
    docker stop doc-system-container
    docker rm doc-system-container
    echo "现有生产容器已删除"
else
    echo "未找到运行中的生产容器"
fi

# 构建并启动生产容器
echo "构建并启动生产容器..."
cd "$SCRIPT_DIR"
docker-compose -f docker-compose.prod.yml up --build -d

echo "=== 生产环境启动完成 ==="
echo "访问地址: http://192.168.3.10:10043"
echo "查看日志: docker logs -f doc-system-container"
echo "停止环境: ./stop-prod.sh"