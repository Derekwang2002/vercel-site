---
title: Leetcode notes
summary: Notes and code snippets on data structures and algorithms.
---

# Algo notes

# Linked List

- Lookup: $O(n)$; insertion and deletion: $O(1)$.
- Length is dynamic. Linked lists suit frequent insertion and deletion with relatively few lookups.
- A dummy head simplifies most insert, delete, and update operations. It matters less for read-only traversal.
- Code:

```python
class ListNode:
    def __init__(self, val, next=None):
        self.val = val
        self.next = next
```

```cpp
// Singly linked list
struct ListNode {
    int val;  // element stored in this node
    ListNode *next;  // pointer to the next node
    ListNode(int x) : val(x), next(NULL) {}  // constructor
};
```

# Hash Table

- Quickly determine whether an element exists in a set.
  - Hash function: $h(value) = key$; many values may map to one key.
- Average lookup, add, and delete: O(1).
- Resolve collisions with separate chaining.
  - Balance *dataSize* and *hashSize*.
- Iterate entries in Java:

```java
for (Map.Entry<String, Integer> entry : map.entrySet()) {
    String key = entry.getKey();
    int value = entry.getValue();
}
```

# Strings

- A string is a finite sequence of characters and can be viewed as a character array, though languages add their own rules.
  - C stores the terminator `\0` in the array and uses it to detect the end.
  - C++ provides `string` and its `size` interface, so termination need not be detected with `\0`.
- **Do not become overly dependent on library functions while learning fundamentals.**
- Two pointers, reversal problems, and KMP.
- `StringBuilder` is useful for concatenating strings or characters:

```java
StringBuilder sb = new StringBuilder();
```

# Two Pointers

### Summary

- **Use two pointers to do the work of two loops in one `for` loop.**
- **For many array or string filling problems, resize to the final length first, then operate backward.**
- **For cycle detection, move `fast` two nodes and `slow` one node at a time. If they meet, the linked list has a cycle.**
- N-sum: **move front and back pointers toward each other to replace an inner loop.**

# Stack and Queue

- Stack: LIFO.
  - Java class:

```java
Deque<String> stack = new ArrayDeque<>();
stack.push();
stack.pop();
stack.peek();
```

- Queue: FIFO.
  - Java classes:

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

- Monotonic queue.
- Priority queue: min-heap or max-heap.

# Binary Tree

- **Full binary tree**: $2^k-1$ nodes for height $k$.
- **Complete binary tree**: the first n nodes of a full binary tree; it can also be understood as a composition of full trees.
- **Binary search tree**: left subtree < node < right subtree.
- **Balanced BST**: subtree-height difference ≤ 1.
- Traversal:
  - DFS: preorder, inorder, and postorder, named by root position.
  - BFS: level-order traversal.

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

- Know how to construct a binary tree by hand.

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

# Backtracking

- Backtracking uses recursion; a recursion tree is a useful mental model.
- Exhaustive enumeration often has poor time complexity.
- Types: combinations, subsets, partitioning, and permutations.
  - Deduplicate within a layer or path.
  - Sort before deduplication.
  - Deduplicate directly with a Map.
- **Template**: function definition, base case, and one-level search.
  - The recursive function commonly returns `void` and follows `if + for + recurse + undo`.
  - Recursion is vertical traversal; the `for` loop is horizontal traversal.

```cpp
void backtracking(parameters) {
    if (termination_condition) {
        save_result;
        return;
    }

    for (choice : choices_on_this_level) {
        process_node;
        backtracking(path, choice_list);
        undo_processing;
    }
}
```

# Greedy Algorithms

- Can a local optimum produce the global optimum?
- Test the idea by looking for a counterexample.
- Deliberately consider a greedy formulation when solving problems.
