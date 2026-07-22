---
title: "Introduction to Docker"
summary: "A fictional five-service shop explains how Docker builds Images, starts Containers, and connects Compose, networking, Volumes, and the underlying runtime."
---

The first time you see Docker output, several questions naturally come up:

- Why do both `Image` and `Container` exist?
- Does `Building Image` mean Docker is starting a Container?
- Why can one project contain many Containers?
- If a Container is deleted, does its database data disappear too?

This article assumes no previous context. Starting from a fictional project, it connects the complete Docker execution flow from build to runtime.

> **Maple Shop** is a fictional project created solely for this explanation. It does not correspond to any real repository, company, or production system.

## 1. What problem is Docker trying to solve?

Suppose we write a Java application. It works on our own computer, but handing it to a colleague or deploying it to a server can expose several problems:

- Java 21 is not installed;
- a different Java version is installed;
- configuration files or system dependencies are missing;
- the startup command differs;
- two applications require conflicting software versions.

Docker packages the application and the user-space environment it needs into a reusable template, then uses that template to start an isolated process environment.

The shortest useful mental model is:

```text
Project code + Dockerfile
          │
          │ docker build
          ▼
       Image
  Read-only runtime template
          │
          │ docker create / docker start
          ▼
      Container
 A running or stopped instance
```

Therefore:

- **build produces an Image**;
- **create creates a Container from an Image**;
- **start starts an existing Container**;
- **run usually means create + start**.

If the requested Image is not available locally, `docker run` can first download it from a Registry. It does not automatically run `docker build` from a Dockerfile.

## 2. Meet the example project: Maple Shop

Maple Shop is a small online store made of five services with different responsibilities:

| Service | Responsibility | Example technology |
|---|---|---|
| `web` | Displays product and order pages | React + Nginx |
| `api` | Handles business requests | Java 21 |
| `db` | Stores products, users, and orders | PostgreSQL |
| `files` | Stores product images | MinIO |
| `worker` | Generates reports and sends notifications asynchronously | Node.js |

Together they form one project, but they are not one program:

```text
Browser
  │
  ▼
web ─────► api ─────► db
             │
             ├──────► files
             │
             └──────► worker (cooperates through a task queue or task table)
```

In Docker Compose, one service commonly maps to one Container, so this example starts five Containers. Each can be updated, restarted, resource-limited, and inspected independently.

This does not mean that a project may have only one Container, nor that each Container may contain only one process. More precisely:

> A Container is an isolated process environment. It may contain multiple processes, but its lifecycle is normally maintained by the PID 1 process.

## 3. Dockerfile, Image, and Container

| Object | What it is | Is it running? | Is it reusable? |
|---|---|---:|---:|
| Dockerfile | A list of steps for producing a runtime environment | No | Yes |
| Image | The read-only template produced by build | No | Yes |
| Container | A runtime instance created from an Image | It may be running or stopped | Usually not reused as a template |

An analogy:

```text
Dockerfile = recipe
Image      = standardized meal template prepared from the recipe
Container  = one concrete meal served to a customer
```

One Image can create many Containers:

```text
maple-api:1.0 Image
       │
       ├──► maple-api-1 Container
       ├──► maple-api-2 Container
       └──► maple-api-test Container
```

They share the same read-only Image layers but have separate writable layers, processes, network identities, and runtime states.

## 4. How a Dockerfile describes an Image

Assume `api` has been compiled into `app.jar`. It can use this Dockerfile:

```dockerfile
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY app.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
```

Line by line:

1. `FROM`: selects a base Image containing a Java 21 runtime;
2. `WORKDIR`: sets `/app` as the working directory for later instructions;
3. `COPY`: copies the host's `app.jar` into the Image;
4. `ENTRYPOINT`: defines the default program executed when a Container starts.

Run:

```bash
docker build -t maple-api:1.0 .
```

Here:

- `docker build` starts the build;
- `-t maple-api:1.0` gives the Image a name and tag;
- the final `.` is the build context: the file scope Docker is allowed to read during the build.

## 5. What actually happens when Docker builds an Image?

Building an Image does not start the business application. BuildKit follows the Dockerfile to produce filesystem layers and records metadata such as startup configuration.

A simplified result looks like this:

```text
Image: maple-api:1.0

┌──────────────────────────────────┐
│ Metadata: entrypoint, env, etc.  │
├──────────────────────────────────┤
│ COPY app.jar                     │  ← application layer
├──────────────────────────────────┤
│ Java 21 JRE                      │  ← runtime layer
├──────────────────────────────────┤
│ Base Linux user-space files      │  ← base layer
└──────────────────────────────────┘
```

Key Image properties:

### 5.1 An Image is a read-only template

After a build, the layers are reused as read-only content. Temporary changes made while a Container runs are not written back into the original Image.

### 5.2 An Image consists of layers

Dockerfile steps that change the filesystem usually create new layers. Different Images can share base layers, reducing storage and download size.

### 5.3 BuildKit reuses cache

If a step's inputs are unchanged, BuildKit can reuse its previous result. Put stable dependency installation early and frequently changing application code later to improve cache reuse.

### 5.4 An Image normally has no independent kernel

