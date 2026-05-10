---
title: MySQL八股
date: 2026-05-01
summary: 小林coding学习记录
tags: [mysql, database]
draft: false
---

# 基础
## 执行流程
- 连接器: TCP建立连接，校验用户名和密码，权限
  - 连接池 (预存tcp链接)
  - 查看：show proccesslist
  - 空闲链接：wait_timeout 默认8h
  - 断开链接：kill connection + id
  - 最大连接数：max_connections
  - 长连接：如果长连接占用了过多内存（链接对象占用内存），可能会被系统杀掉，异常重启
    - 定期断开长连接
    - 客户端主动重置：mysql_reset_connection()
- 解析器：检查语法，建语法树
- 执行器：
  - Prepare：检查字段/表是否存在
  - Optimize：确定执行方案，EXPLAIN 查看使用的索引 （覆盖索引？）
  - Execute：与储存引擎交互（以记录为单位）
    - 主键查询：const
    - 全表扫描：每在引擎中查到一条记录就server层返回客户端
    - 索引下推：查询联合索引（二级索引）后不回表，判断条件剩余联合索引中条件后再返回客户端
      - 回表：二级索引拿到主键再取其他字段
# 数据存储
## 文件
- /var/lib/mysql/db_name
  - db.opt: 默认字符集/校验规则
  - table_name.frm: 表结构
  - table_name.ibd: 表数据
- 按行存储，（InnoDB）按页读取（每页16KB，最小单位）
  - 页空间：file header双向链表
 
 
- 区：索引空间分配，页物理连续，顺序IO
- 段：由区组成，索引段（B+树非叶子节点），数据段（B+树叶子节点），回滚段
InnoDB行格式
- Redundant、Compact、Dynamic，Compressed
 
- 变长字段/NULL值：倒序存储，方便指针读取CPU cache Line
  - 变长字段：按倒序存各个可变字段的n值
  - NULL值列表 为1：这行数据的这个字段为NULL
 
- 头信息：delete_mask, next_record, record_type
- row_id（非必须）：没有 主键或者唯一约束列 时
- trx_id：由哪个事务生成
- roll_ptr：上一个版本指针
- MySQL 规定除了 TEXT、BLOBs 这种大对象类型之外，其他所有的列（不包括隐藏列和记录头信息）占用的字节长度加起来不能超过 65535 个字节（包括可变长字段列表/NULL值列表，65532）
- 行溢出：一页存不下，真实数据部分存指针
 
 

# 索引
- 空间换时间
## 分类
- 数据结构：B+ tree, Hash, Full-text
  - 每进一层，一次IO
- 物理存储：聚簇（主键），二级（辅助）
  - 二级索引B+tree叶子存主键值（需要额外信息时回表）
- 字段特性：主键，唯一，普通，前缀
  - 主键：建表自动创建
  - 唯一：UNIQUE字段
  - 普通：普通字段
  - 前缀：针对字符串字段 
## column_name(length)
- 字段个数：单列，联合
  - 联合：树中按顺序存储为key（后面的字段整体无序，相对有序） => 所以需要遵循最左匹配原则 （优化器会优化where中字段顺序）；范围查询之后的字段无法使用索引
    - 建立联合索引时，要把区分度大的字段排在前面，这样区分度大的字段越有可能被更多的 SQL 使用到
      - 区分度：distinct / count
    - 查看：EXPLAIN - key_len（可变长字段自动计为2字节）
      - 索引下推：EXPLAIN - using index condition
    - 特殊（语句拆分）：
      - a >= 1; b = 2 中， a = 1, b = 2 会走索引
      - BETWEEN .. AND .. ：取决于开闭（MySQL中为闭区间） 
      - 前缀匹配： SELECT * FROM t_user WHERE name like 'j%' and age = 22 => [j, k)，同理
    - 索引有序性：(status, create_time)
      - select * from _ where status = 1 order by create_time asc 
## InnoDB 聚簇索引键选择
- 优先主键
- 无主键选第一个非NULL唯一列
- 都无 则自动生成隐式id
 
