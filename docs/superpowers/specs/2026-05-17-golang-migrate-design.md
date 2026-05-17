# golang-migrate 集成设计

## 背景

当前 `internal/store/db.go` 使用内联 `CREATE TABLE IF NOT EXISTS` 建表，无法处理后续 schema 变更。需要引入迁移系统支持在线 schema 升级。

## 决策

- **迁移库：** `golang-migrate/migrate/v4`
- **基线策略：** 全部重新执行 — 首个 migration 使用 `CREATE TABLE IF NOT EXISTS`，保证新旧数据库幂等
- **嵌入方式：** `//go:embed` 将 SQL 文件嵌入二进制，与 web 前端模式一致

## 依赖

```
github.com/golang-migrate/migrate/v4
github.com/golang-migrate/migrate/v4/database/sqlite3
github.com/golang-migrate/migrate/v4/source/iofs
```

## 文件结构

```
internal/store/
├── db.go                     # 修改：去掉 schema 常量，改用 migrate
├── migrations/
│   ├── 001_init.up.sql       # 当前 schema（CREATE TABLE IF NOT EXISTS）
│   └── 001_init.down.sql     # DROP TABLE IF EXISTS
├── user_store.go
├── user_store_test.go
├── settings_store.go
└── settings_store_test.go
```

## db.go 改动

移除内联 `schema` 常量，改为：

1. `//go:embed migrations/*.sql` 嵌入迁移文件
2. `iofs.New(embeddedFS, "migrations")` 创建 source driver
3. `sqlite3.WithInstance(db, &sqlite3.Config{})` 创建 database driver
4. `migrate.NewWithInstance("iofs", source, "sqlite3", dbDriver)` 创建 migrator
5. `m.Up()` 执行迁移
6. `m.Close()` 释放资源

错误处理：
- `migrate.ErrNoChange` 视为成功（无新迁移可执行）
- `migrate.ErrDirty` 记录错误并退出（需人工修复脏版本）
- 其他错误记录并退出

## 迁移文件命名规范

```
{序号}_{描述}.up.sql
{序号}_{描述}.down.sql
```

序号三位数字，从 001 开始。新 migration 按序号递增放入 `migrations/` 目录，启动即自动执行。

## 测试

- 新建数据库：验证 001 migration 创建所有表
- 已有数据库（表已存在）：验证 `CREATE TABLE IF NOT EXISTS` 幂等，不报错
- 迁移版本跟踪：验证 `schema_migrations` 表记录正确版本
