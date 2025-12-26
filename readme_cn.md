# 🐍 Python Manager (中文说明)

[English Documentation](README.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.7+](https://img.shields.io/badge/python-3.7+-blue.svg)](https://www.python.org/downloads/)
[![Flask](https://img.shields.io/badge/flask-%23000.svg?style=flat&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)

一个基于 Web 的工具，用于管理多个 Python 脚本，支持实时监控、日志记录和控制。非常适合管理微服务、数据管道、后台任务或任何 Python 脚本集合。

![image](https://github.com/user-attachments/assets/a6a85295-43cb-40b3-97fe-0608c59bcaf5)


## ✨ 功能特性

- **🚀 多脚本管理**：从系统任何位置启动、停止和重启 Python 脚本
- **✏️ 脚本编辑**：直接从 UI 编辑脚本配置（参数、解释器、内存限制）
- **📊 实时监控**：跟踪每个脚本的 CPU 和内存使用情况
- **🔄 自动重启**：脚本失败时自动重启，支持配置重试限制
- **📝 集中日志**：在一个地方查看所有脚本的日志
- **🌐 Web 界面**：现代、响应式的仪表板，可从任何浏览器访问
- **🔌 REST API**：完整的 API 用于程序化控制和自动化
- **📁 灵活路径支持**：添加系统上任何位置的脚本
- **⚡ WebSocket 支持**：无需刷新页面即可获得实时状态更新
- **🎯 轻松部署**：针对不同用例的多种安装选项

## 🚀 快速开始

### 选项 1：交互式安装（推荐）
```bash
git clone https://github.com/prismatex/python-manager.git
cd python-manager
python deploy/setup.py
```

### 选项 2：直接运行
```bash
# 克隆仓库
git clone https://github.com/prismatex/python-manager.git
cd python-manager

# 安装依赖
pip install -r requirements.txt

# (可选) 下载 Socket.IO 以供离线使用
python download_socketio.py

# 启动管理器
python start_manager.py
```

然后在浏览器中打开：**http://localhost:5000**

### 📦 Socket.IO 设置

Python Manager 使用 Socket.IO 进行实时更新。默认情况下，它从 CDN (cdnjs.cloudflare.com) 加载。为了离线使用或更好的可靠性：

```bash
python download_socketio.py
```

这将下载 Socket.IO 到本地（MIT 许可，可自由再分发）。如果 CDN 不可用，应用程序会自动回退到本地文件。

## 📋 要求

- Python 3.7 或更高版本
- pip (Python 包管理器)

所需包（自动安装）：
- Flask
- Flask-SocketIO
- Flask-CORS
- psutil

## 🎯 使用方法

### 添加和编辑脚本

1. **添加脚本**：
   - 点击 "⚙ Manage Scripts" 按钮
   - 输入 Python 脚本的完整路径或浏览选择
   - 配置显示名称、参数和自动重启选项
   - 点击 "Add Script"

2. **编辑脚本**：
   - 在 "Manage Scripts" 模态框中，找到要修改的脚本
   - 点击脚本旁边的 "Edit" 按钮
   - 更新配置，如参数、解释器路径、内存限制等
   - 点击 "Save Changes"

3. **通过配置文件**：
   编辑 `py_manager/config.json`：
   ```json
   {
     "scripts": [
       {
         "id": "my_script",
         "name": "My Awesome Script",
         "path": "C:/path/to/your/script.py",
         "args": ["--arg1", "value"],
         "auto_restart": true,
         "enabled": true,
         "max_memory_mb": 512,
         "log_file": "my_script.log"
       }
     ]
   }
   ```

### 管理脚本

- **启动/停止**：点击每个脚本卡片上的相应按钮
- **查看日志**：点击 "View Logs" 查看实时输出
- **批量操作**：使用 "Start All" 或 "Stop All" 操作多个脚本
- **自动重启**：启用以自动重启失败的脚本

## 🛠️ API 使用

Python Manager 提供 REST API 用于自动化：

```python
import requests

# 基础 URL
base_url = "http://localhost:5000/api"

# 启动脚本
response = requests.post(f"{base_url}/scripts/my_script/start")

# 停止脚本
response = requests.post(f"{base_url}/scripts/my_script/stop")

# 获取所有脚本状态
response = requests.get(f"{base_url}/scripts/status")
print(response.json())

# 获取日志
response = requests.get(f"{base_url}/scripts/my_script/logs?lines=50")
```

### API 端点

| 方法 | 端点 | 描述 |
|--------|----------|-------------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/scripts` | 列出所有脚本 |
| GET | `/api/scripts/status` | 获取所有脚本状态 |
| POST | `/api/scripts/{id}/start` | 启动脚本 |
| POST | `/api/scripts/{id}/stop` | 停止脚本 |
| POST | `/api/scripts/{id}/restart` | 重启脚本 |
| GET | `/api/scripts/{id}/logs` | 获取脚本日志 |
| POST | `/api/scripts/add` | 添加新脚本 |
| DELETE | `/api/scripts/{id}/remove` | 移除脚本 |

## 📦 部署选项

### 用于开发项目
```bash
python deploy/setup.py
```
按照交互式提示在您的项目中设置 Python Manager。

### 用于生产环境
1. 克隆到您的服务器
2. 设置为 systemd 服务 (Linux) 或 Windows 服务
3. 在 `api_config.json` 中配置身份验证
4. 使用反向代理 (nginx/Apache) 进行 HTTPS

### 创建便携包
```bash
python deploy/create_package.py
```
这将创建一个包含所需一切的可分发 ZIP 文件。

## 🏗️ 项目结构

```
python-manager/
├── start_manager.py      # 主入口点
├── allin1.py            # 一体化服务器
├── requirements.txt     # Python 依赖
├── py_manager/          # 核心模块
│   ├── py_process.py    # 进程管理
│   ├── py_logger.py     # 日志系统
│   ├── py_api.py        # REST API
│   ├── py_manager.html  # Web 界面
│   └── ...
├── scripts/             # 示例脚本
├── logs/               # 日志文件
└── deploy/             # 部署工具
```

## 🤝 贡献

欢迎贡献！请随时提交 Pull Request。对于重大更改，请先打开一个 issue 讨论您想要更改的内容。

1. Fork 仓库
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📝 许可证

本项目采用 MIT 许可证 - 详情请参阅 [LICENSE](LICENSE) 文件。

## 🙏 致谢

- 基于 Flask 和 Flask-SocketIO 构建
- 进程监控由 psutil 提供支持
- UI 灵感来自现代仪表板设计

## 📧 支持

- 创建 [Issue](https://github.com/prismatex/python-manager/issues) 报告错误或请求功能
- 查看 [Wiki](https://github.com/prismatex/python-manager/wiki) 获取详细文档
- 加入我们的 [Discussions](https://github.com/prismatex/python-manager/discussions) 寻求社区支持

## 🚧 路线图

- [ ] Docker 支持
- [ ] 脚本调度（类似 cron 的功能）
- [ ] 资源使用图表
- [ ] 脚本依赖管理
- [ ] 电子邮件/Webhook 通知
- [ ] 深色模式主题
- [ ] 带身份验证的多用户支持

---

由 Python 社区 ❤️ 制作
