#!/bin/bash

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# 开发环境启动脚本
echo "启动文档系统开发环境..."

# 检查3001端口是否被其他容器占用
PORT_OCCUPIED_CONTAINER=$(docker ps --filter "publish=3001" --format "{{.ID}} {{.Names}}" | grep -v "doc-system-dev-container" | awk '{print $1}')

if [ ! -z "$PORT_OCCUPIED_CONTAINER" ]; then
    OCCUPIED_CONTAINER_NAME=$(docker ps --filter "publish=3001" --format "{{.ID}} {{.Names}}" | grep -v "doc-system-dev-container" | awk '{print $2}')
    echo "警告: 检测到3001端口已被容器 '$OCCUPIED_CONTAINER_NAME' (ID: $PORT_OCCUPIED_CONTAINER) 占用"
    echo "这可能会导致开发环境启动失败或端口冲突"
    read -p "是否要停止并删除占用端口的容器? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "正在停止并删除容器 '$OCCUPIED_CONTAINER_NAME'..."
        docker stop $PORT_OCCUPIED_CONTAINER
        docker rm $PORT_OCCUPIED_CONTAINER
        echo "容器已停止并删除"
    else
        echo "继续启动开发环境，但可能会遇到端口冲突问题..."
    fi
fi

# 检查是否有正在运行的开发容器
if [ "$(docker ps -q -f name=doc-system-dev-container)" ]; then
    echo "检测到正在运行的开发容器，正在停止..."
    docker stop doc-system-dev-container
fi

# 检查是否有已存在的开发容器
if [ "$(docker ps -aq -f name=doc-system-dev-container)" ]; then
    echo "删除已存在的开发容器..."
    docker rm doc-system-dev-container
fi

# 构建并启动开发容器
echo "构建并启动开发容器..."
cd "$SCRIPT_DIR"
docker-compose -f docker-compose.dev.yml up --build -d

echo "开发环境已启动！"
echo "您可以通过 http://192.168.3.10:10043 访问应用"
echo "代码修改将自动热重载，无需重启容器"
echo ""
echo "查看日志: docker logs -f doc-system-dev-container"
echo "停止容器: docker stop doc-system-dev-container"