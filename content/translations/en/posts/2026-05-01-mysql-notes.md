---
title: MySQL Interview Notes
summary: Study notes based on Xiaolin Coding's MySQL materials.
---

# Fundamentals

## Execution flow

- Connector: establishes a TCP connection and verifies the username, password, and permissions.
  - Connection pool: keeps TCP connections ready for reuse.
  - Inspect connections: `show processlist`.
  - Idle connections: `wait_timeout`, eight hours by default.
  - Close a connection: `kill connection <id>`.
  - Maximum connections: `max_connections`.
  - Long-lived connections can consume excessive memory through their connection objects and may be killed by the system, causing an abnormal restart.
    - Disconnect long-lived connections periodically.
    - Let the client reset the connection with `mysql_reset_connection()`.
- Parser: validates syntax and builds a syntax tree.
- Executor:
  - Prepare: checks whether fields and tables exist.
  - Optimize: chooses an execution plan; use `EXPLAIN` to inspect the selected index and whether it is covering.
  - Execute: interacts with the storage engine one record at a time.
    - Primary-key lookup: `const`.
    - Full-table scan: the server layer returns each record found by the engine to the client.
    - Index condition pushdown: after searching a composite secondary index, evaluate the remaining conditions covered by that index before returning to the table.
      - Table lookup: use the primary key obtained from a secondary index to fetch other fields.

# Data storage

## Files

- `/var/lib/mysql/db_name`
  - `db.opt`: default character set and collation.
  - `table_name.frm`: table schema.
  - `table_name.ibd`: table data.
- Data is stored by row; InnoDB reads by page, with a 16 KB page as its smallest unit.
  - Page space: file headers form a doubly linked list.
- Extent: allocates index space using physically contiguous pages for sequential I/O.
- Segment: consists of extents; index segments hold B+ tree non-leaf nodes, data segments hold leaf nodes, and rollback segments hold undo information.

InnoDB row formats:

- `Redundant`, `Compact`, `Dynamic`, and `Compressed`.
- Variable-length fields and NULL values are stored in reverse order to make pointer reads friendlier to CPU cache lines.
  - Variable-length fields: store each variable field's length in reverse order.
  - A bit set to 1 in the NULL bitmap means the corresponding field is NULL.
- Record header: `delete_mask`, `next_record`, and `record_type`.
- `row_id` (optional): used when there is no primary key or unique constrained column.
- `trx_id`: the transaction that created the record version.
- `roll_ptr`: pointer to the previous version.
- Except for large-object types such as `TEXT` and `BLOB`, MySQL limits the combined byte length of all columns, excluding hidden columns and the record header, to 65,535 bytes. This includes the variable-length field list and NULL bitmap; the practical column limit is 65,532 bytes.
- Row overflow: when a row cannot fit in one page, the record stores a pointer to the actual data.

# Indexes

- Trade space for time.

## Classification

- Data structure: B+ tree, Hash, Full-text.
  - Descending one tree level usually costs one I/O.
- Physical storage: clustered (primary-key) and secondary (auxiliary).
  - A secondary-index B+ tree stores primary-key values in its leaves; fetching extra fields requires a table lookup.
- Field property: primary, unique, normal, and prefix indexes.
  - Primary: created automatically with the table's primary key.
  - Unique: created for a `UNIQUE` field.
  - Normal: a standard index.
  - Prefix: indexes a prefix of a string field.

## `column_name(length)`

- Number of fields: single-column or composite.
  - A composite index stores keys in field order. Later fields are globally unordered but locally ordered, so queries must follow the leftmost-prefix rule. The optimizer can reorder fields in `WHERE`, but fields after a range condition cannot use the index.
    - Put highly selective fields first so more SQL statements can benefit from them.
      - Selectivity: `distinct / count`.
    - Inspect `EXPLAIN.key_len`; variable-length fields automatically add two bytes.
      - Index condition pushdown appears as `Using index condition`.
    - Special cases after predicate decomposition:
      - For `a >= 1 AND b = 2`, the portion `a = 1 AND b = 2` can use both index fields.
      - `BETWEEN ... AND ...` depends on open or closed bounds; MySQL uses closed bounds.
      - `name LIKE 'j%' AND age = 22` maps to the range `[j, k)` and follows the same rule.
    - Index ordering for `(status, create_time)` supports `WHERE status = 1 ORDER BY create_time ASC`.

