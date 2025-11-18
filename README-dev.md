# 文档系统热开发环境

这个项目配置了支持热重载的Docker开发环境，让您可以在修改代码后立即看到效果，无需重新构建和启动容器。

## 环境区分

项目现在有两个独立的环境配置：

- **开发环境**：使用 `Dockerfile.dev` 和 `docker-compose.dev.yml`
- **生产环境**：使用 `Dockerfile` 和 `docker-compose.prod.yml`

## 快速开始

### 启动开发环境

```bash
./start-dev.sh
```

这个脚本会：
1. 停止并删除现有的开发容器（如果有）
2. 构建并启动新的开发容器
3. 启用热重载功能

### 启动生产环境

```bash
./start-prod.sh
```

这个脚本会：
1. 停止并删除现有的生产容器（如果有）
2. 构建并启动新的生产容器
3. 使用优化的生产配置

### 停止开发环境

```bash
./stop-dev.sh
```

### 停止生产环境

```bash
./stop-prod.sh
```

## 开发环境特点

1. **热重载**：代码修改后会自动重新加载，无需重启容器
2. **源码挂载**：整个项目目录挂载到容器中，修改会立即生效
3. **依赖隔离**：node_modules和.next目录独立挂载，避免主机和容器环境冲突
4. **OnlyOffice支持**：配置了正确的环境变量，支持IP地址访问

## 环境变量配置

开发环境使用以下环境变量：

- `PORT=3001`：应用端口
- `NODE_ENV=development`：开发环境标识
- `NEXT_PUBLIC_BASE_URL=http://192.168.3.10:10043`：前端访问URL
- `NEXT_PUBLIC_DS_BASE_URL=http://host.docker.internal:10043`：文档服务器URL
- `BASE_URL=http://192.168.3.10:10043`：后端访问URL
- `DS_BASE_URL=http://host.docker.internal:10043`：文档服务器后端URL

## 访问应用

启动开发环境后，您可以通过以下URL访问应用：

http://192.168.3.10:10043

## 查看日志

要查看开发容器的日志：

```bash
docker logs -f doc-system-dev-container
```

## 常见问题

### OnlyOffice下载失败

如果您遇到OnlyOffice下载失败的问题，可能是因为回调URL配置不正确。我们已经修改了代码，确保它能够正确处理IP地址和域名两种访问方式。

### 端口冲突

如果3001端口已被占用，您可以修改docker-compose.dev.yml中的端口映射。

### 依赖问题

如果遇到依赖问题，可以尝试重新构建容器：

```bash
./stop-dev.sh
./start-dev.sh
```

## 手动构建说明

如果您想手动构建容器，请注意以下区别：

### 开发环境构建
```bash
# 明确指定使用开发环境的Dockerfile
docker build -f Dockerfile.dev -t my-doc-system-dev .

# 或者使用docker-compose
docker-compose -f docker-compose.dev.yml up --build
```

### 生产环境构建
```bash
# 默认使用Dockerfile（生产环境）
docker build -t my-doc-system .

# 或者明确指定
docker build -f Dockerfile -t my-doc-system .

# 或者使用docker-compose
docker-compose -f docker-compose.prod.yml up --build
```

**重要提示**：当您在项目根目录运行 `docker build -t my-doc-system .` 时，Docker会自动使用当前目录下的 `Dockerfile`（不带任何后缀），这是我们的生产环境配置文件。

## 生产环境部署

生产环境部署请使用原来的Dockerfile和docker run命令：

```bash
docker run -d \
  -p 127.0.0.1:3001:3001 \
  -e PORT=3001 \
  -e NEXT_PUBLIC_BASE_URL="http://192.168.3.10:10043" \
  -e NEXT_PUBLIC_DS_BASE_URL="http://host.docker.internal:10043" \
  -e BASE_URL="http://192.168.3.10:10043" \
  -e DS_BASE_URL="http://host.docker.internal:10043" \
  -v /home/cqj/my-doc-system-uploads/upload:/app/public/upload \
  -v /home/cqj/my-doc-system-uploads/save:/app/public/save \
  --add-host=host.docker.internal:host-gateway \
  --name doc-system-container \
  --restart always \
  my-doc-system
```

### 访问方式
- 生产环境: http://192.168.3.10:10043
- 开发环境: http://192.168.3.10:10044

### 日志查看
```bash
# 查看生产环境日志
docker logs -f doc-system-container

# 查看开发环境日志
docker logs -f doc-system-dev-container
```