An Image may contain Linux user-space files and tools, but its Container shares the host Linux kernel at runtime. It is not a disk snapshot of a complete virtual machine.

On macOS or Windows, Linux Containers share the kernel of the lightweight Linux VM managed by Docker Desktop, not the macOS or Windows kernel.

## 6. How an Image becomes a Container

The following forms express the same main flow.

As two steps:

```bash
docker create --name maple-api-1 maple-api:1.0
docker start maple-api-1
```

Combined:

```bash
docker run --name maple-api-1 maple-api:1.0
```

When creating a Container, Docker adds runtime state around the Image:

```text
Read-only Image layers
      +
Container-specific writable layer
      +
Environment, mounts, networking, and resource limits
      +
Startup process (usually PID 1 inside the Container)
```

For the Java example, the important process is:

```text
PID 1: java -jar app.jar
```

When PID 1 exits, the Container normally enters the stopped state. Stopping does not immediately delete it: it can be started again with `docker start` or removed with `docker rm`.

## 7. A Container is not a small virtual machine

Containers and VMs both provide isolation, but by different mechanisms.

| Comparison | Container | Virtual machine |
|---|---|---|
| Kernel | Shares the host Linux kernel | Each VM has a Guest OS kernel |
| Startup object | Isolated process environment | Complete operating system |
| Startup speed | Usually faster | Usually slower |
| Size | Usually smaller | Usually larger |
| Isolation boundary | namespace, cgroup, and related features | Virtual hardware supplied by a Hypervisor |

Docker on Linux mainly relies on two kernel facilities:

- **namespace** gives a process isolated views of PIDs, networking, mounts, hostnames, and more;
- **cgroup** accounts for and limits CPU, memory, and other resources.

A Container is therefore closer to “a group of isolated and restricted processes” than to “a reduced virtual machine.”

## 8. Why files fall into three categories

Separate three sources when reasoning about Docker data:

```text
┌────────────────────────────────────────────┐
│ Read-only Image layers                     │
│ Program, runtime, bundled configuration    │
├────────────────────────────────────────────┤
│ Container writable layer                   │
│ Logs, caches, temporary runtime changes    │
├────────────────────────────────────────────┤
│ Volume / Bind Mount                        │
│ Data that must outlive the Container       │
└────────────────────────────────────────────┘
```

### 8.1 The writable layer suits temporary changes

Programs can write files while running, but those changes belong to that specific Container. Deleting it also deletes its writable layer.

### 8.2 A Volume suits persistent data

Database files should not live only in the Container writable layer. Mount a named Volume:

```yaml
services:
  db:
    image: postgres:16
    volumes:
      - maple_db_data:/var/lib/postgresql/data

volumes:
  maple_db_data:
```

`/var/lib/postgresql/data` is where PostgreSQL writes inside the Container; Docker manages `maple_db_data` outside the Container.

Therefore:

```text
Delete and recreate the db Container
             │
             ▼
Mount the same maple_db_data Volume again
             │
             ▼
The original database files still exist
```

`docker compose down` does not delete named Volumes by default. `docker compose down -v` requests their deletion too and should be used carefully.

### 8.3 A Bind Mount directly maps a host directory

During development, source code is often mapped into a Container:

```yaml
services:
  web:
    volumes:
      - ./web:/app
```

This is a Bind Mount. It corresponds directly to a host path and is useful in local development or whenever explicit access to host files is required.

## 9. How Containers communicate

Docker Compose normally creates a private network for a project. Services reach each other by service name:

```text
api Container ─────► db:5432
api Container ─────► files:9000
web Container ─────► api:8080
```

`db`, `files`, and `api` act like internal DNS names.

A common mistake is:

> Inside the `api` Container, `localhost` means the `api` Container itself—not the `db` Container and not the host.

The database address should therefore look like:

```text
jdbc:postgresql://db:5432/shop
```

not:

```text
jdbc:postgresql://localhost:5432/shop
```

### What does port publishing solve?

Containers can use internal ports directly. Publishing is normally needed only when the host or a browser must reach a Container:

```yaml
services:
  api:
    ports:
      - "8080:8080"
```

The format is:

```text
host port:Container port
```

The host can now access `localhost:8080`, and traffic is forwarded to port `8080` in the `api` Container.

## 10. How Docker Compose organizes multiple services

Typing a separate `docker run` for five services produces long commands and inconsistent team configuration. A Compose file records their relationships centrally.

Here is a simplified teaching configuration:

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

Notice the two sources:

- `build: ./api` builds a new Image from a local Dockerfile;
- `image: postgres:16` uses the named Image and normally downloads it from a Registry if missing locally.

Run:

```bash
docker compose up --build
```

The main process is:

```text
1. Read compose.yaml
2. Build three Images for web, api, and worker
3. Pull missing postgres and minio Images
4. Create the project network and required Volume
5. Create five Containers from their Images
6. Start all five Containers
7. Continue aggregating their logs and states
```

Compose orchestrates the services; it does not merge them into one large Container.

## 11. What work does Compose perform?

In the Maple Shop example, Compose handles two different kinds of resources:

