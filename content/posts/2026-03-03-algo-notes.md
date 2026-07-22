---
title: LeetCode 笔记
date: 2026-03-03
summary: 数据结构与算法的学习笔记和代码片段。
tags: [Notes, Algorithms]
selected: true
draft: false
---

# Linked List

- 查询：$O(n)$；增删：$O(1)$
- 特性：长度不固定，可以动态增删，适合频繁增删少查询的情景
- 一般涉及到 增删改操作，用虚拟头结点都会方便很多， 如果只能查的话，用不用虚拟头结点都差不多。
- 代码：

```python
class ListNode:
    def __init__(self, val, next=None):
        self.val = val
        self.next = next
```

```cpp
// 单链表
struct ListNode {
    int val;  // 节点上存储的元素
    ListNode *next;  // 指向下一个节点的指针
    ListNode(int x) : val(x), next(NULL) {}  // 节点的构造函数
};
```

# Hash Table

- 快速判断一个元素是否存在于“集合”中
    - Hash Function：$h(value) = key$，**多对一（key 由 value 唯一确定）**
- Get：O(1)，Add：O(1)，Delete：O(1)（平均复杂度）
- Hash Collision：使用 Separate Chaining 解决
    - 权衡 *dataSize* 与 *hashSize*
- 在 Java 中遍历 Entry：

```python
for (Map.Entry<String, Integer> entry : map.entrySet()) {
    String key = entry.getKey();
    int value = entry.getValue();
}
```


# Strings

- 字符串是若干字符组成的有限序列，也可以理解为是一个字符数组，但是很多语言对字符串做了特殊的规定。
    - C语言中，把一个字符串存入一个数组时，也把结束符 '\0'存入数组，并以此作为该字符串是否结束的标志。
    - C++中，提供一个string类，string类会提供 size接口，可以用来判断string类字符串是否结束，就不用'\0'来判断是否结束。
- **打基础的时候，不要太迷恋于库函数!**
- 双指针法，反转系列，KMP
- StringBuilder 非常适用于拼接字符串/字符：

```java
StringBuilder sb = new StringBuilder();
```


# Double Pointer

### 总结

- **通过两个指针在一个for循环下完成两个for循环的工作。**
- **其实很多数组（字符串）填充类的问题，都可以先预先给数组扩容带填充后的大小，然后在从后向前进行操作**
- **使用快慢指针，分别定义 fast 和 slow指针，从头结点出发，fast指针每次移动两个节点，slow指针每次移动一个节点，如果 fast 和 slow指针在途中相遇 ，说明这个链表有环。**
- N数之和 - **通过前后两个指针不断向中间逼近，在一个for循环下完成两个for循环的工作**

# Stack and queue

- Stack：LIFO（后进先出）
    - Java Class：

```java
Deque<String> stack = new ArrayDeque<>();
stack.push();
stack.pop();
stack.peek();
```

- Queue：FIFO（先进先出）
    - Java Class：

```java
Queue<String> queue = new ArrayDeque<>();
queue.offer();
queue.poll();
queue.front();

Deque<String> deque = new ArrayDeque<>();
deque.offerFirst();
deque.offerLast();
deque.pollFirst();
deque.pollLast();
deque.peekFront();
deque.peekLast();
```

- Monotonic Queue（单调队列）
- Priority Queue：Min-Heap / Max-Heap

# Binary Tree

- **Full Binary Tree**：共有 $2^k-1$ 个节点，其中 k 为树高
- **Complete Binary Tree**：由 Full Binary Tree 的前 n 个节点组成，或**由多个 Full Binary Tree 构成**
- **Binary Search Tree**：左子树 < 根节点 < 右子树
- **Balanced BST**：左右子树的高度差 ≤ 1
- 遍历方式：
    - DFS：Preorder、In-order、Postorder（以根节点的位置命名）
    - BFS：Level Order Traversal

```java
public void traverseBFS(TreeNode root) {
    Queue<TreeNode> que = new ArrayDeque<>();
    if (root != null) { que.offer(root); }
    while (!que.isEmpty()) {
        TreeNode cur = que.poll();
        if (cur.left != null) { que.offer(cur.left); }
        if (cur.right != null) { que.offer(cur.right); }
    }
}
```

- 掌握手动构造 Binary Tree 的方法

```java
public class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;

    TreeNode() {}
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) {
        this.val = val;
        this.left = left;
        this.right = right;
    }
}
```


# Backtracking algorithm

- Backtracking → Recursion（可以借助递归树理解）
- 本质是穷举，因此时间复杂度通常较高
- 常见类型：Combination、Subset、Partitioning、Permutation
    - 同层 / 路径去重
    - 预排序去重
    - 使用 Map 直接去重
- **模板**（三个步骤：函数定义、终止条件、单层搜索）
    - 递归函数：返回 `void`，结构通常为 `if + for + backtracking + return`
    - Recursion + `for`：
        - Recursion：纵向遍历
        - `for` 循环：横向遍历
    - 伪代码：

```cpp
void backtracking(参数) {
    if (终止条件) {
        存放结果;
        return;
    }

    for (选择：本层集合中元素（树中节点孩子的数量就是集合的大小）) {
        处理节点;
        backtracking(路径，选择列表); // 递归
        回溯，撤销处理结果
    }
}
```


# Greedy Algo

- 局部最优能否推导出全局最优？
- 验证方法：尝试寻找反例
- 解题时可以主动尝试从 Greedy 的角度思考
