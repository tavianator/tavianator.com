# `bfs` from the ground  up, part 1: traversal

<div class="infobar">

*fa-clock-o* *time-2016-09-10*
*fa-user* Tavian Barnes
[*fa-github* GitHub](https://github.com/tavianator/bfs)
[Part 2 *fa-chevron-circle-right*](../2017/bfs_2.md)

</div>


[`bfs`] is a tool I've been writing for about a year, with the goal of being a drop-in replacement for the UNIX `find` command.
This series of posts will be deep technical explorations of its implementation, starting from the lower levels all the way up to the user interface.
`bfs` is small (only about 3,500 lines of C code), which makes it possible to do a fairly complete analysis.
But the codebase is fairly clean and highly optimized, which should make the analysis interesting.

[`bfs`]: ../projects/bfs.md

The most important feature of `bfs`, from which it gets its name, is that it operates [breadth-first], rather than [depth-first].
This means if you have a directory structure like

[breadth-first]: https://en.wikipedia.org/wiki/Breadth-first_search
[depth-first]: https://en.wikipedia.org/wiki/Depth-first_search

```
./linux/{the entire Linux kernel source tree}
./target
```

there's a good chance `find` gets bogged down looking through the Linux kernel sources before it finds the file you're looking for, `target`.
`bfs`, on the other hand, will return it either first or second.

The actual file traversal is implemented by a function called [`bftw()`], which is similar to the POSIX [`nftw()`] function.
It walks a directory tree in breadth-first order, invoking the callback `fn` for each file it encounters.

[`bftw()`]: /cgit/bfs.git/tree/bftw.h?id=94a804972d9e2099bb38461161e82277e5ab1747#n127
[`nftw()`]: https://pubs.opengroup.org/onlinepubs/9799919799/functions/nftw.html

```c
/**
 * Breadth First Tree Walk (or Better File Tree Walk).
 *
 * Like ftw(3) and nftw(3), this function walks a directory tree recursively,
 * and invokes a callback for each path it encounters.  However, bftw() operates
 * breadth-first.
 *
 * @param path
 *         The starting path.
 * @param fn
 *         The callback to invoke.
 * @param nopenfd
 *         The maximum number of file descriptors to keep open.
 * @param flags
 *         Flags that control bftw() behavior.
 * @param ptr
 *         A generic pointer which is passed to fn().
 * @return
 *         0 on success, or -1 on failure.
 */
int bftw(const char *path, bftw_fn *fn, int nopenfd, enum bftw_flags flags, void *ptr);
```

At this point, it might help to open up `bftw.c` and follow along.

[`bftw.c`]: /cgit/bfs.git/tree/bftw.c?id=94a804972d9e2099bb38461161e82277e5ab1747


## The queue

Like most breadth-first search implementations, `bftw()` uses a FIFO queue to keep track of the nodes it has yet to visit.
This is the primary downside of breadth-first search—this queue can take up significantly more memory than the stack used in depth-first search.
As a result, `bfs` uses more memory than `find` for large directory hierarchies, but not an unreasonable amount in practice.

[`struct dirqueue`] is implemented as a circular buffer backed by an array:

[`struct dirqueue`]: /cgit/bfs.git/tree/bftw.c?id=94a804972d9e2099bb38461161e82277e5ab1747#n387.

```c
/**
 * A queue of 'dircache_entry's to examine.
 */
struct dirqueue {
	/** The circular buffer of entries. */
	struct dircache_entry **entries;
	/** Bitmask for circular buffer indices; one less than the capacity. */
	size_t mask;
	/** The index of the front of the queue. */
	size_t front;
	/** The index of the back of the queue. */
	size_t back;
};
```

`front` and `back` are the read and write indices, respectively.
Whenever one reaches the end, it wraps around to the beginning.
The size of the queue is always a power of two, so the wrapping is implemented by a bitwise AND with `mask`.

<p style="text-align: center;">
    <svg xmlns="http://www.w3.org/2000/svg" width="650" height="80">
        <text x="50" y="30" text-anchor="end" fill="var(--fg)" dominant-baseline="middle">entries</text>
        <rect x="55" y="5" width="50" height="50" stroke="var(--fg)" stroke-width="2" fill="green" />
        <rect x="105" y="5" width="50" height="50" stroke="var(--fg)" stroke-width="2" fill="green" />
        <rect x="155" y="5" width="50" height="50" stroke="var(--fg)" stroke-width="2" fill="none" />
        <rect x="205" y="5" width="50" height="50" stroke="var(--fg)" stroke-width="2" fill="none" />
        <rect x="255" y="5" width="50" height="50" stroke="var(--fg)" stroke-width="2" fill="none" />
        <rect x="305" y="5" width="50" height="50" stroke="var(--fg)" stroke-width="2" fill="green" />
        <rect x="355" y="5" width="50" height="50" stroke="var(--fg)" stroke-width="2" fill="green" />
        <rect x="405" y="5" width="50" height="50" stroke="var(--fg)" stroke-width="2" fill="green" />
        <text x="155" y="60" fill="var(--fg)" dominant-baseline="hanging">back</text>
        <text x="305" y="60" fill="var(--fg)" dominant-baseline="hanging">front</text>
        <text x="460" y="30" fill="var(--fg)" dominant-baseline="middle">mask = 7 (capacity = 8)</text>
    </svg>
</p>

[Popping](/cgit/bfs.git/tree/bftw.c?id=94a804972d9e2099bb38461161e82277e5ab1747#n447) is easy:

```c

/** Remove an entry from the dirqueue. */
static struct dircache_entry *dirqueue_pop(struct dirqueue *queue) {
	if (queue->front == queue->back) {
		return NULL;
	}

	struct dircache_entry *entry = queue->entries[queue->front];
	queue->front += 1;
	queue->front &= queue->mask;
	return entry;
}
```

[Pushing](/cgit/bfs.git/tree/bftw.c?id=94a804972d9e2099bb38461161e82277e5ab1747#n415) is straightforward too, a little more complicated only in the case that it has to grow the array..

Using this queue implementation, `bftw()`'s implementation might look something like this (in pseudocode):

```c

int bftw(const char *path, bftw_fn *fn, int nopenfd, enum bftw_flags flags, void *ptr) {
	struct dirqueue queue;
	struct dircache cache;
	struct dircache_entry *entry = dircache_add(&cache, path);

	fn(path);

	do {
		DIR *dir = opendir(entry);
		for (child in readdir(dir)) {
			path = entry->path + "/" + child;
			fn(path);
			if (isdir(path)) {
				dirqueue_push(&queue, dircache_add(&cache, path));
			}
		}
		closedir(dir);

		entry = dirqueue_pop(&queue);
	} while (entry);

	return 0;
}
```


## The cache

What's the point of the `dircache` type, and the `dircache_entry` type used to represent directories?
The goal is to avoid re-traversing path components that we don't have to.
When a system call like [`open("a/b/c")`] is made, the kernel has to resolve `a`, then `a/b`, and finally `a/b/c`, potentially following links and/or mount points for each component.
Modern Unices provide a set of syscalls ending in `at()` that allow applications to avoid redundant traversals if they keep a file descriptor to the relevant directory open.
For example, if `int fd` is an open file descriptor to `a/b`, `openat(fd, "c")` is equivalent to `open("a/b/c")`, without having to re-resolve `a/b`.

[`open("a/b/c")`]: https://pubs.opengroup.org/onlinepubs/9799919799/functions/open.html

The `dircache` is primarily used to hold these open file descriptors so that future directories can be opened efficiently with `openat()`.
[`struct dircache_entry`] looks like this:

[`struct dircache_entry`]: /cgit/bfs.git/tree/bftw.c?id=94a804972d9e2099bb38461161e82277e5ab1747#n38

```c
/**
 * A single entry in the dircache.
 */
struct dircache_entry {
	/** The parent entry, if any. */
	struct dircache_entry *parent;
	/** This directory's depth in the walk. */
	size_t depth;

	/** Reference count. */
	size_t refcount;
	/** Index in the priority queue. */
	size_t heap_index;

	/** An open file descriptor to this directory, or -1. */
	int fd;

	/** The device number, for cycle detection. */
	dev_t dev;
	/** The inode number, for cycle detection. */
	ino_t ino;

	/** The offset of this directory in the full path. */
	size_t nameoff;
	/** The length of the directory's name. */
	size_t namelen;
	/** The directory's name. */
	char name[];
};
```

Each entry holds some information about the directory it refers to, such as its depth, inode number, and of course, its name.
The names are stored inline with the entries using a C99 [flexible array member].
To avoid the wasted space of storing `"a"`, `"a/b"`, and `"a/b/c"`, only the name itself (`"c"`) is stored.
Thus to reconstruct the path, you have to follow the chain of parents to the root:

[flexible array member]: https://en.cppreference.com/w/c/language/struct#Explanation

```c
/**
 * Get the full path to a dircache_entry.
 *
 * @param entry
 *         The entry to look up.
 * @param[out] path
 *         Will hold the full path to the entry, with a trailing '/'.
 */
static int dircache_entry_path(const struct dircache_entry *entry, char **path) {
	size_t namelen = entry->namelen;
	size_t pathlen = entry->nameoff + namelen;

	if (dstresize(path, pathlen) != 0) {
		return -1;
	}

	// Build the path backwards
	do {
		char *segment = *path + entry->nameoff;
		namelen = entry->namelen;
		memcpy(segment, entry->name, namelen);
		entry = entry->parent;
	} while (entry);

	return 0;
}
```

([`dstresize()`] is part of a simple dynamic string implementation `bfs` uses.)
The entries effectively form a tree of unexplored directories and their ancestors.

[`dstresize()`]: /cgit/bfs.git/tree/dstring.c?id=94a804972d9e2099bb38461161e82277e5ab1747#n66

<p style="text-align: center;">
    <svg xmlns="http://www.w3.org/2000/svg" width="510" height="560" viewBox="95 0 510 560">
        <rect x="250" y="5" width="200" height="120" fill="none" stroke="var(--fg)" stroke-width="2" />
        <text fill="var(--fg)" x="255" y="20">parent: NULL</text>
        <line x1="250" y1="25" x2="450" y2="25" stroke="var(--fg)" stroke-width="1" />
        <text fill="var(--fg)" x="255" y="40">depth: 0</text>
        <line x1="250" y1="45" x2="450" y2="45" stroke="var(--fg)" stroke-width="1" />
        <text fill="var(--fg)" x="255" y="60">refcount: 3</text>
        <line x1="250" y1="65" x2="450" y2="65" stroke="var(--fg)" stroke-width="1" />
        <text fill="var(--fg)" x="255" y="80">nameoff: 0</text>
        <line x1="250" y1="85" x2="450" y2="85" stroke="var(--fg)" stroke-width="1" />
        <text fill="var(--fg)" x="255" y="100">namelen: 2</text>
        <line x1="250" y1="105" x2="450" y2="105" stroke="var(--fg)" stroke-width="1" />
        <text fill="var(--fg)" x="255" y="120">name: "a/"</text>
        <rect x="100" y="175" width="200" height="120" fill="none" stroke="var(--fg)" stroke-width="2" />
        <line x1="200" y1="175" x2="300" y2="125" stroke="var(--fg)" stroke-width="1" />
        <text fill="var(--fg)" x="105" y="190">parent:</text>
        <line x1="100" y1="195" x2="300" y2="195" stroke="var(--fg)" stroke-width="1" />
        <text fill="var(--fg)" x="105" y="210">depth: 1</text>
        <line x1="100" y1="215" x2="300" y2="215" stroke="var(--fg)" stroke-width="1" />
        <text fill="var(--fg)" x="105" y="230">refcount: 1</text>
        <line x1="100" y1="235" x2="300" y2="235" stroke="var(--fg)" stroke-width="1" />
        <text fill="var(--fg)" x="105" y="250">nameoff: 2</text>
        <line x1="100" y1="255" x2="300" y2="255" stroke="var(--fg)" stroke-width="1" />
        <text fill="var(--fg)" x="105" y="270">namelen: 2</text>
        <line x1="100" y1="275" x2="300" y2="275" stroke="var(--fg)" stroke-width="1" />
        <text fill="var(--fg)" x="105" y="290">name: "b/"</text>
        <rect x="400" y="175" width="200" height="120" fill="none" stroke="var(--fg)" stroke-width="2" />
        <line x1="500" y1="175" x2="400" y2="125" stroke="var(--fg)" stroke-width="1" />
        <text fill="var(--fg)" x="405" y="190">parent:</text>
        <line x1="400" y1="195" x2="600" y2="195" stroke="var(--fg)" stroke-width="1" />
        <text fill="var(--fg)" x="405" y="210">depth: 1</text>
        <line x1="400" y1="215" x2="600" y2="215" stroke="var(--fg)" stroke-width="1" />
        <text fill="var(--fg)" x="405" y="230">refcount: 1</text>
        <line x1="400" y1="235" x2="600" y2="235" stroke="var(--fg)" stroke-width="1" />
        <text fill="var(--fg)" x="405" y="250">nameoff: 2</text>
        <line x1="400" y1="255" x2="600" y2="255" stroke="var(--fg)" stroke-width="1" />
        <text fill="var(--fg)" x="405" y="270">namelen: 2</text>
        <line x1="400" y1="275" x2="600" y2="275" stroke="var(--fg)" stroke-width="1" />
        <text fill="var(--fg)" x="405" y="290">name: "d/"</text>
        <rect x="100" y="345" width="200" height="120" fill="none" stroke="var(--fg)" stroke-width="2" />
        <line x1="200" y1="345" x2="200" y2="295" stroke="var(--fg)" stroke-width="1" />
        <text fill="var(--fg)" x="105" y="360">parent:</text>
        <line x1="100" y1="365" x2="300" y2="365" stroke="var(--fg)" stroke-width="1" />
        <text fill="var(--fg)" x="105" y="380">depth: 2</text>
        <line x1="100" y1="385" x2="300" y2="385" stroke="var(--fg)" stroke-width="1" />
        <text fill="var(--fg)" x="105" y="400">refcount: 1</text>
        <line x1="100" y1="405" x2="300" y2="405" stroke="var(--fg)" stroke-width="1" />
        <text fill="var(--fg)" x="105" y="420">nameoff: 4</text>
        <line x1="100" y1="425" x2="300" y2="425" stroke="var(--fg)" stroke-width="1" />
        <text fill="var(--fg)" x="105" y="440">namelen: 2</text>
        <line x1="100" y1="445" x2="300" y2="445" stroke="var(--fg)" stroke-width="1" />
        <text fill="var(--fg)" x="105" y="460">name: "c/"</text>
        <text fill="var(--fg)" x="245" y="530" text-anchor="end" dominant-baseline="middle">queue:</text>
        <rect x="250" y="505" width="50" height="50" stroke="var(--fg)" stroke-width="2" fill="none" />
        <rect x="300" y="505" width="50" height="50" stroke="var(--fg)" stroke-width="2" fill="none" />
        <rect x="350" y="505" width="50" height="50" stroke="var(--fg)" stroke-width="2" fill="green" />
        <rect x="400" y="505" width="50" height="50" stroke="var(--fg)" stroke-width="2" fill="green" />
        <line x1="375" y1="505" x2="400" y2="296" stroke="var(--fg)" stroke-width="1" />
        <line x1="425" y1="505" x2="300" y2="465" stroke="var(--fg)" stroke-width="1" />
    </svg>
</p>

Since the number of file descriptors an application may have open at any given time is [limited], not every entry can have an open file descriptor.
`struct dircache` holds a size-limited priority queue of open entries.
As a heuristic, the entries with the highest reference counts are kept open, because those have the greatest number of unexplored descendants.

[limited]: https://pubs.opengroup.org/onlinepubs/9799919799/functions/getrlimit.html

```c
/**
 * A directory cache.
 */
struct dircache {
	/** A min-heap of open entries, ordered by refcount. */
	struct dircache_entry **heap;
	/** Current heap size. */
	size_t size;
	/** Maximum heap size. */
	size_t capacity;
};
```

The priority queue implementation is an [array-backed binary heap].
[Incrementing]/[decrementing] a reference count results in a bubble-[down]/[up] operation, which use the entry's heap_index field to locate the entry in the middle of the heap.

[array-backed binary heap]: https://en.wikipedia.org/wiki/Binary_heap#Heap_implementation
[Incrementing]: /cgit/bfs.git/tree/bftw.c?id=94a804972d9e2099bb38461161e82277e5ab1747#n150
[decrementing]: /cgit/bfs.git/tree/bftw.c?id=94a804972d9e2099bb38461161e82277e5ab1747#n159
[down]: /cgit/bfs.git/tree/bftw.c?id=94a804972d9e2099bb38461161e82277e5ab1747#n122
[up]: /cgit/bfs.git/tree/bftw.c?id=94a804972d9e2099bb38461161e82277e5ab1747#n104


## Reading directories

`bftw()` uses the standard `DIR *` type and [`readdir()`] function to read the contents of directories.
But since there's no standard `opendirat()` function, the [`dircache_entry_open()`] function emulates it with `open()` followed by [`fdopendir()`].
Some [extra logic] handles `EMFILE` (too many open files) by shrinking the cache and retrying.
Since `DIR` takes up quite a bit of memory, it's closed as soon as possible, hanging onto the file descriptor only with [`dup()`] (actually `F_DUPFD_CLOEXEC`).

[`readdir()`]: https://pubs.opengroup.org/onlinepubs/9799919799/functions/readdir.html
[`dircache_entry_open()`]: /cgit/bfs.git/tree/bftw.c?id=94a804972d9e2099bb38461161e82277e5ab1747#n317a
[`fdopendir()`]: https://pubs.opengroup.org/onlinepubs/9799919799/functions/fdopendir.html
[extra logic]: /cgit/bfs.git/tree/bftw.h?id=94a804972d9e2099bb38461161e82277e5ab1747#n293
[`dup()`]: https://pubs.opengroup.org/onlinepubs/9799919799/functions/dup.html

For each directory entry we read, we need to know its type (file, directory, symbolic link, etc.), to tell if we need to descend into it, and to pass to the callback function.
Normally one would use `stat()` to determine this, but `stat()`ing each file we encounter is slow, due to extra I/O and syscalls.
Luckily, many Unices provide this information as an extension in their `struct dirent`, in the `d_type` field.
When available, `bftw()` [uses] this information to avoid a `stat()` call entirely.
The effect is noticeable:

[`stat()`]: https://pubs.opengroup.org/onlinepubs/9799919799/functions/fstatat.html
[uses]: /cgit/bfs.git/tree/bftw.c?id=94a804972d9e2099bb38461161e82277e5ab1747#n465

<pre style="padding: 0.5em; background: black; color: lightgray;">
<strong style="color: white;">$</strong> strace bfs 2>&amp;1 >/dev/null | grep stat | wc -l
34349
<strong style="color: white;">$</strong> strace find 2>&amp;1 >/dev/null | grep stat | wc -l
100714
</pre>

Almost all the remaining `stat()` calls in `bfs` are actually from within glibc's `fdopendir()` [implementation]; these could be avoided if glibc checked the `fcntl(fd, F_GETFL)` result for `O_DIRECTORY` first.

[implementation]: https://sourceware.org/git/?p=glibc.git;a=blob;f=sysdeps/posix/fdopendir.c;h=227174ec541e87710ee8ffc36c4b7652655d29a7;hb=HEAD#l32


## Post-order

One interesting feature that `find` has is the ability to do a [post-order traversal], where a directory's descendants are processed before the directory itself.
Confusingly, this is triggered by the `-depth` option.
Mostly this gets used as part of the `-delete` action, since a directory can't be deleted until all of its children are first.

[post-order traversal]: https://en.wikipedia.org/wiki/Tree_traversal#Post-order

Breadth-first search doesn't have a straightforward analogue of post-order traversal, but we can use `struct dircache_entry`'s reference counts to implement something good enough for `-delete`: whenever an entry's reference count drops to zero, we know it has no descendants left to process and we can invoke the callback again.
Passing the `BFTW_DEPTH` flag (which keeps the confusing name for symmetry with `nftw()`'s matching `FTW_DEPTH` flag) causes `bftw()` to [invoke the callback again] right before freeing an entry.
The resulting order is a little weird—files are listed immediately, while directories are listed after their contents—but it works!

[invoke the callback again]: /cgit/bfs.git/tree/bftw.c?id=94a804972d9e2099bb38461161e82277e5ab1747#n822

<pre style="padding: 0.5em; background: black; color: lightgray;">
<strong style="color: white;">$</strong> bfs dir -depth
<strong style="color: #5454ff;">dir/</strong>file
<strong style="color: #5454ff;">dir/dir/</strong>file
<strong style="color: #5454ff;">dir/dir/dir/</strong>file
<strong style="color: #5454ff;">dir/dir/dir</strong>
<strong style="color: #5454ff;">dir/dir</strong>
<strong style="color: #5454ff;">dir</strong>
</pre>


## Putting it all together

The remainder of the code is pretty much glue and plumbing to implement the desired interface and handle errors.
`bftw()`'s real implementation is factored into a few subroutines that deal with `struct bftw_state`:

```c
/**
 * Holds the current state of the bftw() traversal.
 */
struct bftw_state {
	/** bftw() callback. */
	bftw_fn *fn;
	/** bftw() flags. */
	int flags;
	/** bftw() callback data. */
	void *ptr;

	/** The appropriate errno value, if any. */
	int error;

	/** The cache of open directories. */
	struct dircache cache;
	/** The queue of directories left to explore. */
	struct dirqueue queue;
	/** The current dircache entry. */
	struct dircache_entry *current;
	/** The current traversal status. */
	enum bftw_status status;

	/** The current path being explored. */
	char *path;

	/** Extra data about the current file. */
	struct BFTW ftwbuf;
	/** stat() buffer for the current file. */
	struct stat statbuf;
};
```

`bftw()` provides the callback with a lot of details about the current path in a buffer of type [`struct BFTW`](/cgit/bfs.git/tree/bftw.h?id=94a804972d9e2099bb38461161e82277e5ab1747#n52):

```c
/**
 * Data about the current file for the bftw() callback.
 */
struct BFTW {
	/** The path to the file. */
	const char *path;
	/** The string offset of the filename. */
	size_t nameoff;

	/** The depth of this file in the traversal. */
	size_t depth;
	/** Which visit this is. */
	enum bftw_visit visit;

	/** The file type. */
	enum bftw_typeflag typeflag;
	/** The errno that occurred, if typeflag == BFTW_ERROR. */
	int error;

	/** A stat() buffer; may be NULL if no stat() call was needed. */
	const struct stat *statbuf;

	/** A parent file descriptor for the *at() family of calls. */
	int at_fd;
	/** The path relative to atfd for the *at() family of calls. */
	const char *at_path;
	/** Appropriate flags (like AT_SYMLINK_NOFOLLOW) for the *at() family of calls. */
	int at_flags;
};
```

The [`bftw_init_buffers()`] function is responsible for filling in this information for the callback.
Invocations of the callback are done by the [`bftw_handle_path()`] function.
The callback can control the traversal by returning different [`enum bftw_action values`]:

[`bftw_init_buffers()`]: /cgit/bfs.git/tree/bftw.c?id=94a804972d9e2099bb38461161e82277e5ab1747#n660
[`bftw_handle_path()`]: /cgit/bfs.git/tree/bftw.c?id=94a804972d9e2099bb38461161e82277e5ab1747#n738
[`enum bftw_action values`]: /cgit/bfs.git/tree/bftw.h?id=94a804972d9e2099bb38461161e82277e5ab1747#n82

```c
enum bftw_action {
	/** Keep walking. */
	BFTW_CONTINUE,
	/** Skip this path's siblings. */
	BFTW_SKIP_SIBLINGS,
	/** Skip this path's children. */
	BFTW_SKIP_SUBTREE,
	/** Stop walking. */
	BFTW_STOP,
};
```

so every `bftw_handle_path()` call is followed by a [`switch`] that does the appropriate thing for the action, often with a `goto`.

[`switch`]: /cgit/bfs.git/tree/bftw.c?id=94a804972d9e2099bb38461161e82277e5ab1747#n949


## Performance

`bftw()`'s tuned implementation allows `bfs` to be very fast.
Over my home directory (1,937,127 files, 267,981 directories), it's about 15–25% faster than [GNU find] 4.6.0 with warm caches:

[GNU find]: https://www.gnu.org/software/findutils/

<pre style="padding: 0.5em; background: black; color: lightgray;">
<strong style="color: white;">$</strong> time bfs &gt; /dev/null
bfs &gt; /dev/null  0.60s user 2.48s system 99% cpu 3.096 total
<strong style="color: white;">$</strong> time find &gt; /dev/null
find &gt; /dev/null  1.08s user 2.96s system 99% cpu 4.062 total
</pre>

On the other hand, with cold caches and rotational disks, it's about 100% slower for me, because the breadth-first ordering makes it jump around a lot more.

<pre style="padding: 0.5em; background: black; color: lightgray;">
<strong style="color: white;">$</strong> echo 3 | sudo tee /proc/sys/vm/drop_caches
3
<strong style="color: white;">$</strong> time bfs &gt; /dev/null
bfs &gt; /dev/null  1.54s user 11.04s system 8% cpu 2:29.57 total
<strong style="color: white;">$</strong> echo 3 | sudo tee /proc/sys/vm/drop_caches
3
<strong style="color: white;">$</strong> time find &gt; /dev/null
find &gt; /dev/null  2.52s user 12.12s system 14% cpu 1:44.54 total
</pre>

On the plus side, since breadth-first search is likely to find what I'm looking for before depth-first search does, I can often `^C` it faster even if a complete traversal would be slower.
