---
title: "Docker 入门：从 Dockerfile 到 Container"
date: 2026-07-10
summary: "用一个虚构的五服务项目，从构建 Image、启动 Container，一路讲清 Compose、网络、Volume 与 Docker 的底层运行链路。"
tags: [docker, devops]
selected: false
draft: false
---

第一次看到 Docker 的输出时，很容易产生几个疑问：

- 为什么既有 `Image`，又有 `Container`？
- `Building Image` 是不是在“启动容器”？
- 为什么一个项目会出现很多容器？
- 删除 Container 后，数据库数据会不会一起消失？

这篇文章不依赖任何前置对话，从一个虚构项目开始，把 Docker 的完整运行过程串起来。

> 本文中的 **Maple Shop** 是专门用于讲解的虚构项目，不对应任何真实仓库、公司或线上系统。

## 1. Docker 想解决什么问题

假设我们写了一个 Java 应用。它在自己的电脑上运行正常，但交给同事或部署到服务器后，可能出现这些问题：

- 对方没有安装 Java 21；
- 系统里安装的是另一个 Java 版本；
- 缺少配置文件或系统依赖；
- 启动命令不同；
- 两个应用依赖的软件版本互相冲突。

Docker 的做法，是把应用以及它运行所需的用户空间环境整理成一份可重复使用的模板，再用这份模板启动隔离的进程环境。

最短的心智模型是：

```text
项目代码 + Dockerfile
          │
          │ docker build
          ▼
       Image
   只读的运行模板
          │
          │ docker create / docker start
          ▼
      Container
  正在运行或已停止的实例
```

因此：

- **build 负责制作 Image**；
- **create 负责从 Image 创建 Container**；
- **start 负责启动已经创建的 Container**；
- **run 通常等于 create + start**。

`docker run` 在本地找不到指定 Image 时可以先从 Registry 下载，但它不会根据 Dockerfile 自动执行 `docker build`。

## 2. 先认识示例项目：Maple Shop

Maple Shop 是一个小型网上商店，由五个职责不同的服务组成：

| 服务 | 职责 | 示例技术 |
|---|---|---|
| `web` | 展示商品和订单页面 | React + Nginx |
| `api` | 处理业务请求 | Java 21 |
| `db` | 保存商品、用户和订单 | PostgreSQL |
| `files` | 保存商品图片 | MinIO |
| `worker` | 异步生成报表、发送通知 | Node.js |

它们共同组成一个项目，但并不是同一个程序：

```text
浏览器
  │
  ▼
web ─────► api ─────► db
             │
             ├──────► files
             │
             └──────► worker（通过任务队列或任务表协作）
```

在 Docker Compose 中，通常一个服务对应一个 Container，所以这个示例会启动五个 Container。这样做便于独立更新、重启、限制资源和查看日志。

这不是“一个项目只能有一个容器”，也不是“每个容器只能有一个进程”。更准确地说：

> Container 是一个隔离的进程环境；一个 Container 可以有多个进程，但它的生命周期通常由 PID 1 进程维持。

## 3. Dockerfile、Image、Container 分别是什么

| 对象 | 它是什么 | 是否正在运行 | 是否可复用 |
|---|---|---:|---:|
| Dockerfile | 制作运行环境的步骤清单 | 否 | 是 |
| Image | build 得到的只读模板 | 否 | 是 |
| Container | 从 Image 创建的运行实例 | 可以运行，也可以停止 | 通常不作为模板复用 |

可以把它们类比成：

```text
Dockerfile = 菜谱
Image      = 按菜谱准备好的标准套餐模板
Container  = 端到某位顾客桌上的一份具体套餐
```

同一个 Image 可以创建很多 Container：

```text
maple-api:1.0 Image
       │
       ├──► maple-api-1 Container
       ├──► maple-api-2 Container
       └──► maple-api-test Container
```

这些 Container 共用相同的只读 Image 层，但拥有各自独立的可写层、进程、网络身份和运行状态。

## 4. Dockerfile 如何描述一个 Image

假设 `api` 已经被编译成 `app.jar`，可以使用下面的 Dockerfile：

```dockerfile
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY app.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
```

逐行理解：

1. `FROM`：选择包含 Java 21 运行环境的基础 Image；
2. `WORKDIR`：把后续命令的工作目录设为 `/app`；
3. `COPY`：把宿主机上的 `app.jar` 放进 Image；
4. `ENTRYPOINT`：规定 Container 启动时默认执行的程序。

执行：

```bash
docker build -t maple-api:1.0 .
```

其中：

- `docker build` 表示开始构建；
- `-t maple-api:1.0` 给 Image 设置名称和标签；
- 最后的 `.` 是 build context，也就是构建时允许 Docker 读取的文件范围。

