# `bfs` 3.0: the fastest `find` yet!

<div class="infobar">

*fa-clock-o* *time-2023-07-18*
*fa-user* Tavian Barnes
[*fa-github* GitHub](https://github.com/tavianator/bfs)

</div>

`bfs` is a tool I wrote to do **b**readth-**f**irst **s**earch through a filesystem.
It [started out](https://github.com/tavianator/bfs/commit/72552f880f3ca52c0d98d875b1da783e5a2fa2e7) simply enough, but over the years it's grown to include almost every feature from every other [`find`](https://en.wikipedia.org/wiki/Find_(Unix)) implementation I could find, plus many of its own innovations.
The new 3.0 release series includes the biggest new feature so far: asynchronous, parallel directory traversal.


## The kitchen sync

In pseudocode, the way `bfs` used to work looked like this:

```c
while (const char *path = popdir()) {
    DIR *dir = opendir(path);
    while (struct dirent *de = readdir(dir)) {
        if (visit(de)) {
            pushdir(de);
        }
    }
    closedir(dir);
}
```

Here, `visit()` is doing the filtering, printing, pruning, etc. that was written on the command line, e.g.

<pre><code>$ bfs <span style="color: highlighttext; background: highlight;">-nohidden -name '*.c' -ls</span></code></pre>

For today, we can ignore all of that and just focus on what dominates the execution time: **I/O**.
A timeline of the I/O operations that `bfs` does looks like this:

<style>
.timeline {
    display: flex;
    gap: 8px;
    overflow: auto;
    padding-bottom: 8px;
    margin-bottom: -8px;
    margin-top: 16px;
}
.timeline .block {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: var(--sidebar-fg);
    background: var(--sidebar-bg);
    border: 2px solid var(--sidebar-active);
    border-radius: 8px;
    padding: 8px;
}
.timeline.nogrow .block {
    flex-grow: unset;
}
.timeline > .block > .hljs {
    color: var(--sidebar-fg);
}
.timeline > .block > .block {
    color: black;
    background: var(--search-mark-bg);
    border: none;
}
.timeline > .block > .block > .hljs {
    color: black;
}
.timeline > .label {
    writing-mode: sideways-lr;
    text-align: center;
}
</style>
<div class="timeline">
<span class="block"><code>opendir()</code><span class="block"><code>openat()</code></span></span>
<span class="block"><code>readdir()</code><span class="block"><code>getdents()</code></span></span>
<span class="block"><code>readdir()</code></span>
<span class="block"><code>...</code></span>
<span class="block"><code>closedir()</code><span class="block"><code>close()</code></span></span>
<span class="block"><code>opendir()</code><span class="block"><code>openat()</code></span></span>
<span class="block"><code>...</code></span>
</div>

The C library functions are shown on top, and the syscalls they call are <span style="color: black; background: var(--search-mark-bg);">highlighted</span>.
These syscalls are invoked *synchronously*, meaning execution pauses and waits for them to complete before continuing.
It would be better to invoke them *asynchronously*, and do other useful work (i.e. `visit()`) while we wait for them to complete.


## I/O queues

`bfs` 3.0 introduces [I/O queues](https://github.com/tavianator/bfs/blob/3.0.1/src/ioq.h), an API which offloads these syscalls to background threads, making them appear asynchronous.
The new main loop looks more like this now:

```c
while (DIR *dir = ioq_pop()) {
    while (struct dirent *de = readdir(dir)) {
        if (visit(de)) {
            ioq_opendir(path);
        }
    }
    ioq_closedir(dir);
}
```

(The [real implementation](https://github.com/tavianator/bfs/blob/3.0.1/src/bftw.c) is somewhat more complicated, but the [main loop](https://github.com/tavianator/bfs/blob/3.0.1/src/bftw.c#L1433-L1471) is largely similar.)
The timeline now looks something like this:

<div class="timeline">
<span class="label"><code>main</code></span>
<span class="block"><code>ioq_pop()</code></span>
<span class="block"><code>readdir()</code></span>
<span class="block"><code>ioq_opendir()</code></span>
<span class="block"><code>...</code></span>
<span class="block"><code>ioq_closedir()</code></span>
<span class="block"><code>ioq_pop()</code></span>
<span class="block"><code>...</code></span>
</div>
<div class="timeline">
<span class="label"><code>ioq</code></span>
<span class="block"><code>opendir()</code><span class="block"><code>openat()</code></span></span>
<span class="block"><code>readdir()</code><span class="block"><code>getdents()</code></span></span>
<span class="block"><code>closedir()</code><span class="block"><code>close()</code></span></span>
<span class="block"><code>opendir()</code><span class="block"><code>openat()</code></span></span>
<span class="block"><code>readdir()</code><span class="block"><code>getdents()</code></span></span>
<span class="block"><code>...</code></span>
</div>

By going asynchronous, `bfs` can be more efficient because it doesn't have to stall waiting for I/O.
The main thread may occasionally block waiting on the I/O queue, but in the best case it can pop entries with just a couple atomic memory operations.
This benefit is separate from parallelism&mdash;even on a single-core machine, `bfs` can now do useful work where it previously would have been blocked on I/O.
That said, parallelism is beneficial too:

<div class="timeline">
<span class="label"><code>main</code></span>
<span class="block"><code>ioq_pop()</code></span>
<span class="block"><code>readdir()</code></span>
<span class="block"><code>ioq_opendir()</code></span>
<span class="block"><code>...</code></span>
<span class="block"><code>ioq_closedir()</code></span>
<span class="block"><code>ioq_pop()</code></span>
<span class="block"><code>...</code></span>
</div>
<div class="timeline nogrow">
<span class="label"><code>ioq</code></span>
<span class="block"><code>opendir()</code><span class="block"><code>openat()</code></span></span>
<span class="block"><code>readdir()</code><span class="block"><code>getdents()</code></span></span>
<span class="block"><code>closedir()</code><span class="block"><code>close()</code></span></span>
<span class="block"><code>...</code></span>
</div>
<div class="timeline nogrow">
<span class="label"><code>ioq</code></span>
<span class="block"><code>opendir()</code><span class="block"><code>openat()</code></span></span>
<span class="block"><code>readdir()</code><span class="block"><code>getdents()</code></span></span>
<span class="block"><code>closedir()</code><span class="block"><code>close()</code></span></span>
<span class="block"><code>...</code></span>
</div>
<div class="timeline nogrow">
<span class="label"><code>...</code></span>
</div>

`bfs` 3.0 will create up to 8 threads to process I/O queue operations, depending on how many cores you have.
It does not scale very well beyond that point, being bottlenecked on the single main thread.
You can override the default thread count choice with `-j1`, `-j2`, etc., (like `make`).


## What about io_uring?

If you've been keeping up with recent developments in async I/O (at least on Linux), you may be wondering why `bfs` doesn't use [io_uring](https://en.wikipedia.org/wiki/Io_uring).
The answer is pretty simple: io_uring doesn't support the `getdents()` syscall that underlies `readdir()`.
There is a [patchset](https://lore.kernel.org/io-uring/20230718132112.461218-1-hao.xu@linux.dev/T/) implementing it that's [on track](https://twitter.com/axboe/status/1679926006721966080) to being merged, and `bfs` has a [pull request](https://github.com/tavianator/bfs/pull/106) ready to take advantage of it.

Interestingly, just using a single io_uring instance was not competitive with `bfs`'s I/O queues in my benchmarks.
My current best implementation uses one io_uring per thread, and uses the same I/O queue implementation to send commands back and forth with the main thread.
Of course, performance may be different once `IORING_OP_GETDENTS` is integrated into the kernel.


## So how fast is it?

The point of the [~5,000 lines of code](https://github.com/tavianator/bfs/compare/2.6.3...3.0.1) it took to implement I/O queues was to improve performance.
To measure that benefit, I used a combination of [hyperfine](https://github.com/sharkdp/hyperfine) and my new benchmark harness [tailfin](https://github.com/tavianator/tailfin).
The results speak for themselves.

For exploring my entire home directory (~7.6 million files), the new `bfs` is 2.2&times; faster than the previous release series, and almost 3&times; faster than GNU find.
Surprisingly, [`fd`](https://github.com/sharkdp/fd) was the slowest in this benchmark.

<style>
pre.results > code {
    color: #d0d0d0;
    background: #0f0f0f;
}
pre.results .red {
    color: #de68af;
}
pre.results .green {
    color: #4dde9b;
}
pre.results .magenta {
    color: #c561de;
}
pre.results .cyan {
    color: #4dbcde;
}
</style>
<pre class="results"><code>Benchmark 1: fd -u '^$' ~
  Time (<span class="green">mean</span> ± <span class="green">σ</span>):      <span class="green">8.209 s</span> ±  <span class="green">0.023 s</span>    [User: 31.908 s, System: 339.069 s]
  Range (<span class="cyan">min</span> … <span class="magenta">max</span>):    <span class="cyan">8.170 s</span> …  <span class="magenta">8.250 s</span>    16 runs

Benchmark 2: find ~ -false
  Time (<span class="green">mean</span> ± <span class="green">σ</span>):      <span class="green">7.021 s</span> ±  <span class="green">0.045 s</span>    [User: 1.138 s, System: 5.783 s]
  Range (<span class="cyan">min</span> … <span class="magenta">max</span>):    <span class="cyan">6.968 s</span> …  <span class="magenta">7.103 s</span>    16 runs

Benchmark 3: bfs-2.6.3 ~ -false
  Time (<span class="green">mean</span> ± <span class="green">σ</span>):      <span class="green">5.307 s</span> ±  <span class="green">0.030 s</span>    [User: 0.779 s, System: 4.355 s]
  Range (<span class="cyan">min</span> … <span class="magenta">max</span>):    <span class="cyan">5.268 s</span> …  <span class="magenta">5.395 s</span>    16 runs

Benchmark 4: bfs-3.0.1 ~ -false
  Time (<span class="green">mean</span> ± <span class="green">σ</span>):      <span class="green">2.416 s</span> ±  <span class="green">0.023 s</span>    [User: 2.823 s, System: 11.547 s]
  Range (<span class="cyan">min</span> … <span class="magenta">max</span>):    <span class="cyan">2.369 s</span> …  <span class="magenta">2.454 s</span>    16 runs

Summary
  <span class="cyan">bfs-3.0.1 ~ -false</span> ran
    <span class="green">2.20</span> ± <span class="green">0.02</span> times faster than <span class="magenta">bfs-2.6.3 ~ -false</span>
    <span class="green">2.91</span> ± <span class="green">0.03</span> times faster than <span class="magenta">find ~ -false</span>
    <span class="green">3.40</span> ± <span class="green">0.03</span> times faster than <span class="magenta">fd -u '^$' ~</span></code></pre>

I used the expression `-false` for these benchmarks so that `visit()` does the absolute minimum amount of work possible, and the benchmark focuses on just directory traversal.
Similarly, for `fd` I used the regex `^$` which never matches a filename.


## Why breadth-first?

A big motivation for `bfs` is that in my experience, if you're looking for a particular file, breadth-first search usually finds it earlier than depth-first.
That's because most *interesting* files tend to be close to the root (e.g. `~/Downloads/pay_slip.pdf`), while most *files* tend to be deeper in the tree.
(And if you're looking for a deep file, you'll probably have to search a large portion of the tree anyway.)
This makes it great for interactive use with things like [fzf](https://github.com/junegunn/fzf).

I measured its advantage for this use case using a command line that quits as soon as a match is found.
My whole home directory contains only one file with this name, at depth 3.

<pre class="results"><code>Benchmark 1: fd -usg1 kd-forest.mkv ~
  Time (<span class="green">mean</span> ± <span class="green">σ</span>):      <span class="green">2.783 s</span> ±  <span class="green">1.761 s</span>    [User: 10.441 s, System: 113.302 s]
  Range (<span class="cyan">min</span> … <span class="magenta">max</span>):    <span class="cyan">0.847 s</span> …  <span class="magenta">5.316 s</span>    10 runs

Benchmark 2: find ~ -name kd-forest.mkv -quit
  Time (<span class="green">mean</span> ± <span class="green">σ</span>):      <span class="green">4.786 s</span> ±  <span class="green">0.023 s</span>    [User: 1.476 s, System: 3.245 s]
  Range (<span class="cyan">min</span> … <span class="magenta">max</span>):    <span class="cyan">4.757 s</span> …  <span class="magenta">4.829 s</span>    10 runs

Benchmark 3: bfs-2.6.3 ~ -name kd-forest.mkv -quit
  Time (<span class="green">mean</span> ± <span class="green">σ</span>):      <span class="green">15.9 ms</span> ±   <span class="green">1.1 ms</span>    [User: 6.9 ms, System: 8.8 ms]
  Range (<span class="cyan">min</span> … <span class="magenta">max</span>):     <span class="cyan">6.7 ms</span> …  <span class="magenta">24.4 ms</span>    168 runs

Benchmark 4: bfs-3.0.1 ~ -name kd-forest.mkv -quit
  Time (<span class="green">mean</span> ± <span class="green">σ</span>):      <span class="green">11.2 ms</span> ±   <span class="green">1.1 ms</span>    [User: 5.2 ms, System: 37.4 ms]
  Range (<span class="cyan">min</span> … <span class="magenta">max</span>):     <span class="cyan">6.0 ms</span> …  <span class="magenta">14.8 ms</span>    219 runs

Summary
  <span class="cyan">bfs-3.0.1 ~ -name kd-forest.mkv -quit</span> ran
    <span class="green">1.42</span> ± <span class="green">0.17</span>   times faster than <span class="magenta">bfs-2.6.3 ~ -name kd-forest.mkv -quit</span>
  <span class="green">248.68</span> ± <span class="green">159.28</span> times faster than <span class="magenta">fd -usg1 kd-forest.mkv ~</span>
  <span class="green">427.64</span> ± <span class="green">42.68</span>  times faster than <span class="magenta">find ~ -name kd-forest.mkv -quit</span></code></pre>

This is the main use case I care about (basically recursive tab completion), and `bfs` is 430&times; faster than GNU find.