## Choosing an InnoDB clustered-index key

- Prefer the primary key.
- Without one, choose the first non-NULL unique column.
- Without either, generate an implicit ID.

## B+ Tree

- Complexity: `log(dN)`, where `d` is the maximum fan-out and `N` is the number of leaf nodes.
- Approximate row capacity: `d^(h-1) * y`.
  - `h` is tree height.
  - `y` is leaf-node capacity.

## Advantages

- In general:
  - Efficient insertion and deletion because redundant nodes reduce structural changes.
  - Good range queries because leaf nodes form a doubly linked list.
  - Fewer query I/Os because internal nodes store only keys.
- Compared with a B-tree:
  - Only leaves store data, reducing I/O.
  - Linked leaves support range queries.
- Compared with a binary tree:
  - Higher fan-out produces a shorter, wider tree and fewer I/Os.
- Compared with Hash:
  - Hash indexes are unsuitable for range queries.

## Trade-offs

- Costs of indexes:
  - Physical storage.
  - Increasing creation and maintenance time as data grows.
  - Lower CRUD write efficiency.
- Good index candidates:
  - Highly unique fields.
  - Fields frequently used by `WHERE`, `ORDER BY`, or `GROUP BY`.
- Poor candidates:
  - Frequently updated fields.
  - Very small data sets.
  - Highly repetitive fields with weak filtering power.

## Index invalidation

- Leading or both-side wildcard matching: `%xx` and `%xx%`.
- Calculations, functions, or type conversions applied to an indexed column.
  - MySQL 8.0 and later can create functional indexes for built-in functions on a field.
  - Automatic string-to-number conversion effectively applies `CAST` to string fields because ASCII and numeric ordering differ.
- Violating the leftmost-prefix rule.
- An `OR` branch in a `WHERE` clause without an index can prevent index use.

## Index optimization

- Prefix index: improves lookup speed.
  - Limitations: cannot support `ORDER BY` and cannot act as a covering index.
- Covering composite index: avoids table lookups and reduces I/O.
- Prefer an auto-incrementing primary key; otherwise insertion may split pages and create fragmentation.
- Prefer `NOT NULL` indexed columns:
  - NULL makes optimizer choices more complex.
  - The NULL bitmap consumes physical space.
- Avoid the invalidation cases above.
- Important `EXPLAIN` fields:
  - `possible_keys`.
  - `key`: selected index name.
  - `key_len`.
  - `rows`: estimated scanned rows.
  - `type`: access method, from worse to better:
    - `ALL`: full-table scan.
    - `index`: full-index scan.
    - `range`: index range scan.
    - `ref`: non-unique index lookup.
    - `eq_ref`: unique-index lookup, often in joins.
    - `const`: primary or unique-index lookup returning one row compared with a constant.
  - `extra`:
    - `Using filesort`: sorting cannot use an index, often with `GROUP BY`; inefficient.
    - `Using temporary`: an intermediate temporary table is used, often for `ORDER BY` or `GROUP BY`; inefficient.
    - `Using index`: a covering index avoids a table lookup.

## Summary

## Other notes

### Twenty million rows in one table?

- Capacity depends on page size, stored data types, and B+ tree height.
- With little data the index fits in the buffer pool; after the data crosses an order-of-magnitude threshold, disk I/O becomes important.

`count(*)` versus `count(1)`:

- Rule of thumb: `count(*) = count(1) > count(primary_key) > count(normal_column)`.
  - The optimizer rewrites `*` to `0` for `count(*)`.
  - With secondary indexes, `count(*)`, `count(1)`, and `count(primary_key)` choose the smallest `key_len`.
  - `count(primary_key)` adds a NULL check.
  - `count(normal_column)` performs a full-table scan.
- The server layer maintains the count variable.
  - InnoDB supports transactions and MVCC, so it must traverse visible records to count them.
- Optimizations:
  - Approximate with `SHOW TABLE STATUS` or `EXPLAIN.rows`.
  - Store the count in a separate table.

