# OOMify

<div class="infobar">

*fa-clock-o* *time-2020-09-07*
*fa-user* Tavian Barnes
[*fa-github* GitHub](https://github.com/tavianator/oomify)

</div>


Memory allocation failures are notoriously hard to handle correctly.
Since they're generally rare, and non-deterministic when they do happen, C code paths that handle `malloc()` returning `NULL` are typically under-tested and thus frequently buggy.
Compounding the issue is the [bad advice] found often online that since Linux will overcommit by default, checking `malloc()` for `NULL` is useless.
Not only can `malloc()` sometimes return `NULL` even with the default overcommit setting anyway, that's not the only configuration that your code may run in.
It's perfectly fine for your program to explicitly `abort()` if `malloc()` fails, but library code should more carefully propagate these errors to allow people to write more resilient applications.
In writing [`bfs`], I've tried to properly check for and handle all allocation failures, mainly to prove to myself that it's possible.

[bad advice]: https://news.ycombinator.com/item?id=10923987
[`bfs`]: ../projects/bfs.md

Recently while staring at the code of `bfs`, I noticed a bug in an error handling path.
While parsing the group table, if a memory allocation failed at exactly the wrong spot, a `struct group` would be left in an inconsistent state: some fields would be newly allocated, while others would be copied from the original `struct`.
The error path assumed every field was our own allocation, and so tried to free them all.
But some of those pointers weren't ours to free, and the invalid `free()` would lead to a crash.

The [fix] was pretty simple: moving the initialization to `NULL` of the `gr_mem` field up above any allocations, so that the error paths always see `NULL` instead of the pointer they shouldn't be freeing.
Confirming the fix took more effort, since the bug is basically impossible to reproduce.
And since error paths like this are notoriously hard to test, I was worried there were more bugs like this lurking elsewhere.
So, I made a tool to help me find them.

[fix]: https://github.com/tavianator/bfs/commit/72cfcb1fa636017611ce0aeddbe2970003a01cfa


## Injecting faults

In order to test code paths that handle `malloc()` failure, I built a library that overrides `malloc()` and friends
in order to deterministically inject failures.
The implementation is fairly simple: it maintains a count of the number of allocations that have happened so far, and if that count reaches a particular value, it returns `NULL` instead of delegating to the real `malloc()` implementation.
Since it simulates an Out Of Memory (OOM) condition, I've called it OOMify.

```c
static bool should_inject(void) {
        size_t n = __atomic_fetch_add(&stats.total, 1, __ATOMIC_SEQ_CST);

        if (n == ctl.inject_at) {
                if (ctl.stop) {
                        raise(SIGSTOP);
                }
                return true;
        } else if (ctl.inject_after && n >= ctl.inject_at) {
                return true;
        } else {
                return false;
        }
}

void *malloc(size_t size) {
        __atomic_fetch_add(&stats.malloc, 1, __ATOMIC_RELAXED);

        if (should_inject()) {
                errno = ENOMEM;
                return NULL;
        } else {
                return __libc_malloc(size);
        }
}
```

The above implementation is specific to glibc, and therefore mainly useful on Linux, but it could be easily adjusted to support more platforms.
This code is compiled into a library `liboomify.so`.
A separate `oomify` program uses `LD_PRELOAD` to inject this library into another program which it spawns, communicating with `liboomify` via pipes.

By default, `oomify` first runs the given program once without injecting any failures, to count the number of allocations it normally performs.
Then it runs the program again that many times, making each of those allocations fail separately.
As such, it works best for quick, derterministic, single-threaded programs.


## Finding bugs

Running `oomify` on an unpatched `bfs` finds the bug that motivated its existence, which is good.

```
$ oomify bfs >/dev/null
oomify: bfs did 2311 allocations
malloc(): Cannot allocate memory
malloc(): Cannot allocate memory
cfdup(): Cannot allocate memory
cfdup(): Cannot allocate memory
cannot allocate memory for thread-local data: ABORT
Assertion 's' failed at src/shared/json.c:1760, function json_variant_format(). Aborting.
oomify: alloc 1285: bfs terminated with signal 6 (Aborted)
Assertion 's' failed at src/shared/json.c:1760, function json_variant_format(). Aborting.
oomify: alloc 1314: bfs terminated with signal 6 (Aborted)
munmap_chunk(): invalid pointer
oomify: alloc 1486: bfs terminated with signal 6 (Aborted)
munmap_chunk(): invalid pointer
oomify: alloc 1490: bfs terminated with signal 6 (Aborted)
oomify: alloc 1494: bfs terminated with signal 11 (Segmentation fault)
...
```

We can pass `-n1486` to fail just that allocation, and `-s` to trigger a `SIGSTOP` at that point in order to attach a debugger.

```
$ oomify -n1486 -s bfs >/dev/null &
$ gdb bfs $(pgrep bfs)
GNU gdb (GDB) 9.2
...
0x00007fdac07325f3 in raise () from /usr/lib/libc.so.6
(gdb) bt
#0  0x00007fdac07325f3 in raise () from /usr/lib/libc.so.6
#1  0x00007fdac08d4283 in should_inject () at oominject.c:31
#2  0x00007fdac08d42ca in malloc (size=5) at oominject.c:49
#3  0x00007fdac0784b4f in strdup () from /usr/lib/libc.so.6
#4  0x000055f3e91db121 in bfs_parse_groups () at pwcache.c:187
#5  0x000055f3e91d8620 in parse_cmdline (argc=1, argv=0x7ffd9f01d958) at parse.c:3555
#6  0x000055f3e91cdfdb in main (argc=1, argv=0x7ffd9f01d958) at main.c:103
(gdb) frame 4
#4  0x000055f3e91db121 in bfs_parse_groups () at pwcache.c:187
187                     ent->gr_name = strdup(ent->gr_name);
(gdb) cont
Continuing.

Program received signal SIGABRT, Aborted.
0x00007fdac0732615 in raise () from /usr/lib/libc.so.6
(gdb) bt
#0  0x00007fdac0732615 in raise () from /usr/lib/libc.so.6
#1  0x00007fdac071b862 in abort () from /usr/lib/libc.so.6
#2  0x00007fdac07745e8 in __libc_message () from /usr/lib/libc.so.6
#3  0x00007fdac077c27a in malloc_printerr () from /usr/lib/libc.so.6
#4  0x00007fdac077c6ac in munmap_chunk () from /usr/lib/libc.so.6
#5  0x00007fdac08d43a1 in free (ptr=0x55f3ea69f8b9) at oominject.c:82
#6  0x000055f3e91db42b in bfs_free_groups (groups=0x55f3ea69f850) at pwcache.c:271
#7  0x000055f3e91db2fb in bfs_parse_groups () at pwcache.c:240
#8  0x000055f3e91d8620 in parse_cmdline (argc=1, argv=0x7ffd9f01d958) at parse.c:3555
#9  0x000055f3e91cdfdb in main (argc=1, argv=0x7ffd9f01d958) at main.c:103
(gdb) frame 6
#6  0x000055f3e91db42b in bfs_free_groups (groups=0x55f3ea69f850) at pwcache.c:271
271                                     free(entry->gr_mem[j]);
```

This is exactly what we expect of the original bug.
With the patch applied, we see no more of those `munmap_chunk(): invalid pointer` messages or segmentation faults:

```
$ oomify bfs >/dev/null
oomify: bfs did 2147 allocations
malloc(): Cannot allocate memory
malloc(): Cannot allocate memory
cfdup(): Cannot allocate memory
cfdup(): Cannot allocate memory
cannot allocate memory for thread-local data: ABORT
Assertion 's' failed at src/shared/json.c:1760, function json_variant_format(). Aborting.
oomify: alloc 1282: bfs terminated with signal 6 (Aborted)
Assertion 's' failed at src/shared/json.c:1760, function json_variant_format(). Aborting.
oomify: alloc 1597: bfs terminated with signal 6 (Aborted)
Assertion 's' failed at src/shared/json.c:1760, function json_variant_format(). Aborting.
oomify: alloc 1659: bfs terminated with signal 6 (Aborted)
malloc(): Cannot allocate memory
malloc(): Cannot allocate memory
bftw(): Cannot allocate memory
...
bftw(): Cannot allocate memory
```

However, there are some other strange errors.
The JSON error is particularly surprising as `bfs` has nothing to do with JSON.
I detailed [on Twitter] how I tracked that bug [through systemd] of all things to the underlying [issue in glibc].

[on Twitter]: https://twitter.com/tavianator/status/1301617887094992896
[through systemd]: https://github.com/systemd/systemd/blob/v246/src/shared/json.c#L1760
[issue in glibc]: https://sourceware.org/bugzilla/show_bug.cgi?id=26573

With a workaround for that bug in place, a new issue emerges:

```
oomify: alloc 1282: bfs terminated with signal 11 (Segmentation fault)
```

This bug originates in something called `libp11-kit`:

```
(gdb) bt
#0  0x00007fdeca2685f3 in raise () from /usr/lib/libc.so.6
#1  0x00007fdeca459283 in should_inject () at oominject.c:31
#2  0x00007fdeca4592ca in malloc (size=232) at oominject.c:49
#3  0x00007fdeca26023a in newlocale () from /usr/lib/libc.so.6
#4  0x00007fdec9614135 in ?? () from /usr/lib/libp11-kit.so.0
#5  0x00007fdeca4702de in call_init.part () from /lib64/ld-linux-x86-64.so.2
...
(gdb) cont
Continuing.

Program received signal SIGSEGV, Segmentation fault.
0x00007fdeca26077a in freelocale () from /usr/lib/libc.so.6
(gdb) bt
#0  0x00007fdeca26077a in freelocale () from /usr/lib/libc.so.6
#1  0x00007fdec96140ae in ?? () from /usr/lib/libp11-kit.so.0
#2  0x00007fdeca47068b in _dl_fini () from /lib64/ld-linux-x86-64.so.2
#3  0x00007fdeca26adb7 in __run_exit_handlers () from /usr/lib/libc.so.6
#4  0x00007fdeca26af5e in exit () from /usr/lib/libc.so.6
#5  0x00007fdeca253159 in __libc_start_main () from /usr/lib/libc.so.6
#6  0x0000561b772096ee in _start ()
```

I tracked this one down and submitted a [pull request] to fix it.

[pull request]: https://github.com/p11-glue/p11-kit/pull/321

Another bug surfaces when checking ACLs:

```
oomify: alloc 2260: bfs terminated with signal 11 (Segmentation fault)
```

This one is in `libacl`:

```
(gdb) bt
#0  0x00007f0e425fc5f3 in raise () from /usr/lib/libc.so.6
#1  0x00007f0e427ed283 in should_inject () at oominject.c:31
#2  0x00007f0e427ed2ca in malloc (size=56) at oominject.c:49
#3  0x00007f0e42796d9c in ?? () from /usr/lib/libacl.so.1
#4  0x00007f0e42795529 in ?? () from /usr/lib/libacl.so.1
#5  0x00007f0e42795d72 in acl_from_mode () from /usr/lib/libacl.so.1
#6  0x00007f0e427953b6 in acl_get_file () from /usr/lib/libacl.so.1
#7  0x0000562e29551584 in bfs_check_acl (ftwbuf=0x7ffd6401fa18) at fsade.c:218
...
(gdb) cont
Continuing.

Program received signal SIGSEGV, Segmentation fault.
0x00007f0e427946c4 in ?? () from /usr/lib/libacl.so.1
(gdb) bt
#0  0x00007f0e427946c4 in ?? () from /usr/lib/libacl.so.1
#1  0x00007f0e42795e00 in acl_from_mode () from /usr/lib/libacl.so.1
#2  0x00007f0e427953b6 in acl_get_file () from /usr/lib/libacl.so.1
#3  0x0000562e29551584 in bfs_check_acl (ftwbuf=0x7ffd6401fa18) at fsade.c:218
...
```

It's a case of passing `NULL` to a function that doesn't handle it when an allocation fails.
I reported it [here], and it's also already [fixed].

[here]: https://savannah.nongnu.org/bugs/index.php?59061
[fixed]: https://git.savannah.nongnu.org/cgit/acl.git/commit/?id=40c190dc1f6630054d7d2f850a0b9fb10c7bbcb1

Funnily enough, after all this effort I didn't find any more bugs in my own code, only in others'.
But I'm happy to have found and fixed a few issues in some other open source software, and maybe other people will find OOMify useful.
You can find it on [*fa-github* GitHub](https://github.com/tavianator/oomify) if you want to try it out.