## B+ Tree 
- log(dN)，d为最大分叉，N为叶子节点个数
- 最终行数：d^(h-1) * y 
  - h为树高
  - y为叶子节点容量
## 优点
- 总的来说：
  - 插入/删除效率高 - 冗余节点多，结构变化小
  - 适合范围查询 - 叶子节点双向链表
  - 查询IO少 - 叶子只存key
- 相比 B tree：
  - 只有叶子存数据：IO少
  - 叶子双链：范围查询
- 相比二叉：
  - 多叉：更矮胖 => IO更少
- 相比Hash：
  - Hash不适合等值查询
 
## 权衡
- 索引的问题：
  - 需要占用物理空间
  - 创建和维护索引的时间成本随数据量加大而加大
  - 降低CRUD效率
- 适合索引的字段：
  - 唯一性
  - 经常需要：WHERE, ORDER BY, GROUP BY
- 不适合：
  - 经常更新
  - 总数据很少
  - 重复度高，较少定位
## 索引失效
- 左模糊/左右模糊匹配：%xx, %xx%
- 在查询语句中对索引列做了计算，函数，类型转换
  - MySQL 8.0 后支持单独对自带函数（对于某字段）加索引
  - 自动转换字符串为数字(ascii码和数字排序不一致)，所以当字段为字符串类型时，相当于对字段使用了CAST
- 最左匹配失效
- WHERE 字句中OR 前后有非索引，索引会失效
## 索引优化
- 前缀：提高查询速度
  - 局限：ORDER BY 无法使用，无法作为覆盖索引
- 覆盖：联合索引，避免回表，减少IO
- 主键索引最好自增：否则插入新数据时可能导致页分裂，产生内存碎片
- 索引最好设置为 NOT NULL：
  - 导致优化器选择更复杂
  - 占用物理空间：NULL值列表
- 防止索引失效
- EPLAIN 字段：
  - possible_keys
  - key：索引名
  - key_len
  - rows：扫描的数据行数
  - type 重点 （扫描方式）
    - ALL 全表
    - index 全索引
    - range 索引范围 （索引作用逐渐明显）
    - ref 非唯一索引
    - eq_ref 唯一索引，通常用于多表联查
    - const 结果只有一条的主键或唯一索引扫描，与常量比较
  - extra：
    - Using filesort 当查询语句中包含 group by 操作，而且无法利用索引完成排序操作的时候 效率低
    - Using temporary 使了用临时表保存中间结果，常见于排序 order by 和分组查询 group by 效率低
    - Using index 使用覆盖索引避免回表操作
## 总结
 
 
## 其他
### 单表 2000W 行？
- 由页的大小+存储的数据类型+B+树层数决定
- 数据量小时，索引装载内存（buffer）；超过一个数量级，磁盘IO
count(*) / count(1)
- 结论：count(*) = count(1) > count(主键) > count(普通字段)
  - count(*)：优化器会把 * 转化为 0
  - count(*) / count(1) / count(主键)：有二级索引时选择key_len最小的
  - count(主键) 会多一个判断参数是否为NULL的步骤
  - count(普通字段) 全表扫描
- server层维护一个count变量
  - 因为InnoDB支持事务，MVCC，所以需要遍历计数
- 优化？
  - 近似：show table status / EXPLAIN（rows）
  - 额外表保存计数值
### 分页分表
- limit语句：limit offset, size offest：偏移量
  - 获取 [0，offset + size] 行的完整数据
- 当offset非0时，server层会从引擎层获取到很多无用的数据；当select后面是*号时，就需要拷贝完整的行信息
- 当limit offset过大时，非主键索引查询非常容易变成全表扫描（因为需要大量回表，优化器优化）
### 深度分页
- 游标分页：start_idx 记录起始位置（上次结束）
- 不支持眺页：瀑布流

# 事务
## 特性：ACID
- A = Atomicity 原子性， 全部完成/不完成，不能中途插入
  - Undo log
- C = Consistency 一致性，操作前后，数据库满足一致性约束
  - A + I + D => C
- I = Isolation 隔离性，并发事务互不影响
  - MVCC