### Pagination and sharding

- `LIMIT offset, size`, where `offset` is the number of skipped rows.
  - The engine obtains complete data for rows `[0, offset + size]`.
- With a nonzero offset, the server receives many unused rows from the engine. `SELECT *` makes it copy complete row data.
- A very large offset can turn a secondary-index query into a full-table scan because of the many table lookups the optimizer anticipates.

### Deep pagination

- Cursor pagination records the previous ending position in `start_idx`.
- It cannot jump directly to an arbitrary page; it suits infinite scrolling.

# Transactions

## ACID properties

- A — Atomicity: all operations complete or none do; no partial result.
  - Undo log.
- C — Consistency: the database satisfies consistency constraints before and after an operation.
  - A + I + D imply C.
- I — Isolation: concurrent transactions do not interfere.
  - MVCC.
- D — Durability: committed changes are not lost.
  - Redo log.

## Concurrent-transaction anomalies, from most to least severe

- Dirty read: a transaction reads data changed by another uncommitted transaction.
  - If the uncommitted transaction rolls back, the reader has observed inconsistent data.
- Non-repeatable read: repeated reads of the same row within one transaction return different values.
  - Another transaction changed the data between reads.
- Phantom read: repeated queries for the number of records matching a condition return different counts.

## Isolation levels, from weakest to strongest

- Read uncommitted: other transactions can see changes before commit.
- Read committed: changes become visible only after commit.
  - Implementation: create a Read View before each read.
- Repeatable read: data remains consistent with what the transaction saw when it began.
  - InnoDB's default; prevents phantom reads in most cases.
  - Implementation: create one Read View before the transaction's first consistent read.
- Serializable: adds read and write locks. When transactions conflict on a record, later access waits for the earlier transaction to finish.
  - Implementation: read/write locks.
  - Large performance cost.

## How InnoDB prevents phantom reads under RR

- Snapshot reads, ordinary `SELECT`: MVCC.
- Current reads, such as `SELECT ... FOR UPDATE`: next-key locks, combining record and gap locks.
  - Inserting within the locked next-key range is blocked.
  - Gap lock: locks an open interval and blocks insertion inside it.
  - Record lock: locks one row.
- Phantom reads are not eliminated in every sequence:
  - A current-reads `id=x` and finds nothing; B inserts `id=x`; A updates `id=x` and observes a phantom.
  - A snapshot-reads `id > 100` and sees n rows; B inserts `id=200`; A current-reads `id > 100` and sees n+1 rows.
    - A current read does not use the Read View.

## Read View and MVCC

Read Views implement RC and RR and belong to a transaction.

- Transaction commands:
  - `BEGIN` or `START TRANSACTION`: the transaction begins when the first statement executes.
  - `START TRANSACTION WITH CONSISTENT SNAPSHOT`: begins the transaction immediately with a consistent snapshot.
- Four fields: `creator_trx_id`, `m_ids`, `min_trx_id`, and `max_trx_id`.
- Hidden clustered-index columns on every record:
  - `trx_id`: latest transaction associated with the version.
  - `roll_pointer`: points to an older version in the undo log and forms a version chain.
    - Large transactions can block on locks and exhaust memory through undo logs.
- MVCC compares a record's `trx_id` with the transaction's Read View:
  - `< min_trx_id`: committed and visible.
  - `>= max_trx_id`: not committed at snapshot creation and invisible.
  - `[min_trx_id, max_trx_id)`: binary-search `m_ids` in O(log N).
    - Present: the row belonged to an uncommitted transaction when the Read View was created; invisible.
    - Absent: that transaction was already committed; visible.

# Locks

Locks belong to a session or thread. A read/shared lock is an S lock; a write/exclusive lock is an X lock.

## Types

- Global lock: `FLUSH TABLES WITH READ LOCK`; release with `UNLOCK TABLES`.
  - Use case: logical backup of the whole database.
    - Drawback: business operations stop.
    - Alternative: use MVCC at repeatable-read isolation for a consistent backup without a global lock.
