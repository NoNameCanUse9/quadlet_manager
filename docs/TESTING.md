# 测试指南

## 运行测试

```bash
# 所有测试
go test ./internal/...

# 详细输出
go test -v ./internal/...

# 单个包
go test -v ./internal/service/...

# 单个测试函数
go test -v -run TestFileService_ApplyFile ./internal/service/

# 带覆盖率
go test -cover ./internal/...

# 覆盖率报告
go test -coverprofile=coverage.out ./internal/...
go tool cover -html=coverage.out
```

## 测试架构

### Mock Provider

所有外部依赖都有 Mock 实现：

```go
// MockSystemd - 模拟 systemd D-Bus
sd := provider.NewMockSystemd(true)  // rootless=true
sd.Units["nginx.service"] = model.UnitStatus{
    Name: "nginx.service", ActiveState: "active",
}
sd.Err = fmt.Errorf("simulated error")  // 模拟错误

// MockPodman - 模拟 Podman Socket
pm := provider.NewMockPodman()
pm.Containers = []model.ContainerInfo{...}

// MockQuadletFS - 模拟文件系统
fs := provider.NewMockQuadletFS()
fs.Files["nginx.container"] = "[Container]\nImage=nginx\n"
```

### Service 测试模式

```go
func TestServiceFeature(t *testing.T) {
    // 1. 准备 Mock
    sd := provider.NewMockSystemd(true)
    fs := provider.NewMockQuadletFS()
    fs.Files["test.container"] = "[Container]\nImage=alpine\n"

    // 2. 创建 Service
    svc := service.NewUnitService(sd, fs, nil, "")

    // 3. 执行操作
    units, err := svc.ListUnits(context.Background(), 0)

    // 4. 断言结果
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if len(units) != 1 {
        t.Fatalf("expected 1 unit, got %d", len(units))
    }
}
```

### Handler 测试模式

```go
func TestHandlerEndpoint(t *testing.T) {
    // 1. 设置路由
    cfg := config.New(config.Options{})
    r, sd, fs := setupRouter(cfg)

    // 2. 准备数据
    sd.Units["test.service"] = model.UnitStatus{Name: "test.service"}

    // 3. 发送请求
    w := httptest.NewRecorder()
    req := httptest.NewRequest("GET", "/api/v1/units", nil)
    r.ServeHTTP(w, req)

    // 4. 断言响应
    if w.Code != http.StatusOK {
        t.Errorf("expected 200, got %d", w.Code)
    }
}
```

### Store 测试模式

```go
func TestStoreFeature(t *testing.T) {
    // 使用内存数据库
    db, err := store.NewDB(":memory:")
    if err != nil {
        t.Fatal(err)
    }
    defer db.Close()

    store := store.NewUserStore(db)
    // 测试 CRUD 操作...
}
```

---

## 测试覆盖现状

### 已覆盖

- [x] JWT 生成/验证/过期
- [x] 用户注册/登录/重复检测
- [x] 配置默认值/覆盖/验证
- [x] Handler 认证/授权
- [x] Handler 单元/文件 CRUD
- [x] Handler 设置读取/更新
- [x] Quadlet 文件解析/生成往返
- [x] 文件名验证（白名单 + 遍历防护）
- [x] 文件系统 CRUD
- [x] Service 单元启动（daemon-reload 优先）
- [x] Service 文件应用（写入+重载+启动）
- [x] Service 内容验证
- [x] 容器编排器（孤立容器检测）
- [x] 数据库迁移
- [x] 用户/设置 Store CRUD

### 待补充

- [ ] ExecHandler WebSocket 测试
- [ ] BackupHandler 导出/导入测试
- [ ] ImageHandler/VolumeHandler/NetworkHandler 测试
- [ ] ContainerHandler 生命周期测试
- [ ] WebSocket Hub 广播测试
- [ ] 前端组件测试

---

## 添加新测试

### 1. 为新 Service 方法添加测试

```go
// internal/service/service_test.go
func TestNewServiceMethod(t *testing.T) {
    sd := provider.NewMockSystemd(true)
    fs := provider.NewMockQuadletFS()
    svc := service.NewXxxService(sd, fs, nil, "")

    result, err := svc.NewMethod(context.Background(), 0, "param")
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    // 断言 result...
}
```

### 2. 为新 Handler 添加测试

```go
// internal/handler/handler_test.go
func TestNewHandlerEndpoint(t *testing.T) {
    cfg := config.New(config.Options{})
    r, _, _ := setupRouter(cfg)

    w := httptest.NewRecorder()
    body := `{"key":"value"}`
    req := httptest.NewRequest("POST", "/api/v1/new", strings.NewReader(body))
    req.Header.Set("Content-Type", "application/json")
    // 如果需要认证，设置 Authorization header
    r.ServeHTTP(w, req)

    if w.Code != http.StatusOK {
        t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
    }
}
```

### 3. 测试错误场景

```go
func TestServiceErrorHandling(t *testing.T) {
    sd := provider.NewMockSystemd(true)
    sd.Err = fmt.Errorf("dbus connection lost")  // 模拟错误
    fs := provider.NewMockQuadletFS()
    svc := service.NewUnitService(sd, fs, nil, "")

    _, err := svc.ListUnits(context.Background(), 0)
    if err == nil {
        t.Fatal("expected error, got nil")
    }
}
```