## 5. “构建 Image”到底在做什么

构建 Image 并不是启动业务程序。BuildKit 会根据 Dockerfile 逐步制作文件系统层，并记录启动配置等元数据。

可以把构建结果简化成：

```text
Image: maple-api:1.0

┌──────────────────────────────┐
│ 元数据: 入口命令、环境变量等     │
├──────────────────────────────┤
│ COPY app.jar                 │  ← 应用层
├──────────────────────────────┤
│ Java 21 JRE                  │  ← 运行时层
├──────────────────────────────┤
│ 基础 Linux 用户空间文件         │  ← 基础层
└──────────────────────────────┘
```

Image 的几个关键特点：

### 5.1 Image 是只读模板

构建完成后，这些层作为只读内容被复用。Container 运行时产生的临时修改不会直接写回原 Image。

### 5.2 Image 由多层组成

Dockerfile 中会改变文件系统的步骤通常会形成新的层。不同 Image 可以共享相同的基础层，减少存储和下载量。

### 5.3 BuildKit 会复用缓存

如果某一步的输入没有变化，BuildKit 可以直接使用上次的结果。通常把变化较少的依赖安装放在前面，把经常变化的业务代码放在后面，会获得更好的缓存效果。

### 5.4 Image 通常不包含独立内核

Image 可以包含 Linux 用户空间文件和工具，但 Container 运行时共享宿主 Linux 内核。它不是一台完整虚拟机的磁盘快照。

在 macOS 或 Windows 上使用 Docker Desktop 时，Linux Container 实际共享的是 Docker Desktop 管理的轻量 Linux 虚拟机内核，而不是 macOS 或 Windows 内核。

## 6. Image 如何变成 Container

下面两种写法表达的是同一条主链路。

分两步执行：

```bash
docker create --name maple-api-1 maple-api:1.0
docker start maple-api-1
```

合并执行：

```bash
docker run --name maple-api-1 maple-api:1.0
```

创建 Container 时，Docker 会在 Image 之外补充运行时状态：

```text
只读 Image 层
      +
Container 独立可写层
      +
环境变量、挂载、网络配置、资源限制
      +
启动进程（通常成为 Container 内的 PID 1）
```

对于刚才的 Java 示例，启动后最重要的进程是：

```text
PID 1: java -jar app.jar
```

当 PID 1 退出时，Container 通常也会进入停止状态。Container 停止不代表它立刻被删除；可以再次 `docker start`，也可以用 `docker rm` 删除。

## 7. Container 不是“小型虚拟机”

Container 与虚拟机都能提供隔离，但实现方式不同。

| 对比项 | Container | 虚拟机 |
|---|---|---|
| 内核 | 与宿主 Linux 系统共享 | 每台虚拟机有自己的 Guest OS 内核 |
| 启动对象 | 隔离的进程环境 | 完整操作系统 |
| 启动速度 | 通常更快 | 通常更慢 |
| 体积 | 通常较小 | 通常较大 |
| 隔离边界 | namespace、cgroup 等 | Hypervisor 提供的虚拟硬件边界 |

Linux 上，Docker 主要依赖两类内核能力：

- **namespace**：让进程看到独立的 PID、网络、挂载点、主机名等视图；
- **cgroup**：统计并限制 CPU、内存等资源。

所以 Container 的本质更接近“被隔离和限制的一组进程”，而不是“删减版虚拟机”。

## 8. 文件为什么分成三类

理解 Docker 数据问题时，先分清三种来源：

```text
┌─────────────────────────────────────────┐
│ Image 只读层                             │
│ 程序、运行时、Image 中预置的配置            │
├─────────────────────────────────────────┤
│ Container 可写层                         │
│ 日志、缓存、运行期间临时修改                 │
├─────────────────────────────────────────┤
│ Volume / Bind Mount                     │
│ 需要独立于 Container 生命周期保存的数据      │
└─────────────────────────────────────────┘
```

### 8.1 Container 可写层适合临时变化

程序运行时可以写文件，但这些变化属于这个具体 Container。删除 Container 时，它的可写层也会被删除。

### 8.2 Volume 适合持久数据

数据库数据不应该只放在 Container 可写层。可以挂载一个命名 Volume：

```yaml
services:
  db:
    image: postgres:16
    volumes:
      - maple_db_data:/var/lib/postgresql/data

volumes:
  maple_db_data:
```

这里的 `/var/lib/postgresql/data` 是 PostgreSQL 在 Container 内写数据的位置，`maple_db_data` 则由 Docker 在 Container 外管理。

因此通常有：

```text
删除并重建 db Container
             │
             ▼
重新挂载同一个 maple_db_data Volume
             │
             ▼
原数据库文件仍然存在
```