- Table-level locks:
  - Table lock: `LOCK TABLES t READ/WRITE`; release with `UNLOCK TABLES`.
    - Read lock: the current session can only read the locked table; other sessions can also read it.
    - Write lock: the current session can read and write; other threads block.
    - Poor performance.
  - Metadata lock (MDL): automatic and released at transaction commit.
    - CRUD obtains an MDL read lock.
    - Schema changes obtain an MDL write lock.
    - Write locks have higher queue priority than reads; kill long transactions before altering a table.
  - Intention locks: quickly indicate whether rows in a table are locked.
    - Before locking a row, acquire the corresponding table-level shared or exclusive intention lock.
    - IS and IX locks do not conflict with row-level S/X locks or with each other. They conflict only with shared table locks and exclusive table locks.
  - `AUTO-INC` lock for auto-incrementing primary keys.
    - A table-level auto-inc lock is acquired during insertion and released afterward.
    - Lightweight mode releases it immediately after allocating the value.
    - `innodb_autoinc_lock_mode`:
      - `0`: table-level auto-inc lock.
      - `1`: lightweight for ordinary inserts, table-level for bulk inserts.
      - `2`: lightweight for all inserts; requires `binlog_format=row`, otherwise a statement-format replica may diverge.
- Row-level locks:
  - Record Lock:
    - Another S lock can be added to a record already carrying an S lock.
    - All record locks are released after transaction commit.
  - Gap Lock:
    - Prevents insertion of phantom records.
    - Gap locks are mutually compatible; multiple transactions can hold the same gap lock.
    - Whether a boundary insertion blocks depends on the gap lock on the next record, including its primary key.
  - Next-key Lock = record lock + gap lock.
    - Covers `(a, b]`.
    - Compatibility follows the component locks.
  - Insert intention lock: signals that a transaction wants to insert into an interval but is waiting.
    - Conflicts with a gap lock.
    - Transaction A holds the gap lock; transaction B requests an insert intention lock and blocks.

## How row locks are applied

- The locked object is an index; the base locking unit is a next-key lock.
- When a record or gap lock alone prevents phantoms, a next-key lock degrades to that smaller lock.
- Inspect locks with `SELECT * FROM performance_schema.data_locks\G`.

### Equality lookup on a unique index or primary key

- Record exists: degrades to a record lock.
  - Uniqueness already prevents another insertion.
  - The record lock prevents deletion.
- Record does not exist: degrades to a gap lock.
  - There is no record to lock.
  - Beyond the final record it remains a next-key lock on the supremum pseudo-record.

### Range lookup on a unique index or primary key

- `>`: no degradation; the final row is the supremum pseudo-record.
- `>=`: the equality match degrades to a record lock; the rest remain next-key locks.
- `<` or `<=`: if the boundary value is absent, the final lock degrades to a gap lock.
  - For `<=`, an existing boundary does not degrade.
  - For `<`, an existing boundary uses a gap lock before that value.

### Equality lookup on a non-unique index

- Matching primary-key records are also locked.
- When matches exist:
  - Scanning uses next-key locks from the first match.
  - Each matching primary-key entry receives a record lock.
  - The first nonmatching entry degrades to a gap lock.
- With no match, the first nonmatching entry degrades to a gap lock.

### Range lookup on a non-unique index

- Locks do not degrade; all are next-key locks.

### Query without an index

- Next-key locks cover the entire table.
  - Avoid an accidental full-table update with `sql_safe_updates = 1` or `FORCE INDEX(index_name)`.

## Deadlocks

- Two transactions can hold the same gap lock and then each try to insert into the gap, forming a deadlock.
  - Necessary conditions: mutual exclusion, hold-and-wait, no preemption, and circular wait.
- Locks during `INSERT`:
  - On encountering a gap lock, wait for an insert intention lock.
  - For a duplicate unique key, the primary index requests an S record lock and the secondary index requests an S next-key lock.
  - If transactions A and B issue the same insert on a secondary index, A's inserted record carries an implicit lock that becomes an explicit X lock. B's request for a next-key lock fails and blocks.
- Avoid or resolve deadlocks:
  - Set a transaction lock-wait timeout and roll back on expiry.
  - Enable active deadlock detection and roll back one transaction in the cycle.

# Logs

# Inserts, deletes, and updates

