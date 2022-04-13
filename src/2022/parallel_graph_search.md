# Parallelizing graph search with Rayon

<div class="infobar">

<fa:clock-o> 2022-04-08
<fa:user> Tavian Barnes
[<fa:reddit> Reddit](https://www.reddit.com/r/rust/comments/tz4lcy/parallelizing_graph_search_with_rayon/)
[<fa:github> GitHub](https://github.com/tavianator/spliter)
[<fa:cubes> crates.io](https://crates.io/crates/spliter)
[<fa:book> Docs](https://docs.rs/spliter)

</div>

[Rayon](https://crates.io/crates/rayon) is the standard data-parallelism library for Rust.
Its premise is straightforward: if you have some code using an [`Iterator`](https://doc.rust-lang.org/std/iter/trait.Iterator.html) like this,

```rust,no_run,noplayground
(1..100)
    .map(|i| match (i % 3, i % 5) {
        (0, 0) => Cow::from("FizzBuzz"),
        (0, _) => Cow::from("Fizz"),
        (_, 0) => Cow::from("Buzz"),
        (_, _) => Cow::from(i.to_string()),
    })
    .for_each(|s| println!("{s}"));
```

then you can parallelize it by switching to a [`ParallelIterator`](https://docs.rs/rayon/latest/rayon/iter/trait.ParallelIterator.html),

```diff
 (1..100)
+    .into_par_iter()
     .map(|i| match (i % 3, i % 5) {
```

and your code is now parallel and fast!

Rayon works well for datasets whose size is fixed upfront.
But what if the dataset can grow as you loop through it?
The situation I'm thinking of is [graph search](https://en.wikipedia.org/wiki/Graph_traversal), where the more nodes you process, the more of their children you find.


## Sequential search

Before we parallelize it, let's start with the sequential version of [depth-first search](https://en.wikipedia.org/wiki/Depth-first_search).
It's pretty simple:

```rust,no_run,noplayground
struct DepthFirstSearch {
    stack: Vec<Node>,
}

impl Iterator for DepthFirstSearch {
    type Item = Node;

    fn next(&mut self) -> Option<Self::Item> {
        if let Some(node) = self.stack.pop() {
            self.stack.extend(node.children());
            Some(node)
        } else {
            None
        }
    }
}
```

<details>
<summary>(If we wanted breadth-first search instead, that's also simple.)</summary>

```diff
-struct DepthFirstSearch {
+struct BreadthFirstSearch {
-     stack: Vec<Node>,
+     queue: VecDeque<Node>,
 }
 
-impl Iterator for DepthFirstSearch {
+impl Iterator for BreadthFirstSearch {
     type Item = Node;
 
     fn next(&mut self) -> Option<Self::Item> {
-        if let Some(node) = self.stack.pop() {
+        if let Some(node) = self.queue.pop_front() {
             self.stack.extend(node.children());
```

</details>

To benchmark this, we'll need to pick a specific graph.
I chose the [2×2×2 Rubik's cube](https://en.wikipedia.org/wiki/Pocket_Cube) (“pocket cube”) for my examples.
Each node is a Rubik's cube, and its children are all the cubes reachable with a single turn of one of the faces.

<svg style="display:block; margin:auto; font-family:serif;" width="640" height="640" viewBox="-320 -320 640 640">
<polygon points="-20,-10 -40,-20 -20,-30 0,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,-20 -20,-30 0,-40 20,-30" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,0 -20,-10 0,-20 20,-10" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="20,-10 0,-20 20,-30 40,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="-20,-10 -40,-20 -40,0 -20,10" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 -20,-10 -20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="-20,10 -40,0 -40,20 -20,30" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,20 -20,10 -20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 20,-10 20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="20,-10 40,-20 40,0 20,10" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="0,20 20,10 20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="20,10 40,0 40,20 20,30" stroke="var(--fg)" stroke-width="3" fill="green" />
<line x1="-30" y1="-35" x2="-120" y2="-80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(-160,-100) scale(0.75)">
<polygon points="-20,-10 -40,-20 -20,-30 0,-20" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="0,-20 -20,-30 0,-40 20,-30" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="0,0 -20,-10 0,-20 20,-10" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="20,-10 0,-20 20,-30 40,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="-20,-10 -40,-20 -40,0 -20,10" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,0 -20,-10 -20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="-20,10 -40,0 -40,20 -20,30" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,20 -20,10 -20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 20,-10 20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="20,-10 40,-20 40,0 20,10" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="0,20 20,10 20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="20,10 40,0 40,20 20,30" stroke="var(--fg)" stroke-width="3" fill="green" />
<line x1="-30" y1="-35" x2="-60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(-100,-70) scale(0.75)">
<polygon points="-20,-10 -40,-20 -20,-30 0,-20" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<polygon points="0,-20 -20,-30 0,-40 20,-30" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<polygon points="0,0 -20,-10 0,-20 20,-10" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="20,-10 0,-20 20,-30 40,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="-20,-10 -40,-20 -40,0 -20,10" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="0,0 -20,-10 -20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="-20,10 -40,0 -40,20 -20,30" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="0,20 -20,10 -20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 20,-10 20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="20,-10 40,-20 40,0 20,10" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="0,20 20,10 20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="20,10 40,0 40,20 20,30" stroke="var(--fg)" stroke-width="3" fill="green" />
<line x1="-30" y1="-35" x2="-60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(-100,-70) scale(0.75)">
</g>
<line x1="0" y1="-50" x2="0" y2="-80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(0,-120) scale(0.75)">
</g>
<line x1="30" y1="-35" x2="60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<line x1="0" y1="50" x2="0" y2="80" stroke="var(--fg)" stroke-width="3" />
<line x1="-30" y1="35" x2="-60" y2="50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(-100,70) scale(0.75)">
</g>
</g>
<line x1="0" y1="-50" x2="0" y2="-80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(0,-120) scale(0.75)">
<polygon points="-20,-10 -40,-20 -20,-30 0,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,-20 -20,-30 0,-40 20,-30" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="0,0 -20,-10 0,-20 20,-10" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="20,-10 0,-20 20,-30 40,-20" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="-20,-10 -40,-20 -40,0 -20,10" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="0,0 -20,-10 -20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="-20,10 -40,0 -40,20 -20,30" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,20 -20,10 -20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 20,-10 20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="20,-10 40,-20 40,0 20,10" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<polygon points="0,20 20,10 20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="20,10 40,0 40,20 20,30" stroke="var(--fg)" stroke-width="3" fill="green" />
<line x1="-30" y1="-35" x2="-60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(-100,-70) scale(0.75)">
</g>
<line x1="0" y1="-50" x2="0" y2="-80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(0,-120) scale(0.75)">
</g>
<line x1="30" y1="-35" x2="60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(100,-70) scale(0.75)">
</g>
<line x1="30" y1="35" x2="60" y2="50" stroke="var(--fg)" stroke-width="3" />
<line x1="-30" y1="35" x2="-60" y2="50" stroke="var(--fg)" stroke-width="3" />
</g>
<line x1="30" y1="-35" x2="60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<line x1="0" y1="50" x2="0" y2="80" stroke="var(--fg)" stroke-width="3" />
<line x1="-30" y1="35" x2="-60" y2="50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(-100,70) scale(0.75)">
<polygon points="-20,-10 -40,-20 -20,-30 0,-20" stroke="var(--fg)" stroke-width="3" fill="blue" />
<polygon points="0,-20 -20,-30 0,-40 20,-30" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="0,0 -20,-10 0,-20 20,-10" stroke="var(--fg)" stroke-width="3" fill="blue" />
<polygon points="20,-10 0,-20 20,-30 40,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="-20,-10 -40,-20 -40,0 -20,10" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,0 -20,-10 -20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="-20,10 -40,0 -40,20 -20,30" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,20 -20,10 -20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 20,-10 20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="20,-10 40,-20 40,0 20,10" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="0,20 20,10 20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="20,10 40,0 40,20 20,30" stroke="var(--fg)" stroke-width="3" fill="green" />
<line x1="-30" y1="-35" x2="-60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(-100,-70) scale(0.75)">
</g>
<line x1="0" y1="-50" x2="0" y2="-80" stroke="var(--fg)" stroke-width="3" />
<line x1="30" y1="35" x2="60" y2="50" stroke="var(--fg)" stroke-width="3" />
<line x1="0" y1="50" x2="0" y2="80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(0,120) scale(0.75)">
</g>
<line x1="-30" y1="35" x2="-60" y2="50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(-100,70) scale(0.75)">
</g>
</g>
</g>
<line x1="0" y1="-50" x2="0" y2="-140" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(0,-180) scale(0.75)">
<polygon points="-20,-10 -40,-20 -20,-30 0,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,-20 -20,-30 0,-40 20,-30" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,0 -20,-10 0,-20 20,-10" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="20,-10 0,-20 20,-30 40,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="-20,-10 -40,-20 -40,0 -20,10" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="0,0 -20,-10 -20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="-20,10 -40,0 -40,20 -20,30" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,20 -20,10 -20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 20,-10 20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="20,-10 40,-20 40,0 20,10" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="0,20 20,10 20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="20,10 40,0 40,20 20,30" stroke="var(--fg)" stroke-width="3" fill="green" />
<line x1="-30" y1="-35" x2="-60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(-100,-70) scale(0.75)">
<polygon points="-20,-10 -40,-20 -20,-30 0,-20" stroke="var(--fg)" stroke-width="3" fill="blue" />
<polygon points="0,-20 -20,-30 0,-40 20,-30" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="0,0 -20,-10 0,-20 20,-10" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="20,-10 0,-20 20,-30 40,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="-20,-10 -40,-20 -40,0 -20,10" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,0 -20,-10 -20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="-20,10 -40,0 -40,20 -20,30" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,20 -20,10 -20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 20,-10 20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="20,-10 40,-20 40,0 20,10" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="0,20 20,10 20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="20,10 40,0 40,20 20,30" stroke="var(--fg)" stroke-width="3" fill="green" />
<line x1="-30" y1="-35" x2="-60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(-100,-70) scale(0.75)">
</g>
<line x1="0" y1="-50" x2="0" y2="-80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(0,-120) scale(0.75)">
</g>
<line x1="30" y1="-35" x2="60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<line x1="0" y1="50" x2="0" y2="80" stroke="var(--fg)" stroke-width="3" />
<line x1="-30" y1="35" x2="-60" y2="50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(-100,70) scale(0.75)">
</g>
</g>
<line x1="0" y1="-50" x2="0" y2="-80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(0,-120) scale(0.75)">
<polygon points="-20,-10 -40,-20 -20,-30 0,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,-20 -20,-30 0,-40 20,-30" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,0 -20,-10 0,-20 20,-10" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="20,-10 0,-20 20,-30 40,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="-20,-10 -40,-20 -40,0 -20,10" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="0,0 -20,-10 -20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="-20,10 -40,0 -40,20 -20,30" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,20 -20,10 -20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 20,-10 20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="blue" />
<polygon points="20,-10 40,-20 40,0 20,10" stroke="var(--fg)" stroke-width="3" fill="blue" />
<polygon points="0,20 20,10 20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="20,10 40,0 40,20 20,30" stroke="var(--fg)" stroke-width="3" fill="green" />
<line x1="-30" y1="-35" x2="-60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(-100,-70) scale(0.75)">
</g>
<line x1="0" y1="-50" x2="0" y2="-80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(0,-120) scale(0.75)">
</g>
<line x1="30" y1="-35" x2="60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(100,-70) scale(0.75)">
</g>
<line x1="30" y1="35" x2="60" y2="50" stroke="var(--fg)" stroke-width="3" />
<line x1="-30" y1="35" x2="-60" y2="50" stroke="var(--fg)" stroke-width="3" />
</g>
<line x1="30" y1="-35" x2="60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(100,-70) scale(0.75)">
<polygon points="-20,-10 -40,-20 -20,-30 0,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,-20 -20,-30 0,-40 20,-30" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="0,0 -20,-10 0,-20 20,-10" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="20,-10 0,-20 20,-30 40,-20" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="-20,-10 -40,-20 -40,0 -20,10" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="0,0 -20,-10 -20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="-20,10 -40,0 -40,20 -20,30" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,20 -20,10 -20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 20,-10 20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="20,-10 40,-20 40,0 20,10" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<polygon points="0,20 20,10 20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="20,10 40,0 40,20 20,30" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<line x1="-30" y1="-35" x2="-60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<line x1="0" y1="-50" x2="0" y2="-80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(0,-120) scale(0.75)">
</g>
<line x1="30" y1="-35" x2="60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(100,-70) scale(0.75)">
</g>
<line x1="30" y1="35" x2="60" y2="50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(100,70) scale(0.75)">
</g>
<line x1="0" y1="50" x2="0" y2="80" stroke="var(--fg)" stroke-width="3" />
</g>
<line x1="30" y1="35" x2="60" y2="50" stroke="var(--fg)" stroke-width="3" />
<line x1="-30" y1="35" x2="-60" y2="50" stroke="var(--fg)" stroke-width="3" />
</g>
<line x1="30" y1="-35" x2="120" y2="-80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(160,-100) scale(0.75)">
<polygon points="-20,-10 -40,-20 -20,-30 0,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,-20 -20,-30 0,-40 20,-30" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="0,0 -20,-10 0,-20 20,-10" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="20,-10 0,-20 20,-30 40,-20" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="-20,-10 -40,-20 -40,0 -20,10" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 -20,-10 -20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="-20,10 -40,0 -40,20 -20,30" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,20 -20,10 -20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 20,-10 20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="20,-10 40,-20 40,0 20,10" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<polygon points="0,20 20,10 20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="20,10 40,0 40,20 20,30" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<line x1="-30" y1="-35" x2="-60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<line x1="0" y1="-50" x2="0" y2="-80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(0,-120) scale(0.75)">
<polygon points="-20,-10 -40,-20 -20,-30 0,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,-20 -20,-30 0,-40 20,-30" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,0 -20,-10 0,-20 20,-10" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="20,-10 0,-20 20,-30 40,-20" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="-20,-10 -40,-20 -40,0 -20,10" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="0,0 -20,-10 -20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<polygon points="-20,10 -40,0 -40,20 -20,30" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,20 -20,10 -20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 20,-10 20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="20,-10 40,-20 40,0 20,10" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="0,20 20,10 20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="20,10 40,0 40,20 20,30" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<line x1="-30" y1="-35" x2="-60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(-100,-70) scale(0.75)">
</g>
<line x1="0" y1="-50" x2="0" y2="-80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(0,-120) scale(0.75)">
</g>
<line x1="30" y1="-35" x2="60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(100,-70) scale(0.75)">
</g>
<line x1="30" y1="35" x2="60" y2="50" stroke="var(--fg)" stroke-width="3" />
<line x1="-30" y1="35" x2="-60" y2="50" stroke="var(--fg)" stroke-width="3" />
</g>
<line x1="30" y1="-35" x2="60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(100,-70) scale(0.75)">
<polygon points="-20,-10 -40,-20 -20,-30 0,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,-20 -20,-30 0,-40 20,-30" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<polygon points="0,0 -20,-10 0,-20 20,-10" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="20,-10 0,-20 20,-30 40,-20" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<polygon points="-20,-10 -40,-20 -40,0 -20,10" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 -20,-10 -20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="-20,10 -40,0 -40,20 -20,30" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,20 -20,10 -20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 20,-10 20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="20,-10 40,-20 40,0 20,10" stroke="var(--fg)" stroke-width="3" fill="blue" />
<polygon points="0,20 20,10 20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="20,10 40,0 40,20 20,30" stroke="var(--fg)" stroke-width="3" fill="blue" />
<line x1="-30" y1="-35" x2="-60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<line x1="0" y1="-50" x2="0" y2="-80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(0,-120) scale(0.75)">
</g>
<line x1="30" y1="-35" x2="60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(100,-70) scale(0.75)">
</g>
<line x1="30" y1="35" x2="60" y2="50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(100,70) scale(0.75)">
</g>
<line x1="0" y1="50" x2="0" y2="80" stroke="var(--fg)" stroke-width="3" />
</g>
<line x1="30" y1="35" x2="60" y2="50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(100,70) scale(0.75)">
<polygon points="-20,-10 -40,-20 -20,-30 0,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,-20 -20,-30 0,-40 20,-30" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="0,0 -20,-10 0,-20 20,-10" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="20,-10 0,-20 20,-30 40,-20" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="-20,-10 -40,-20 -40,0 -20,10" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 -20,-10 -20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<polygon points="-20,10 -40,0 -40,20 -20,30" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,20 -20,10 -20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="blue" />
<polygon points="0,0 20,-10 20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="20,-10 40,-20 40,0 20,10" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="0,20 20,10 20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<polygon points="20,10 40,0 40,20 20,30" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<line x1="0" y1="-50" x2="0" y2="-80" stroke="var(--fg)" stroke-width="3" />
<line x1="30" y1="-35" x2="60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(100,-70) scale(0.75)">
</g>
<line x1="30" y1="35" x2="60" y2="50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(100,70) scale(0.75)">
</g>
<line x1="0" y1="50" x2="0" y2="80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(0,120) scale(0.75)">
</g>
<line x1="-30" y1="35" x2="-60" y2="50" stroke="var(--fg)" stroke-width="3" />
</g>
<line x1="0" y1="50" x2="0" y2="80" stroke="var(--fg)" stroke-width="3" />
</g>
<line x1="30" y1="35" x2="120" y2="80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(160,100) scale(0.75)">
<polygon points="-20,-10 -40,-20 -20,-30 0,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,-20 -20,-30 0,-40 20,-30" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,0 -20,-10 0,-20 20,-10" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="20,-10 0,-20 20,-30 40,-20" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="-20,-10 -40,-20 -40,0 -20,10" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 -20,-10 -20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<polygon points="-20,10 -40,0 -40,20 -20,30" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,20 -20,10 -20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<polygon points="0,0 20,-10 20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="20,-10 40,-20 40,0 20,10" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="0,20 20,10 20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="20,10 40,0 40,20 20,30" stroke="var(--fg)" stroke-width="3" fill="green" />
<line x1="0" y1="-50" x2="0" y2="-80" stroke="var(--fg)" stroke-width="3" />
<line x1="30" y1="-35" x2="60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(100,-70) scale(0.75)">
<polygon points="-20,-10 -40,-20 -20,-30 0,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,-20 -20,-30 0,-40 20,-30" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="0,0 -20,-10 0,-20 20,-10" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="20,-10 0,-20 20,-30 40,-20" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="-20,-10 -40,-20 -40,0 -20,10" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 -20,-10 -20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<polygon points="-20,10 -40,0 -40,20 -20,30" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,20 -20,10 -20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<polygon points="0,0 20,-10 20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="20,-10 40,-20 40,0 20,10" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="0,20 20,10 20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="20,10 40,0 40,20 20,30" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<line x1="-30" y1="-35" x2="-60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<line x1="0" y1="-50" x2="0" y2="-80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(0,-120) scale(0.75)">
</g>
<line x1="30" y1="-35" x2="60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(100,-70) scale(0.75)">
</g>
<line x1="30" y1="35" x2="60" y2="50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(100,70) scale(0.75)">
</g>
<line x1="0" y1="50" x2="0" y2="80" stroke="var(--fg)" stroke-width="3" />
</g>
<line x1="30" y1="35" x2="60" y2="50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(100,70) scale(0.75)">
<polygon points="-20,-10 -40,-20 -20,-30 0,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,-20 -20,-30 0,-40 20,-30" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,0 -20,-10 0,-20 20,-10" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<polygon points="20,-10 0,-20 20,-30 40,-20" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<polygon points="-20,-10 -40,-20 -40,0 -20,10" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 -20,-10 -20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="-20,10 -40,0 -40,20 -20,30" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,20 -20,10 -20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="0,0 20,-10 20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="20,-10 40,-20 40,0 20,10" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="0,20 20,10 20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="20,10 40,0 40,20 20,30" stroke="var(--fg)" stroke-width="3" fill="green" />
<line x1="0" y1="-50" x2="0" y2="-80" stroke="var(--fg)" stroke-width="3" />
<line x1="30" y1="-35" x2="60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(100,-70) scale(0.75)">
</g>
<line x1="30" y1="35" x2="60" y2="50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(100,70) scale(0.75)">
</g>
<line x1="0" y1="50" x2="0" y2="80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(0,120) scale(0.75)">
</g>
<line x1="-30" y1="35" x2="-60" y2="50" stroke="var(--fg)" stroke-width="3" />
</g>
<line x1="0" y1="50" x2="0" y2="80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(0,120) scale(0.75)">
<polygon points="-20,-10 -40,-20 -20,-30 0,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,-20 -20,-30 0,-40 20,-30" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,0 -20,-10 0,-20 20,-10" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="20,-10 0,-20 20,-30 40,-20" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="-20,-10 -40,-20 -40,0 -20,10" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 -20,-10 -20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<polygon points="-20,10 -40,0 -40,20 -20,30" stroke="var(--fg)" stroke-width="3" fill="blue" />
<polygon points="0,20 -20,10 -20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="blue" />
<polygon points="0,0 20,-10 20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="20,-10 40,-20 40,0 20,10" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="0,20 20,10 20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="20,10 40,0 40,20 20,30" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<line x1="-30" y1="-35" x2="-60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<line x1="30" y1="-35" x2="60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<line x1="30" y1="35" x2="60" y2="50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(100,70) scale(0.75)">
</g>
<line x1="0" y1="50" x2="0" y2="80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(0,120) scale(0.75)">
</g>
<line x1="-30" y1="35" x2="-60" y2="50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(-100,70) scale(0.75)">
</g>
</g>
<line x1="-30" y1="35" x2="-60" y2="50" stroke="var(--fg)" stroke-width="3" />
</g>
<line x1="0" y1="50" x2="0" y2="140" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(0,180) scale(0.75)">
<polygon points="-20,-10 -40,-20 -20,-30 0,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,-20 -20,-30 0,-40 20,-30" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,0 -20,-10 0,-20 20,-10" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="20,-10 0,-20 20,-30 40,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="-20,-10 -40,-20 -40,0 -20,10" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 -20,-10 -20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="-20,10 -40,0 -40,20 -20,30" stroke="var(--fg)" stroke-width="3" fill="blue" />
<polygon points="0,20 -20,10 -20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="blue" />
<polygon points="0,0 20,-10 20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="20,-10 40,-20 40,0 20,10" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="0,20 20,10 20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="20,10 40,0 40,20 20,30" stroke="var(--fg)" stroke-width="3" fill="orange" />
<line x1="-30" y1="-35" x2="-60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<line x1="30" y1="-35" x2="60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<line x1="30" y1="35" x2="60" y2="50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(100,70) scale(0.75)">
<polygon points="-20,-10 -40,-20 -20,-30 0,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,-20 -20,-30 0,-40 20,-30" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,0 -20,-10 0,-20 20,-10" stroke="var(--fg)" stroke-width="3" fill="blue" />
<polygon points="20,-10 0,-20 20,-30 40,-20" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="-20,-10 -40,-20 -40,0 -20,10" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 -20,-10 -20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<polygon points="-20,10 -40,0 -40,20 -20,30" stroke="var(--fg)" stroke-width="3" fill="blue" />
<polygon points="0,20 -20,10 -20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<polygon points="0,0 20,-10 20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="20,-10 40,-20 40,0 20,10" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="0,20 20,10 20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="20,10 40,0 40,20 20,30" stroke="var(--fg)" stroke-width="3" fill="green" />
<line x1="0" y1="-50" x2="0" y2="-80" stroke="var(--fg)" stroke-width="3" />
<line x1="30" y1="-35" x2="60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(100,-70) scale(0.75)">
</g>
<line x1="30" y1="35" x2="60" y2="50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(100,70) scale(0.75)">
</g>
<line x1="0" y1="50" x2="0" y2="80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(0,120) scale(0.75)">
</g>
<line x1="-30" y1="35" x2="-60" y2="50" stroke="var(--fg)" stroke-width="3" />
</g>
<line x1="0" y1="50" x2="0" y2="80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(0,120) scale(0.75)">
<polygon points="-20,-10 -40,-20 -20,-30 0,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,-20 -20,-30 0,-40 20,-30" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,0 -20,-10 0,-20 20,-10" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="20,-10 0,-20 20,-30 40,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="-20,-10 -40,-20 -40,0 -20,10" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 -20,-10 -20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="-20,10 -40,0 -40,20 -20,30" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="0,20 -20,10 -20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="0,0 20,-10 20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="20,-10 40,-20 40,0 20,10" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="0,20 20,10 20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="blue" />
<polygon points="20,10 40,0 40,20 20,30" stroke="var(--fg)" stroke-width="3" fill="blue" />
<line x1="-30" y1="-35" x2="-60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<line x1="30" y1="-35" x2="60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<line x1="30" y1="35" x2="60" y2="50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(100,70) scale(0.75)">
</g>
<line x1="0" y1="50" x2="0" y2="80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(0,120) scale(0.75)">
</g>
<line x1="-30" y1="35" x2="-60" y2="50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(-100,70) scale(0.75)">
</g>
</g>
<line x1="-30" y1="35" x2="-60" y2="50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(-100,70) scale(0.75)">
<polygon points="-20,-10 -40,-20 -20,-30 0,-20" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="0,-20 -20,-30 0,-40 20,-30" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,0 -20,-10 0,-20 20,-10" stroke="var(--fg)" stroke-width="3" fill="blue" />
<polygon points="20,-10 0,-20 20,-30 40,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="-20,-10 -40,-20 -40,0 -20,10" stroke="var(--fg)" stroke-width="3" fill="blue" />
<polygon points="0,0 -20,-10 -20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="-20,10 -40,0 -40,20 -20,30" stroke="var(--fg)" stroke-width="3" fill="blue" />
<polygon points="0,20 -20,10 -20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 20,-10 20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="20,-10 40,-20 40,0 20,10" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="0,20 20,10 20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="20,10 40,0 40,20 20,30" stroke="var(--fg)" stroke-width="3" fill="orange" />
<line x1="-30" y1="-35" x2="-60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(-100,-70) scale(0.75)">
</g>
<line x1="0" y1="-50" x2="0" y2="-80" stroke="var(--fg)" stroke-width="3" />
<line x1="30" y1="35" x2="60" y2="50" stroke="var(--fg)" stroke-width="3" />
<line x1="0" y1="50" x2="0" y2="80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(0,120) scale(0.75)">
</g>
<line x1="-30" y1="35" x2="-60" y2="50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(-100,70) scale(0.75)">
</g>
</g>
</g>
<line x1="-30" y1="35" x2="-120" y2="80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(-160,100) scale(0.75)">
<polygon points="-20,-10 -40,-20 -20,-30 0,-20" stroke="var(--fg)" stroke-width="3" fill="blue" />
<polygon points="0,-20 -20,-30 0,-40 20,-30" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,0 -20,-10 0,-20 20,-10" stroke="var(--fg)" stroke-width="3" fill="blue" />
<polygon points="20,-10 0,-20 20,-30 40,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="-20,-10 -40,-20 -40,0 -20,10" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 -20,-10 -20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="-20,10 -40,0 -40,20 -20,30" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,20 -20,10 -20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 20,-10 20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="20,-10 40,-20 40,0 20,10" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="0,20 20,10 20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="20,10 40,0 40,20 20,30" stroke="var(--fg)" stroke-width="3" fill="green" />
<line x1="-30" y1="-35" x2="-60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(-100,-70) scale(0.75)">
<polygon points="-20,-10 -40,-20 -20,-30 0,-20" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="0,-20 -20,-30 0,-40 20,-30" stroke="var(--fg)" stroke-width="3" fill="red" />
<polygon points="0,0 -20,-10 0,-20 20,-10" stroke="var(--fg)" stroke-width="3" fill="blue" />
<polygon points="20,-10 0,-20 20,-30 40,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="-20,-10 -40,-20 -40,0 -20,10" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,0 -20,-10 -20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="-20,10 -40,0 -40,20 -20,30" stroke="var(--fg)" stroke-width="3" fill="blue" />
<polygon points="0,20 -20,10 -20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 20,-10 20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="20,-10 40,-20 40,0 20,10" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="0,20 20,10 20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="20,10 40,0 40,20 20,30" stroke="var(--fg)" stroke-width="3" fill="green" />
<line x1="-30" y1="-35" x2="-60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(-100,-70) scale(0.75)">
</g>
<line x1="0" y1="-50" x2="0" y2="-80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(0,-120) scale(0.75)">
</g>
<line x1="30" y1="-35" x2="60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<line x1="0" y1="50" x2="0" y2="80" stroke="var(--fg)" stroke-width="3" />
<line x1="-30" y1="35" x2="-60" y2="50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(-100,70) scale(0.75)">
</g>
</g>
<line x1="0" y1="-50" x2="0" y2="-80" stroke="var(--fg)" stroke-width="3" />
<line x1="30" y1="35" x2="60" y2="50" stroke="var(--fg)" stroke-width="3" />
<line x1="0" y1="50" x2="0" y2="80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(0,120) scale(0.75)">
<polygon points="-20,-10 -40,-20 -20,-30 0,-20" stroke="var(--fg)" stroke-width="3" fill="blue" />
<polygon points="0,-20 -20,-30 0,-40 20,-30" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,0 -20,-10 0,-20 20,-10" stroke="var(--fg)" stroke-width="3" fill="blue" />
<polygon points="20,-10 0,-20 20,-30 40,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="-20,-10 -40,-20 -40,0 -20,10" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 -20,-10 -20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="-20,10 -40,0 -40,20 -20,30" stroke="var(--fg)" stroke-width="3" fill="blue" />
<polygon points="0,20 -20,10 -20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<polygon points="0,0 20,-10 20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="20,-10 40,-20 40,0 20,10" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="0,20 20,10 20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="20,10 40,0 40,20 20,30" stroke="var(--fg)" stroke-width="3" fill="orange" />
<line x1="-30" y1="-35" x2="-60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<line x1="30" y1="-35" x2="60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<line x1="30" y1="35" x2="60" y2="50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(100,70) scale(0.75)">
</g>
<line x1="0" y1="50" x2="0" y2="80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(0,120) scale(0.75)">
</g>
<line x1="-30" y1="35" x2="-60" y2="50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(-100,70) scale(0.75)">
</g>
</g>
<line x1="-30" y1="35" x2="-60" y2="50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(-100,70) scale(0.75)">
<polygon points="-20,-10 -40,-20 -20,-30 0,-20" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<polygon points="0,-20 -20,-30 0,-40 20,-30" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="0,0 -20,-10 0,-20 20,-10" stroke="var(--fg)" stroke-width="3" fill="yellow" />
<polygon points="20,-10 0,-20 20,-30 40,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
<polygon points="-20,-10 -40,-20 -40,0 -20,10" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 -20,-10 -20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="-20,10 -40,0 -40,20 -20,30" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,20 -20,10 -20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="orange" />
<polygon points="0,0 20,-10 20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="blue" />
<polygon points="20,-10 40,-20 40,0 20,10" stroke="var(--fg)" stroke-width="3" fill="green" />
<polygon points="0,20 20,10 20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="blue" />
<polygon points="20,10 40,0 40,20 20,30" stroke="var(--fg)" stroke-width="3" fill="green" />
<line x1="-30" y1="-35" x2="-60" y2="-50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(-100,-70) scale(0.75)">
</g>
<line x1="0" y1="-50" x2="0" y2="-80" stroke="var(--fg)" stroke-width="3" />
<line x1="30" y1="35" x2="60" y2="50" stroke="var(--fg)" stroke-width="3" />
<line x1="0" y1="50" x2="0" y2="80" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(0,120) scale(0.75)">
</g>
<line x1="-30" y1="35" x2="-60" y2="50" stroke="var(--fg)" stroke-width="3" />
<g transform="translate(-100,70) scale(0.75)">
</g>
</g>
</g>
</svg>

It turns out that some Rubik's cube configurations are impossible to reach starting from a solved cube.
No matter how you scramble it, you'll never be able to twist just one corner piece, for example.

<p style="text-align: center;">
<svg style="display:block; margin:auto; font-family:serif;" width="480" height="100" viewBox="-240 -50 480 100">
    <g transform="translate(-120,0)">
        <polygon points="0,0 -20,-10 -20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="orange" />
        <polygon points="-20,-10 -40,-20 -40,0 -20,10" stroke="var(--fg)" stroke-width="3" fill="orange" />
        <polygon points="0,20 -20,10 -20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="orange" />
        <polygon points="-20,10 -40,0 -40,20 -20,30" stroke="var(--fg)" stroke-width="3" fill="orange" />
        <polygon points="0,0 20,-10 20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="green" />
        <polygon points="20,-10 40,-20 40,0 20,10" stroke="var(--fg)" stroke-width="3" fill="green" />
        <polygon points="0,20 20,10 20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="green" />
        <polygon points="20,10 40,0 40,20 20,30" stroke="var(--fg)" stroke-width="3" fill="green" />
        <polygon points="0,0 -20,-10 0,-20 20,-10" stroke="var(--fg)" stroke-width="3" fill="white" />
        <polygon points="-20,-10 -40,-20 -20,-30 0,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
        <polygon points="20,-10 0,-20 20,-30 40,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
        <polygon points="0,-20 -20,-30 0,-40 20,-30" stroke="var(--fg)" stroke-width="3" fill="white" />
    </g>
    <line x1="-70" y1="0" x2="70" y2="0" stroke="var(--fg)" stroke-width="3" />
    <line x1="-15" y1="15" x2="15" y2="-15" stroke="#c82829" stroke-width="3" />
    <line x1="15" y1="15" x2="-15" y2="-15" stroke="#c82829" stroke-width="3" />
    <g transform="translate(120,0)">
        <polygon points="0,0 -20,-10 -20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="green" />
        <polygon points="-20,-10 -40,-20 -40,0 -20,10" stroke="var(--fg)" stroke-width="3" fill="orange" />
        <polygon points="0,20 -20,10 -20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="orange" />
        <polygon points="-20,10 -40,0 -40,20 -20,30" stroke="var(--fg)" stroke-width="3" fill="orange" />
        <polygon points="0,0 20,-10 20,10 0,20" stroke="var(--fg)" stroke-width="3" fill="white" />
        <polygon points="20,-10 40,-20 40,0 20,10" stroke="var(--fg)" stroke-width="3" fill="green" />
        <polygon points="0,20 20,10 20,30 0,40" stroke="var(--fg)" stroke-width="3" fill="green" />
        <polygon points="20,10 40,0 40,20 20,30" stroke="var(--fg)" stroke-width="3" fill="green" />
        <polygon points="0,0 -20,-10 0,-20 20,-10" stroke="var(--fg)" stroke-width="3" fill="orange" />
        <polygon points="-20,-10 -40,-20 -20,-30 0,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
        <polygon points="20,-10 0,-20 20,-30 40,-20" stroke="var(--fg)" stroke-width="3" fill="white" />
        <polygon points="0,-20 -20,-30 0,-40 20,-30" stroke="var(--fg)" stroke-width="3" fill="white" />
    </g>
</svg>
</p>

We can prove this by exhaustively searching the Rubik's cube graph for our impossible cube.
There are only about 3.6 million configurations, so this is perfectly tractable.
A naïve search would visit a lot of them repeatedly (infinitely often, in fact), but we can reduce that with a little [smarts](https://github.com/tavianator/spliter/blob/004ae67761ffe27923a7aeed73a5b229a3a2790a/examples/util/dfs.rs#L27-L44).
(This is not as smart as possible, because this post is supposed to be about Rayon, not Rubik's cubes.
But see [these](https://possiblywrong.wordpress.com/2011/08/28/solving-the-2x2x2-rubiks-cube/) [posts](https://possiblywrong.wordpress.com/2020/01/30/solving-the-2x2x2-rubiks-cube-revisited/) for much more smarts.)

The benchmark itself is short and sweet:

```rust,no_run,noplayground
fn main() {
    let impossible = PocketCube::impossible();
    let mut cubes = DepthFirstSearch::new(PocketCube::solved());
    assert!(cubes.all(|cube| cube != impossible));
}
```

```
$ time examples/sequential
examples/sequential  34.38s user 0.00s system 99% cpu 34.410 total
```

**34 seconds**.
Not bad, but my CPU has 24 cores/48 threads, and 47 of them sat idle.
Let's parallelize!


## A bridge too slow

Rayon's parallel iteration traits are implemented for a vast set of standard types, like [ranges](https://doc.rust-lang.org/std/ops/struct.Range.html), [slices](https://doc.rust-lang.org/std/primitive.slice.html), and [vectors](https://doc.rust-lang.org/std/vec/struct.Vec.html).
Sadly, this doesn't include the custom `Iterator` I just wrote.
However, Rayon does have a [`ParallelBridge`](https://docs.rs/rayon/latest/rayon/iter/trait.ParallelBridge.html) trait that can parallelize *any* iterator.
Let's try it:

```diff
     let mut cubes = DepthFirstSearch::new(PocketCube::solved());
-    assert!(cubes.all(|cube| cube != impossible));
+    assert!(cubes.par_bridge().all(|cube| cube != impossible));
 }
```

```
$ time examples/par_bridge
examples/par_bridge  44097.05s user 3789.41s system 4768% cpu 16:44.28 total
```

Hmm, from 34 seconds to almost **17 minutes**!
At least it's using all the cores now.

What happened?
Well, `par_bridge()` isn't magic, and it can't really parallelize my inherently sequential iterator.
What it does parallelize is the computations that happen after the iterator yields the items.
So the iterator is still spinning on a single thread, and `par_bridge()` hands its output to other threads to process.
That can be profitable if there's a lot of per-item computation, but here it's just a 24-byte equality test, and we're drowning in overhead.


## Plumbing

If we want to build a parallel iterator the right way, we'll have to dive into Rayon's internal [plumbing](https://docs.rs/rayon/latest/rayon/iter/plumbing/index.html).
There's a lot of traits and generics and stuff, but the basic principle is this: if we want to distribute a task across a bunch of threads, we need to be able to split it up.
Let's start with that:

```rust,no_run,noplayground
impl DepthFirstSearch {
    fn try_split(&mut self) -> Option<Self> {
        let len = self.stack.len();
        if len >= 2 {
            let stack = self.stack.split_off(len / 2);
            Some(Self { stack })
        } else {
            None
        }
    }
}
```

As long as we have more than two unexplored nodes in the stack, we can split it into two separate stacks and continue the search separately.
The rest of the Rayon plumbing can be implemented using this split operation.

<details>
<summary><code>UnindexedProducer</code> implementation.</summary>

```rust,no_run,noplayground
impl UnindexedProducer for DepthFirstSearch {
    type Item = <Self as Iterator>::Item;

    fn split(mut self) -> (Self, Option<Self>) {
        let split = self.try_split();
        (self, split)
    }

    fn fold_with<F>(self, folder: F) -> F
    where
        F: Folder<Self::Item>
    {
        folder.consume_iter(self)
    }
}
```

</details>

<details>
<summary><code>ParallelIterator</code> implementation.</summary>

```rust,no_run,noplayground
impl ParallelIterator for DepthFirstSearch {
    type Item = <Self as UnindexedProducer>::Item;

    fn drive_unindexed<C>(self, consumer: C) -> C::Result
    where
        C: UnindexedConsumer<Self::Item>,
    {
        bridge_unindexed(self, consumer)
    }
}
```

</details>

Let's see how fast it is:

```
$ time examples/producer
examples/producer  39.75s user 0.00s system 99% cpu 39.791 total
```

This is 25× faster than the [last benchmark](#a-bridge-too-slow).
My work here is done!
... Oh wait, it's still five seconds slower than the [sequential version](#sequential-search).
Why?
I only wrote like ten lines of code, so obviously the bug must be somewhere else :).
Let's look at the ...

<details>
<summary><code>bridge_unindexed()</code> implementation.</summary>

```rust,no_run,noplayground
pub fn bridge_unindexed<P, C>(producer: P, consumer: C) -> C::Result
where
    P: UnindexedProducer,
    C: UnindexedConsumer<P::Item>,
{
    let splitter = Splitter::new();
    bridge_unindexed_producer_consumer(false, splitter, producer, consumer)
}

fn bridge_unindexed_producer_consumer<P, C>(
    migrated: bool,
    mut splitter: Splitter,
    producer: P,
    consumer: C,
) -> C::Result
where
    P: UnindexedProducer,
    C: UnindexedConsumer<P::Item>,
{
    if consumer.full() {
        consumer.into_folder().complete()
    } else if splitter.try_split(migrated) {
        match producer.split() {
            (left_producer, Some(right_producer)) => {
                let (reducer, left_consumer, right_consumer) =
                    (consumer.to_reducer(), consumer.split_off_left(), consumer);
                let bridge = bridge_unindexed_producer_consumer;
                let (left_result, right_result) = join_context(
                    |context| bridge(context.migrated(), splitter, left_producer, left_consumer),
                    |context| bridge(context.migrated(), splitter, right_producer, right_consumer),
                );
                reducer.reduce(left_result, right_result)
            }
            (producer, None) => producer.fold_with(consumer.into_folder()).complete(),
        }
    } else {
        producer.fold_with(consumer.into_folder()).complete()
    }
}
```

([source](https://github.com/rayon-rs/rayon/blob/v1.5.1/src/iter/plumbing/mod.rs#L443-L484))

</details>

The code effectively behaves like this:

- if it's possible to split, do that
- otherwise, loop sequentially.

When we first start iterating, our stack only has one item, making it impossible to split.
Splitting only makes sense after we iterate a few times and push more nodes onto the stack.
But by then, Rayon has given up on ever splitting again.


## Spliterators

Since Rayon's plumbing doesn't seem to help, I guess I'll have to do some plumbing myself.
For starters, I'll get rid of the `UnindexedConsumer` implementation, which seemed a bit long-winded anyway.
All I really need is an iterator that can split itself:

```rust,no_run,noplayground
/// An iterator that can be split.
trait Spliterator: Iterator + Sized {
    /// Split this iterator in two, if possible.
    fn split(&mut self) -> Option<Self>;
}
```

(Isn't that a great name?
I stole it from [Java](https://docs.oracle.com/javase/8/docs/api/java/util/Spliterator.html).
Please don't sue me, Oracle.)
Now I'd like an adapter to turn my `Spliterator` into a `ParallelIterator` so I can use Rayon's fancy API.

<details>
<summary><code>ParallelIterator</code> adapter.</summary>

```rust,no_run,noplayground
/// Converts a Spliterator into a ParallelIterator.
trait ParallelSpliterator: Sized {
    /// Parallelize this.
    fn par_split(self) -> ParSpliter<Self>;
}

impl<T> ParallelSpliterator for T
where
    T: Spliterator + Send,
    T::Item: Send,
{
    fn par_split(self) -> ParSpliter<Self> {
        ParSpliter::new(self)
    }
}

/// An adapter from a Spliterator to a ParallelIterator.
struct ParSpliter<T> {
    /// The underlying Spliterator.
    iter: T,
}

impl<T: Spliterator> ParSpliter<T> {
    /// Create a new ParSpliter adapter.
    fn new(iter: T) -> Self {
        Self { iter }
    }

    /// Split the underlying iterator.
    fn split(&mut self) -> Option<Self> {
        if let Some(split) = self.iter.split() {
            Some(Self { iter: split })
        } else {
            None
        }
    }
}

impl<T> ParallelIterator for ParSpliter<T>
where
    T: Spliterator + Send,
    T::Item: Send,
{
    type Item = T::Item;

    fn drive_unindexed<C>(mut self, consumer: C) -> C::Result
    where
        C: UnindexedConsumer<Self::Item>,
    {
        self.bridge(false, consumer)
    }
}
```

</details>

I've delegated all the hard work to the `bridge()` method which I haven't written yet.
It should behave like Rayon's `bridge_unindexed()` function, except it should alternate between splitting and iterating.
Rayon provides a few lower-level ways to access its thread pool, the simplest of which is [`join()`](https://docs.rs/rayon/latest/rayon/fn.join.html).
We can use it to fork ourselves into two parallel tasks, and join the results together ([fork-join parallelism](https://en.wikipedia.org/wiki/Fork%E2%80%93join_model)).

<details>
<summary><code>ParSpliter::bridge()</code> implementation.</summary>

```rust,no_run,noplayground
impl<T: Spliterator> ParSpliter<T> {
    /// Connect this adapter to an UnindexedConsumer.
    fn bridge<C>(&mut self, consumer: C) -> C::Result
    where
        T: Send,
        C: UnindexedConsumer<T::Item>,
    {
        let mut folder = consumer.split_off_left().into_folder();

        while !folder.full() {
            // Try to split
            if let Some(mut split) = self.split() {
                let (r1, r2) = (consumer.to_reducer(), consumer.to_reducer());
                let left_consumer = consumer.split_off_left();

                let (left, right) = join(
                    || self.bridge(left_consumer),
                    || split.bridge(consumer),
                );
                return r1.reduce(folder.complete(), r2.reduce(left, right));
            }

            // Otherwise, consume an item and try again
            if let Some(next) = self.iter.next() {
                folder = folder.consume(next);
            } else {
                break;
            }
        }

        folder.complete()
    }
}
```

</details>

A little bit more code than `bridge_unindexed()`, but hopefully understandable.
Let's give it a try:

```diff
     let mut cubes = DepthFirstSearch::new(PocketCube::solved());
-    assert!(cubes.all(|cube| cube != impossible));
+    assert!(cubes.par_split().all(|cube| cube != impossible));
 }
```

```
$ time examples/spliterator
thread '<unknown>' has overflowed its stack
fatal runtime error: stack overflow
```

That doesn't seem good.
Maybe we're splitting too many times.
Rayon's implementation has a [policy](https://github.com/rayon-rs/rayon/blob/v1.5.1/src/iter/plumbing/mod.rs#L250-L289) called “thief-splitting” that stops once the thread pool is full, at least until a task is migrated to a new thread.
Let's implement something like that.

<details>
<summary>Thief-splitting patch.</summary>

```diff
 /// An adapter from a Spliterator to a ParallelIterator.
 struct ParSpliter<T> {
     /// The underlying Spliterator.
     iter: T,
+    /// The number of pieces we'd like to split into.
+    splits: usize,
 }

 impl<T: Spliterator> ParSpliter<T> {
     /// Create a new ParSpliter adapter.
     fn new(iter: T) -> Self {
-        Self { iter }
+        Self {
+            iter,
+            splits: current_num_threads(),
+        }
     }

     /// Split the underlying iterator.
-    fn split(&mut self) -> Option<Self> {
+    fn split(&mut self, stolen: bool) -> Option<Self> {
+        // Thief-splitting: start with enough splits to fill the thread pool,
+        // and reset every time a job is stolen by another thread.
+        if stolen {
+            self.splits = current_num_threads();
+        }
+
+        if self.splits == 0 {
+            return None;
+        }
+
         if let Some(split) = self.iter.split() {
+            self.splits /= 2;
-            Some(Self { iter: split })
+            Some(Self {
+                iter: split,
+                splits: self.splits,
+            })
         } else {
             None
         }
     }

     /// Connect this adapter to an UnindexedConsumer.
-    fn bridge<C>(&mut self, consumer: C) -> C::Result
+    fn bridge<C>(&mut self, stolen: bool, consumer: C) -> C::Result
     where
         T: Send,
         C: UnindexedConsumer<T::Item>,
     {
         let mut folder = consumer.split_off_left().into_folder();

         while !folder.full() {
             // Try to split
             if let Some(mut split) = self.split() {
                 let (r1, r2) = (consumer.to_reducer(), consumer.to_reducer());
                 let left_consumer = consumer.split_off_left();

-                let (left, right) = join(
+                let (left, right) = join_context(
-                    || self.bridge(left_consumer),
-                    || split.bridge(consumer),
+                    |ctx| self.bridge(ctx.migrated(), left_consumer),
+                    |ctx| split.bridge(ctx.migrated(), consumer),
                 );
                 return r1.reduce(folder.complete(), r2.reduce(left, right));
             }
```

</details>

```
$ time examples/spliterator
examples/spliterator  64.20s user 0.05s system 4737% cpu 1.356 total
```

Much better!
No more stack overflow, and the whole thing runs in **1.356 seconds**, an actual 25× improvement over the sequential baseline.

Since I want to use `Spliterator` for a project, and I figured others might as well, I published it as the [`spliter`](https://crates.io/crates/spliter) crate on [crates.io](https://crates.io).
The source is available on [GitHub](https://github.com/tavianator/spliter), and the early [commit history](https://github.com/tavianator/spliter/commits/main) follows the exposition in this post.
You can reproduce the benchmarks by running the [examples](https://github.com/tavianator/spliter/tree/main/examples):

```
$ cargo run --release --example sequential
    Finished release [optimized] target(s) in 0.00s
     Running `target/release/examples/sequential`
$ cargo run --release --example spliterator
    Finished release [optimized] target(s) in 0.00s
     Running `target/release/examples/spliterator`
```