`docker compose down` 默认不会删除命名 Volume；`docker compose down -v` 会请求一并删除，应谨慎使用。

### 8.3 Bind Mount 适合直接映射宿主目录

开发时常把本地源代码目录映射进 Container：

```yaml
services:
  web:
    volumes:
      - ./web:/app
```

这叫 Bind Mount。它直接对应宿主机路径，更适合本地开发或需要明确访问宿主文件的场景。

## 9. Container 之间如何通信

Docker Compose 通常会为同一个项目创建私有网络。服务可以通过服务名相互访问：

```text
api Container ─────► db:5432
api Container ─────► files:9000
web Container ─────► api:8080
```

这里的 `db`、`files` 和 `api` 类似内部 DNS 名称。

一个非常常见的误区是：

> 在 `api` Container 里，`localhost` 指向 `api` Container 自己，不是 `db` Container，也不是宿主机。

所以数据库连接地址应该类似：

```text
jdbc:postgresql://db:5432/shop
```

而不是：

```text
jdbc:postgresql://localhost:5432/shop
```

### 端口映射解决什么问题

Container 之间可以直接使用内部端口；宿主机或浏览器需要访问 Container 时，才通常需要发布端口：

```yaml
services:
  api:
    ports:
      - "8080:8080"
```

格式是：

```text
宿主机端口:Container 端口
```

此时宿主机访问 `localhost:8080`，流量会被转发到 `api` Container 的 `8080` 端口。

## 10. Docker Compose 如何组织多个服务

如果手动为五个服务逐一输入 `docker run`，命令会很长，也很难保持团队成员的配置一致。Compose 文件把这些关系集中写下来。

下面是一份教学用的简化配置：

```yaml
services:
  web:
    build: ./web
    ports:
      - "3000:80"
    depends_on:
      - api

  api:
    build: ./api
    ports:
      - "8080:8080"
    environment:
      DATABASE_URL: jdbc:postgresql://db:5432/shop
      FILES_ENDPOINT: http://files:9000
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16
    environment:
      POSTGRES_DB: shop
      POSTGRES_USER: shop
      POSTGRES_PASSWORD: local-demo-only
    volumes:
      - maple_db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U shop -d shop"]
      interval: 5s
      timeout: 3s
      retries: 10

  files:
    image: minio/minio
    command: server /data

  worker:
    build: ./worker
    environment:
      DATABASE_HOST: db
      DATABASE_PORT: 5432
    depends_on:
      db:
        condition: service_healthy

volumes:
  maple_db_data:
```

注意两种来源：

- `build: ./api` 表示根据本地 Dockerfile 构建新 Image；
- `image: postgres:16` 表示直接使用指定 Image，本地没有时通常从 Registry 下载。

执行：

```bash
docker compose up --build
```

可以把主要过程理解为：

```text
1. 读取 compose.yaml
2. 构建 web、api、worker 三个 Image
3. 拉取本地尚不存在的 postgres、minio Image
4. 创建项目网络和需要的 Volume
5. 从各自 Image 创建五个 Container
6. 启动五个 Container
7. 持续汇总它们的日志和状态
```

Compose 是编排者，不会把五个服务“合并成一个大 Container”。

## 11. Compose 完成了哪些工作

在 Maple Shop 这个教学示例中，Compose 会处理两类完全不同的资源：

| 资源操作 | 数量 |
|---|---:|
| 构建 `web`、`api`、`worker` 三个 Image | 3 |
| 启动 `web`、`api`、`db`、`files`、`worker` 五个 Container | 5 |

不要把这两类资源混成“若干个容器”：前三个结果是可复用的只读模板，后五个结果才是运行实例。这个项目最终运行的是五个 Container。

真实输出会随 Docker Compose 版本、命令、缓存和当前资源状态变化；网络、Volume、拉取 Image 等操作也可能单独出现。判断时应看每一行前面的资源类型和动作。

## 12. `Built`、`Started`、`Healthy` 有什么区别

| 状态 | 表示什么 | 能否证明业务可用 |
|---|---|---:|
| `Built` | Image 构建成功 | 不能，程序还可能没有启动 |
| `Created` | Container 已创建 | 不能，进程还可能未运行 |
| `Started` | Container 的启动命令已执行 | 不能完全证明 |
| `Healthy` | 配置的 healthcheck 连续通过 | 比 Started 更有意义 |

`Started` 只说明进程已经被启动。应用可能还在执行数据库迁移，甚至可能几秒后崩溃。

`Healthy` 依赖 Compose 或 Image 中定义的 `healthcheck`。如果没有 healthcheck，就不会凭空出现可信的健康状态。