- Undo log: rollback and MVCC; provides atomicity in InnoDB.
  - Written before the update.
  - Persisted through the redo log.
- Redo log: crash recovery; provides durability in InnoDB.
  - Records an update such as: apply operation AAA at offset ZZZ of page YYY in tablespace XXX.
  - WAL provides crash safety: modify dirty pages in the buffer pool and flush them in the background.
  - Converts random writes into sequential writes.
  - Redo-log buffer flush triggers:
    - Normal MySQL shutdown.
    - Buffer more than half full.
    - InnoDB background thread, once per second.
    - `innodb_flush_log_at_trx_commit`:
      - `0`: remain in the redo-log buffer.
      - `1`: write to disk at transaction commit.
      - `2`: write to the page cache at transaction commit.
  - Circular storage blocks when full.
    - Location chain: InnoDB → log buffer → redo-log files.
- Binlog: data backup and replication, owned by the server layer.
  - Formats:
    - `STATEMENT`: logical log of every data-changing SQL statement.
    - `ROW`: records the changed row data itself.
    - `MIXED`: selects a format according to the situation.
  - Append-only and retains the complete log history.
  - Flush timing:
    - A transaction writes completely to the binlog cache while executing.
    - At commit, the server thread writes the cache to the page cache, then `fsync`s the binlog file to disk.
    - `sync_binlog` controls frequency:
      - `0`: `write` only.
      - `1`: `fsync` at every transaction commit.
      - `N`: `fsync` after accumulating N transactions.

## Primary-replica replication

- Flow: the primary writes binlog, transfers it, and the replica replays it.
- Two or three replicas are reasonable: for example, one primary, two replicas, and one standby primary.
- Models: synchronous, asynchronous, and semi-synchronous, where acknowledgement from one replica is enough.
- Read/write architecture: route writes to the primary and suitable reads to replicas.

## Two-phase commit: Prepare + Commit

- A consistency protocol for the storage engine and server-layer transaction logs.
- Stages:
  - Prepare: write the internal XA transaction ID, XID, to redo log; mark the redo transaction `prepare`; persist it to disk. This is where `innodb_flush_log_at_trx_commit=1` matters.
  - Commit: write XID to binlog and persist it, where `sync_binlog=1` matters; then call the engine commit interface and mark redo log `commit`. The final redo status only needs to reach the file-system page cache because a successfully persisted binlog means the transaction is considered committed even if redo still says `prepare`.
- Crash recovery: find redo records in `prepare` and compare their XIDs with binlog.
- Costs:
  - High disk I/O from two flushes.
  - Heavy lock contention to preserve atomicity and ordering.

## Group commit

For redo log, merge the prepare phase into flush. For binlog, prepare is unchanged and commit becomes:

- Flush: batch binlog data from caches into files.
- Sync: `fsync` files to disk.
- Commit: update transaction states.

## Optimizing high disk I/O

- Main causes: redo-log and binlog flushes.
- Tune:
  - `binlog_group_commit_sync_delay` and `binlog_group_commit_sync_no_delay_count`.
  - `sync_binlog`, often between 100 and 1000 when the durability trade-off is acceptable.
  - `innodb_flush_log_at_trx_commit`.

---

# SQL syntax

```mysql
SELECT * FROM Students
ORDER BY score DESC -- ORDER is required
LIMIT 10 OFFSET 20; -- Equivalent to LIMIT 20, 10;

-- Scenario: an e-commerce database has Orders, Users, and Products tables.
-- Find active users who spent more than 1,000 in 2023. Return their names,
-- order counts, and average order values; sort by total spending and take the top five.
SELECT
    u.user_name AS "Name",
    COUNT(o.order_id) AS "Order count",
    SUM(o.amount) AS "Total spending",
    AVG(o.amount) AS "Average order value"
FROM users u
INNER JOIN orders o ON u.user_id = o.user_id -- Join condition
WHERE o.order_date >= '2023-01-01' -- Filter after joining
  AND o.status = 'completed'
  AND u.region IN ('Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen')
GROUP BY u.user_id, u.user_name
HAVING SUM(o.amount) > 1000
ORDER BY Total spending DESC
LIMIT 5 OFFSET 0;
```