- D = Durability 持久性，不丢失改动
  - Redo log
## 并行事务的问题（严重程度从高到低）
- 脏读：如果一个事务「读到」了另一个「未提交事务修改过的数据」，就意味着发生了「脏读」现象。
  - 未提交事务发生回滚后数据不一致
- 不可重复读：在一个事务内多次读取同一个数据，如果出现前后两次读到的数据不一样的情况，就意味着发生了「不可重复读」现象。
  - 两次读取之间，数据被其他事务更改
- 幻读：在一个事务内多次查询某个符合查询条件的「记录数量」，如果出现前后两次查询到的记录数量不一样的情况，就意味着发生了「幻读」现象。
## 隔离级别（隔离水平从低到高）
- 读未提交（read uncommitted）指一个事务还没提交时，它做的变更就能被其他事务看到
- 读已提交（read committed）指一个事务提交之后，它做的变更才能被其他事务看到
  - 实现：读取前生成一个Read View
- 可重复读（repeatable read）一个事务执行过程中看到的数据，一直跟这个事务启动时看到的数据是一致的
  - InnoDB默认隔离级别， 很大程度 解决幻读问题
  - 实现：事务发起前，生成 Read View
- 串行化（serializable）会对记录加上读写锁，在多个事务对这条记录进行读写操作时，如果发生了读写冲突的时候，后访问的事务必须等前一个事务执行完成，才能继续执行
  - 实现：加读写锁
  - 对性能影响大
 
## InnoDB 解决幻读（RR）
- 对于 快照读(普通select)，MVCC
- 对于 当前读(select for update)，next-key lock(记录锁+间隙锁)
  - 如果有其他事务在 next-key lock 锁范围内插入了一条记录，会被阻塞
  - 间隙锁：锁开区间，区间内插入会阻塞
  - 记录锁：锁某行
- 不完全解决幻读：
  - A 执行当前读：查询 id=x 行，未找到 -- B 插入 id=x 行 -- A 更新 id=x 行，幻读
  - A 执行快照读，id > 100，得到 n 行 -- B 插入 id=200 -- A 执行当前读 id > 100，得到 n+1 行，幻读
    - 因为当前读不使用read view
## Read View （MVCC）
实现RC/RR，持有者：事务
- 事务命令：
  - begin/start transaction：执行命令后，执行第一条语句时，任务启动
  - start transaction with consistent snapshot：执行命令后任务启动
- 四个字段：creator_trx_id / m_ids / min_trx_id / max_trx_id
 
- 聚簇索引隐藏列（每行记录）：
  - trx_id: 所参与的事务（最新）
  - roll_pointer: 指针，指向旧版本（undo log），形成版本链
    - 大事务会导致加锁阻塞，undo log耗尽内存
- MVCC: 一个事务去访问别的记录时，对比记录中的trx_id与事务中readview的记录：
  - < min_trx_id：事务已提交，可见
  - >= max_trx_id：事务未提交，不可见
  - [min_trx_id, max_trx_id) : O(logN)二分查找
    - 如果存在 => (在创建readview时) 这行数据正在参与未提交的事务，不可见
    - 如果不存在 => (在创建readview时) 这行数据参与的事务已提交，可见
 

# 锁
持有者：对话/线程
读锁/共享锁/S锁；写锁/独占锁/X锁
## 种类
- 全局锁：flush tables with read lock ； unlock tables
  - 场景：全库逻辑备份
    - 缺点：业务停滞
    - 解决：不加锁，通过MVCC（可重复读隔离）实现全库备份