| Resource operation | Count |
|---|---:|
| Build Images for `web`, `api`, and `worker` | 3 |
| Start Containers for `web`, `api`, `db`, `files`, and `worker` | 5 |

Do not describe both as “several Containers.” The first three results are reusable read-only templates; the latter five are runtime instances. The project ultimately runs five Containers.

Actual output varies with the Compose version, command, cache, and current resource state. Network, Volume, and Image-pull operations may appear separately. Read each line's resource type and action.

## 12. The difference between `Built`, `Started`, and `Healthy`

| State | Meaning | Proves the application is usable? |
|---|---|---:|
| `Built` | Image built successfully | No; the program may not have started |
| `Created` | Container created | No; its process may not be running |
| `Started` | Container startup command executed | Not completely |
| `Healthy` | Configured healthcheck repeatedly passed | More meaningful than Started |

`Started` only says a process was launched. The application may still be running database migrations or may crash seconds later.

`Healthy` depends on a `healthcheck` defined in Compose or the Image. Without one, Docker cannot invent a trustworthy health state.

Also, a simple `depends_on: [db]` mainly controls startup order; it does not guarantee that the database accepts connections. Use `condition: service_healthy`, retry logic, or application-level fault tolerance when readiness matters.

## 13. Docker's internal runtime path

We type Docker commands, but several components cooperate behind them:

```text
docker CLI
    │
    ▼
Docker Engine / dockerd
    │
    ├── Build Image ──► BuildKit
    │
    └── Manage Container ──► containerd
                                │
                                ▼
                               runc
                                │
                                ▼
                    Linux namespace + cgroup
                                │
                                ▼
                         Isolated processes
```

In simplified terms:

- **Docker CLI** accepts commands such as `docker build` and `docker run`;
- **Docker Engine** manages Images, Containers, networks, and Volumes;
- **BuildKit** builds Images efficiently;
- **containerd** manages Container lifecycles and Image content;
- **runc** creates low-level Container processes from OCI configuration;
- the **Linux kernel** provides the actual process isolation and resource limits.

Docker is therefore more than compressing a program into an archive. It covers build artifacts, runtime isolation, networking, storage, and lifecycle management.

## 14. Common command reference

| Command | Purpose |
|---|---|
| `docker build -t maple-api:1.0 .` | Build an Image from a Dockerfile |
| `docker pull postgres:16` | Download an Image from a Registry |
| `docker images` | List local Images |
| `docker create IMAGE` | Create a Container without starting it |
| `docker start NAME` | Start an existing Container |
| `docker run IMAGE` | Create and start a Container |
| `docker ps` | List running Containers |
| `docker ps -a` | List running and stopped Containers |
| `docker logs -f NAME` | Follow Container logs |
| `docker exec -it NAME sh` | Execute a command inside a running Container |
| `docker stop NAME` | Request that a Container stop |
| `docker rm NAME` | Delete a stopped Container |
| `docker compose up --build` | Build and start a Compose project |
| `docker compose down` | Stop and delete Compose Containers and networks |
| `docker compose down -v` | Also delete named Volumes |

## 15. Common misconceptions

### Misconception 1: build instantiates an Image as a Container

No. `build` ends with an Image. `create` creates a Container, and `start` starts it.

### Misconception 2: an Image is a stopped Container

No. An Image is a read-only template; a Container is an instance with runtime state and a writable layer. They have different structures and responsibilities.

### Misconception 3: one project can have only one Container

No. Projects commonly split responsibilities into services, and each service can have one or more Containers. Five services producing five Containers is normal.

### Misconception 4: `localhost` inside a Container means my computer

No. `localhost` always means the current network environment. Inside a Container, it normally means that Container only.

### Misconception 5: `Started` means the application is usable

No. It only means the startup action completed. Check logs, healthchecks, and the real endpoint.

### Misconception 6: deleting a Container always loses all data

Not necessarily. The writable layer is lost; data mounted in a named Volume or Bind Mount can remain independently.

### Misconception 7: Docker removes the need to understand Linux

Docker hides repetitive configuration, but the foundation remains processes, ports, file permissions, signals, networking, and storage. Understanding them makes troubleshooting much easier.

## 16. Complete review: from zero to running

The whole flow can be summarized as:

```text
Developer prepares code and Dockerfile
              │
              ▼
BuildKit executes docker build
              │
              ▼
Produces a layered, read-only, reusable Image
              │
              ▼
Docker creates a Container from the Image
              │
              ├── Adds a private writable layer
              ├── Connects a private network
              ├── Mounts Volumes
              ├── Sets environment and resource limits
              └── Starts PID 1
              │
              ▼
The Container becomes an isolated process environment
```

For Maple Shop:

- three custom services build three Images;
- PostgreSQL and MinIO use existing Images;
- five services start five Containers;
- Compose declares and coordinates them;
- services communicate through a private network and service names;
- the database stores persistent files outside the Container lifecycle through a Volume.

Remember these three statements and most Docker output becomes straightforward:

1. **A Dockerfile describes how to build; an Image stores the result.**
2. **A Container is an isolated runtime instance created from an Image.**
3. **Compose organizes multiple services together; it does not turn them into one Container.**