另外，简单的 `depends_on: [db]` 主要控制启动顺序，不保证数据库已经可以接受连接。需要等待就绪时，可以结合 `condition: service_healthy`、重试机制或应用自身的容错逻辑。

## 13. Docker 内部的运行链路

日常使用时，我们输入的是 Docker 命令；背后还有多层组件协作：

```text
docker CLI
    │
    ▼
Docker Engine / dockerd
    │
    ├── 构建 Image ──► BuildKit
    │
    └── 管理 Container ──► containerd
                              │
                              ▼
                             runc
                              │
                              ▼
                  Linux namespace + cgroup
                              │
                              ▼
                         隔离的进程
```

简化理解：

- **Docker CLI**：接收 `docker build`、`docker run` 等命令；
- **Docker Engine**：管理 Image、Container、网络和 Volume；
- **BuildKit**：负责高效构建 Image；
- **containerd**：管理 Container 生命周期和 Image 内容；
- **runc**：按照 OCI 配置创建底层 Container 进程；
- **Linux 内核**：真正提供进程隔离和资源限制能力。

这也是为什么 Docker 不只是“把一个程序打包成压缩文件”。它既涉及构建产物，也涉及运行时隔离、网络、存储和生命周期管理。

## 14. 常用命令速查

| 命令 | 作用 |
|---|---|
| `docker build -t maple-api:1.0 .` | 根据 Dockerfile 构建 Image |
| `docker pull postgres:16` | 从 Registry 下载 Image |
| `docker images` | 查看本地 Image |
| `docker create IMAGE` | 从 Image 创建但不启动 Container |
| `docker start NAME` | 启动已有 Container |
| `docker run IMAGE` | 创建并启动 Container |
| `docker ps` | 查看正在运行的 Container |
| `docker ps -a` | 查看运行中和已停止的 Container |
| `docker logs -f NAME` | 持续查看 Container 日志 |
| `docker exec -it NAME sh` | 在运行中的 Container 里执行命令 |
| `docker stop NAME` | 请求停止 Container |
| `docker rm NAME` | 删除已停止的 Container |
| `docker compose up --build` | 构建并启动 Compose 项目 |
| `docker compose down` | 停止并删除 Compose 的 Container 和网络 |
| `docker compose down -v` | 在 down 基础上删除命名 Volume |

## 15. 常见误区

### 误区一：build 就是把 Image 实例化成 Container

不是。`build` 的终点是 Image；`create` 才负责创建 Container，`start` 才负责启动它。

### 误区二：Image 是一个停止的 Container

不是。Image 是只读模板，Container 是带有运行时状态和可写层的实例。两者的数据结构和职责不同。

### 误区三：一个项目只能有一个 Container

不是。项目通常按职责拆分服务，每个服务可以有一个或多个 Container。五个服务出现五个 Container 很正常。

### 误区四：进入 Container 后，`localhost` 就是自己的电脑

不是。`localhost` 总是指当前网络环境本身。在 Container 内，它通常只指这个 Container。

### 误区五：只要显示 Started，应用就一定可用

不是。Started 只表示启动动作完成；应继续检查日志、healthcheck 和实际接口。

### 误区六：删除 Container 一定会丢失所有数据

不一定。Container 可写层会丢失；挂载在命名 Volume 或 Bind Mount 中的数据可以独立保留。

### 误区七：使用 Docker 就不需要理解 Linux

Docker 隐藏了很多重复配置，但底层仍然是进程、端口、文件权限、信号、网络和存储。理解这些基础概念会让排错容易很多。

## 16. 从零到运行的完整复盘

最后用一条链路收束全文：

```text
开发者准备代码和 Dockerfile
              │
              ▼
BuildKit 执行 docker build
              │
              ▼
得到分层、只读、可复用的 Image
              │
              ▼
Docker 从 Image 创建 Container
              │
              ├── 添加独立可写层
              ├── 接入私有网络
              ├── 挂载 Volume
              ├── 设置环境变量和资源限制
              └── 启动 PID 1
              │
              ▼
Container 成为隔离运行的进程环境
```

对于 Maple Shop：

- 三个自研服务分别构建三个 Image；
- PostgreSQL 和 MinIO 使用现成 Image；
- 五个服务分别启动五个 Container；
- Compose 负责声明和协调它们；
- 服务通过私有网络和服务名通信；
- 数据库通过 Volume 把持久数据放在 Container 生命周期之外。

只要牢牢记住下面三句话，大部分 Docker 输出就不再神秘：

1. **Dockerfile 描述怎么制作，Image 保存制作结果。**
2. **Container 是从 Image 创建出来的隔离运行实例。**
3. **Compose 负责一次组织多个服务，不会把它们变成一个 Container。**