- 表级锁：
  - 表锁：LOCK TABLES t READ/WRITE / unlock tables
    - 读锁：当前会话只可以读上锁的表，其他会话只读（共享）
    - 写锁：当前会话可以读写，其他线程阻塞（独占）
    - 性能较差
  - 元数据锁（MDL），自动使用，事务提交时释放
    - CRUD：加MDL读锁
    - 更改表的结构：加MDL写锁
    - 操作队列中：写锁优先级高于读锁（先kill长事务再变更更结构）
  - 意向锁：快速判断表里是否有记录被加锁
    - 在对行加锁前加对应的（共享/独占）表级意向锁
    - 意向共享锁和意向独占锁是表级锁，不会和行级的共享锁和独占锁发生冲突，而且意向锁之间也不会发生冲突，只会和共享表锁（lock tables ... read）和独占表锁（lock tables ... write）发生冲突。
  - AUTO-INC 锁：主键自增
    - 插入数据时加表级别auto-inc锁，插入完成后释放
    - 轻量级锁：完成自增后立刻释放
    - innodb_autoinc_lock_mode 
      - = 0，表级 auto-inc
      - = 1，普通insert轻量，批量插入表级
      - = 2，全部 轻量级，需配合 binlog_format = row，否则从库不一致（binlog_format = statement）
- 行级锁
  - Record Lock
    - 可以给加了 S 锁的记录加 S 锁
    - 事件提交后全部释放
  - Gap Lock
    - 为了防止插入幻影记录产生
    - 锁间完全兼容，多个事务可同时持有相同间隙锁
    - 边界插入阻塞？看下一条记录（包括主键）上是否有间隙锁（处于间隙中）
  - Next-key Lock: record lock + gap lock
    - (a, b]
    - 兼容性根据子锁确定
  - 插入意向锁：表明有事务想在某个区间插入新记录，但是现在处于等待状态
    - 与间隙锁互斥（不能同时持有）
    - 事务 A：拥有 间隙锁。
    - 事务 B：申请 插入意向锁（处于阻塞状态，未成功拥有）。
 
## 怎么加锁（行级锁）？
- 加锁的对象是索引，加锁的基本单位是 next-key lock
- 在能使用记录锁或者间隙锁就能避免幻读现象的场景下，next-key lock  就会退化成记录锁或间隙锁
- 查看锁：select * from performance_schema.data_locks\G;
### 唯一索引（主键）等值查询
- 查询记录存在：退化记录锁
  - 主键唯一，所以不能插入
  - 记录锁防止删除
- 不存在：退化间隙锁
  - 没有记录所以只能加间隙锁
  - 如果超过最后一条记录则保持next-key
### 唯一索引（主键）范围查询
- >：不退化，最后一行是 supremum pseudo-record
- >=：等值查询存在则退化记录锁，剩余不退化
- < / <=：如果值不存在，最后一次退化为间隙锁；
  - <=：如果存在，完全不退化
  - <：如果存在，值前退化间隙锁
### 非唯一索引等值查询
- 对满足条件的主键索引加锁
- 存在：
  - 扫描过程：next-key lock（从第一个满足的记录开始）
    - 对满足条件的主键索引加记录锁
  - 第一个不满足：退化间隙
- 不存在：第一个不符合退化间隙
### 非唯一索引等值查询
- 不会退化，全部 next-key lock
### 没加索引的查询
- Next-lock 锁全表
  - 防止 update 全表扫描，sql_safe_updates = 1，force index([index_name])

## 死锁
- 两事务持有相同间隙锁，后分别对这个间隙插入，形成死锁
  - 必要条件：互斥、占有且等待、不可强占用、循环等待
- Insert加锁：
  - 遇到间隙锁，等待插入意向锁
  - 唯一键：主键加S记录锁；二级索引加S next-key锁
  - 两个事务A B相同inert语句（二级索引）：B 事务插入时，A 事务插入的记录 隐式锁=>显式X锁，B 事务想要申请next-key lock，失败阻塞
- 避免死锁：
  - 事务锁等待过期时间：超时回滚
  - 死锁主动检测：主动回滚链条键某个事务

# 日志
# 增删改
- Undo log：回滚 / MVCC，原子性，InnoDB
  - 记录更新之前
  - 需要通过redo log持久化（刷盘）
 
