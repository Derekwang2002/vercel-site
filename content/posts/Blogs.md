# Blogs

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

- quickly determine whether an element is present in a “set”
    - hash function: $h(value) = key$, **many to one(key unique to value)**
- Get: O(1), Add: O(1), Delete: O(1) ← on average
- Hash collision: seperate chaining
    - Weighing *dataSize* and *hashSize*
- Loop entry in Java:
    
    ```python
    for (Map.Entry<String, Integer> entry : map.entrySet()) {
    	String key = entry.getKey();
    	int value = entry.getValue();
    }
    ```
    

# Strings

[高频面试陷阱](https://www.notion.so/3052cf069c088093b073e108f8c127f3?pvs=21)

- 字符串是若干字符组成的有限序列，也可以理解为是一个字符数组，但是很多语言对字符串做了特殊的规定。
    - C语言中，把一个字符串存入一个数组时，也把结束符 '\0'存入数组，并以此作为该字符串是否结束的标志。
    - C++中，提供一个string类，string类会提供 size接口，可以用来判断string类字符串是否结束，就不用'\0'来判断是否结束。
- **打基础的时候，不要太迷恋于库函数!**
- 双指针法，反转系列，KMP
- StringBuilder 非常适用于拼接字符串/字符：
    
    ```java
    StringBuilder sb = new StringBuilder();
    ```
    

[Untitled](Untitled%203102cf069c0880eda69adbbad7cda137.csv)

# Double Pointer

### Summary

- **通过两个指针在一个for循环下完成两个for循环的工作。**
- **其实很多数组（字符串）填充类的问题，都可以先预先给数组扩容带填充后的大小，然后在从后向前进行操作**
- **使用快慢指针，分别定义 fast 和 slow指针，从头结点出发，fast指针每次移动两个节点，slow指针每次移动一个节点，如果 fast 和 slow指针在途中相遇 ，说明这个链表有环。**
- N数之和 - **通过前后两个指针不断向中间逼近，在一个for循环下完成两个for循环的工作**

[Untitled](Untitled%203102cf069c08801f83b9eea59cbe15bc.csv)

# Stack and queue

- Stack: LIFO
    - Java class:
    
    ```java
    Deque<String> stack = new ArrayDeque<>();
    stack.push();
    stack.pop();
    stack.peek();
    ```
    
- Queue: FIFO
    - Java class:
    
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
    
- Monotonical Queue
- Priority queue: min/max-heap

# Binary Tree

- **Full BT**: $2^k-1$ nodes, k is height
- **Complete BT**: first n nodes of a Full BT, or **composed by Full BTs**!
- **Binary Search Tree**: left subtree < node < right subtree
- **Balanced BST**: subtree height difference ≤ 1
- Traversal method:
    - DFS: Preorder; In-order; Postorder (root node)
    - BFS: Level Sequence Traversal
    
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
    
- Know how to construct a binary tree by hand!

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

[Binary Tree Traversal](https://www.notion.so/Binary-Tree-Traversal-3022cf069c0880dbbf7fe7251c054711?pvs=21)

> https://programmercarl.com/%E5%91%A8%E6%80%BB%E7%BB%93/20200927%E4%BA%8C%E5%8F%89%E6%A0%91%E5%91%A8%E6%9C%AB%E6%80%BB%E7%BB%93.html#%E5%91%A8%E5%85%AD
> 

> https://programmercarl.com/%E5%91%A8%E6%80%BB%E7%BB%93/20201003%E4%BA%8C%E5%8F%89%E6%A0%91%E5%91%A8%E6%9C%AB%E6%80%BB%E7%BB%93.html#%E5%91%A8%E4%B8%80
> 

> https://programmercarl.com/%E5%91%A8%E6%80%BB%E7%BB%93/20201010%E4%BA%8C%E5%8F%89%E6%A0%91%E5%91%A8%E6%9C%AB%E6%80%BB%E7%BB%93.html#%E5%91%A8%E4%B8%80
> 

> https://programmercarl.com/%E5%91%A8%E6%80%BB%E7%BB%93/20201017%E4%BA%8C%E5%8F%89%E6%A0%91%E5%91%A8%E6%9C%AB%E6%80%BB%E7%BB%93.html#%E5%91%A8%E4%B8%80
> 

> Feb 16 - Happy Chinese New Year!
> 

> https://programmercarl.com/%E4%BA%8C%E5%8F%89%E6%A0%91%E6%80%BB%E7%BB%93%E7%AF%87.html#%E4%BA%8C%E5%8F%89%E6%A0%91%E7%9A%84%E7%90%86%E8%AE%BA%E5%9F%BA%E7%A1%80
> 

# Backtracking algorithm

- Backtracking → recursion (use recursion tree to understand)
- exhaustive enumeration → Bad Time perform
- Types: combinations, subset, partitioning, permutation
    - layer/path-dedup
    - presort dedup
    - direct map dedup
- **Template (**3 steps: function title, base case, single layer search)
    - Recursion function: return void, if + for + (backtracking)return
    - Recursion + for:
        - Recursion: vertical traversal
        - for loop: horizontal traversal
    - Seudocode:
    
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
    

(https://programmercarl.com/%E5%91%A8%E6%80%BB%E7%BB%93/20201030%E5%9B%9E%E6%BA%AF%E5%91%A8%E6%9C%AB%E6%80%BB%E7%BB%93.html#%E5%91%A8%E4%B8%80)

https://programmercarl.com/%E5%91%A8%E6%80%BB%E7%BB%93/20201107%E5%9B%9E%E6%BA%AF%E5%91%A8%E6%9C%AB%E6%80%BB%E7%BB%93.html#%E5%91%A8%E4%B8%80

https://programmercarl.com/%E5%91%A8%E6%80%BB%E7%BB%93/20201112%E5%9B%9E%E6%BA%AF%E5%91%A8%E6%9C%AB%E6%80%BB%E7%BB%93.html#%E5%91%A8%E4%B8%80

https://programmercarl.com/%E5%9B%9E%E6%BA%AF%E7%AE%97%E6%B3%95%E5%8E%BB%E9%87%8D%E9%97%AE%E9%A2%98%E7%9A%84%E5%8F%A6%E4%B8%80%E7%A7%8D%E5%86%99%E6%B3%95.html#_90-%E5%AD%90%E9%9B%86ii

https://programmercarl.com/%E5%9B%9E%E6%BA%AF%E6%80%BB%E7%BB%93.html#%E5%9B%9E%E6%BA%AF%E6%B3%95%E7%90%86%E8%AE%BA%E5%9F%BA%E7%A1%80

# Greedy Algo

- Local optimal → Global optimal?
- Verify: come up controversy
- When doing any problems, force think in a “greedy” way

https://programmercarl.com/%E5%91%A8%E6%80%BB%E7%BB%93/20201126%E8%B4%AA%E5%BF%83%E5%91%A8%E6%9C%AB%E6%80%BB%E7%BB%93.html

https://programmercarl.com/%E5%91%A8%E6%80%BB%E7%BB%93/20201203%E8%B4%AA%E5%BF%83%E5%91%A8%E6%9C%AB%E6%80%BB%E7%BB%93.html#%E5%91%A8%E4%B8%80

https://programmercarl.com/%E5%91%A8%E6%80%BB%E7%BB%93/20201217%E8%B4%AA%E5%BF%83%E5%91%A8%E6%9C%AB%E6%80%BB%E7%BB%93.html

https://programmercarl.com/%E5%91%A8%E6%80%BB%E7%BB%93/20201224%E8%B4%AA%E5%BF%83%E5%91%A8%E6%9C%AB%E6%80%BB%E7%BB%93.html

---

[PR to-do:](https://www.notion.so/PR-to-do-3152cf069c088015a16cd57186c7fb5c?pvs=21)