- Redo log：掉电恢复，持久性，InnoDB
  - 记录内容：对 XXX 表空间中的 YYY 数据页 ZZZ 偏移量的地方做了AAA 更新（记录更新之后的）
  - WAL：crash safe，写脏页到buffer poll，后台线程刷盘
  - 随机写 => 顺序写（解释为什么要写到磁盘）
  - Redo log buffer 刷盘时机
    - MySQL正常关闭
    - 空间过半
    - InnoDB后台线程每隔1s持久化
    - innodb_flush_log_at_trx_commit：
      - 0 = 留在redo log buffer
      - 1 = 事务提交写入磁盘
      - 2 = 事务提交写入page cache
 
  - 环形存储：（写满会阻塞）
    - 位置：InnoDB - log buffer - redo log buffer
 
- Bin log：数据备份，主从复制，server层
  - 格式
    - STATEMENT：逻辑日志，记录每一条改数据的SQL
    - ROW：记录被更改的数据本身
    - MIXED：根据情况使用
  - 写入方式：追加写，保存全量日志
  - 刷盘时机：
    - 事务执行时完整写入binlog cache
    - 事务提交时，binlog cache（server线程） --write--> page cache --fsync--> binlog file（磁盘）
    - sync_binlog 参数控制频率
      - 0 = 只write
      - 1 = 事务提交马上fsync
      - N = 积攒N事务后fsync
## 主从复制
- 流程：主库 写入binlog，同步binlog，从库回放binlog
- 从库数量：2 ~ 3 从库比较合理（1 主 2 从 1 备主）
- 复制模型：同步 / 异步 / 半同步（有一个从库更新就返回）
- 读写设计：
 

## 两阶段提交（Prepare + Commit）
- 分布式事务一致性协议
- 阶段：
  - 准备阶段：将 XID（内部 XA 事务的 ID） 写入到 redo log，同时将 redo log 对应的事务状态设置为 prepare，然后将 redo log 持久化到磁盘（innodb_flush_log_at_trx_commit = 1 的作用）
  - 提交阶段：把 XID  写入到 binlog，然后将 binlog 持久化到磁盘（sync_binlog = 1 的作用），接着调用引擎的提交事务接口，将 redo log 状态设置为 commit，此时该状态并不需要持久化到磁盘，只需要 write 到文件系统的 page cache 中就够了，因为只要 binlog 写磁盘成功，就算 redo log 的状态还是 prepare 也没有关系，一样会被认为事务已经执行成功
- 崩溃恢复：找prepare状态redo log，对比与binlog的XID
- 问题：
  - 磁盘IO高：两次刷盘
  - 锁竞争激烈：加锁保证原子性，保证循序一致
 
## 组提交
对于redolog，将prepare阶段融入flush阶段；对于binlog：prepare阶段不变，commit阶段：
- Flush：批量写binlog 从cache进入文件
- Sync：文件刷盘 fsync
- commit：修改状态

## 磁盘IO高，怎么优化？
- 造成：redo log / binlog 刷盘
- 设置参数：
  - binlog_group_commit_sync_delay / binlog_group_commit_sync_no_delay_count 
  - sync_binlog （100 - 1000）
  - innodb_flush_log_at_trx_commit  



---

# 语法
``` mysql
SELECT * FROM Students
ORDER BY score DESC -- 必须有 ORDER
LIMIT 10 OFFSET 20; -- 等于 LIMIT 20, 10;
- 假设一个场景：电商数据库。我们有三张表：Orders（订单表）、Users（用户表）和 Products（产品表）。任务：找出 2023 年消费总额超过 1000 元的“活跃用户”，列出他们的姓名、订单总数、平均客单价，并按总额降序排列，取前 5 名。
SELECT 
    u.user_name AS "姓名", 
    COUNT(o.order_id) AS "订单总数", 
    SUM(o.amount) AS "消费总额",
    AVG(o.amount) AS "平均客单价"
FROM users u
INNER JOIN orders o ON u.user_id = o.user_id -- ON 链接条件
WHERE o.order_date >= '2023-01-01' -- WHERE 连接后过滤 
  AND o.status = 'completed'
  AND u.region IN ('北京', '上海', '广州', '深圳')
GROUP BY u.user_id, u.user_name
HAVING SUM(o.amount) > 1000
ORDER BY 消费总额 DESC
LIMIT 5 OFFSET 0;
```

