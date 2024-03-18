# Bug hunting in Btrfs

<div class="infobar">

*fa-clock-o* *time-2024-03-18*
*fa-user* Tavian Barnes

</div>

The other day I was implementing [multi-threaded `stat()` calls](/cgit/bfs.git/commit/?id=89ecb2a08467cd8aa6ba70f8519df494652cac96) in [`bfs`](../projects/bfs.md).
When I ran some benchmarks, I saw something that made my heart skip a beat:

```console
$ tailfin run bench/bench.sh --build=main --default
...
bfs: error: bench/corpus/chromium/v8/src/heap/heap.cc: Structure needs cleaning
```

If you're not familiar, "structure needs cleaning" is the human-readable description of `EUCLEAN`, an `errno` value that usually indicates filesystem corruption.
Fearing the worst, I checked `dmesg` and saw

```console
$ dmesg | tail
...
BTRFS critical (device dm-2): corrupted node, root=518 block=16438782945911875046 owner mismatch, have 4517169229596899607 expect [256, 18446744073709551360]
```

I immediately rebooted into a live environment and ran `btrfs check`, but to my surprise, there were no errors found.
`btrfs scrub` also found no evidence of corruption.
And in fact, the file from the error message was completely fine.
Whatever the issue was, it seemed to have gone away on its own.

I searched Google for that "corrupted node" message and found that it had happened to someone else recently too: [Linus Torvalds](https://lore.kernel.org/linux-btrfs/CAHk-=whNdMaN9ntZ47XRKP6DBes2E5w7fi-0U3H2+PS18p+Pzw@mail.gmail.com/), just after merging a Btrfs pull request.
(This was not the first time Linus and I had hit the same bug.
We both have the same CPU in our desktops.
Last time it led to one of my [favourite bugfixes ever](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/commit/?id=a51ab63b297ce9e26e3ffb9be896018a42d5f32f).)

But the difference between me and Linus was that I could (semi-)reliably reproduce the error.
Not every time, but maybe 10% of the time I ran `bfs` with parallel `stat()` calls on a large directory tree, I would see that "structure needs cleaning" error.
I reported my [findings](https://lore.kernel.org/linux-btrfs/20240206033807.15498-1-tavianator@tavianator.com/) to the Btrfs mailing list, and though it led to some discussion about potential causes, we didn't narrow down the root cause.


## `extent_buffer`

Based on the logs, the Btrfs developers assumed the problem had to do allocation of [`struct extent_buffer`](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/fs/btrfs/extent_io.h?id=a51ab63b297ce9e26e3ffb9be896018a42d5f32f#n76) and their memory pages.
I'm not a Btrfs internals expert by any means, but I understand that `extent_buffer`s are used for metadata I/O; that is, reading and writing [B-tree](https://en.wikipedia.org/wiki/B-tree) nodes.
An `extent_buffer` is associated with an array of `struct folio`/`struct page` (depending on kernel version), and those pages hold the actual contents of the extents that are read or written.
The abstraction helps with file system block sizes that are different from the system page size.

Allocating an `extent_buffer` and its pages is [more complicated than you might expect](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/fs/btrfs/extent_io.c?id=a51ab63b297ce9e26e3ffb9be896018a42d5f32f#n3681).
Each `struct extent_buffer` holds an array of `struct folio`, and those folios have a private reference that points back to the `extent_buffer`.
There should only ever be one `extent_buffer` at a time for any particular extent.

To reduce locking on the allocation path, the `extent_buffer` and the corresponding folios are allocated separately, linked together, and then inserted into a radix tree keyed by the start offset of the extent.
Only the radix tree insertion needs locking.
At the point of insertion, if it turns out someone else beat us to allocating the same extent, we instead take an extra reference to that `extent_buffer` and free the one we just allocated (and its pages).

This code path had undergone some churn recently, both [changing the race detection/handling strategy](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/commit/?id=09e6cef19c9fc0e10547135476865b5272aa0406) and [converting from `struct page` to `struct folio`](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/commit/?id=082d5bb9b336d533b7b968f4f8712e7755a9876a), so there was suspicion that a race or reference counting bug had crept in.
But the extra debug logging didn't show it.
It appeared that the `extent_buffer` and the `folio`s had all the right reference counts, but the memory itself had garbage rather than the appropriate on-disk contents.
Btrfs does some sanity checks after reading these blocks in, and those checks were failing, causing the errors.
But the on-disk blocks themselves were fine, and the next time we read them in, everything worked.


## `git bisect bad`

One of the best bug hunting tools for the Linux kernel is [`git bisect`](https://git-scm.com/docs/git-bisect).
Unfortunately, bisecting bugs like this is challenging.
For intermittent issues, it's easy enough to know when to mark a commit bad, but harder to know if a commit is good&mdash;maybe the bug just hasn't triggered *yet*.
You also need a known-good commit to start from, but that was hard to find.
I thought at first the bug was new in Linux 6.7, but I could still reproduce it on 6.6 and 6.5.
The Btrfs devs suggested I start from 6.0.

Bisecting can also be dangerous because you are running arbitrary old mid-development-cycle kernel commits that may have since had bugs fixed in the official releases.
It's safer to do it from a virtual machine, but so far I had been unable to reproduce the bug on a VM.
So started bisecting on my actual desktop.

Normally I would be far too scared to bisect a filesystem corruption bug on my actual computer that I use daily.
But this seemed like it wasn't "real" corruption, plus I have backups, so I risked it.
Unfortunately, after a couple rounds, I ran into [actual, on-disk filesystem corruption](https://lore.kernel.org/linux-btrfs/CABg4E-=u7m_g3HCFUYHS-+RC==pefkUZXiTT2Aor86jruHSF9Q@mail.gmail.com/).
2,073,625 uncorrectable read errors is a new record for me, so I was too scared to continue the bisect.
I restored what I could from backups and carried on with my life.


## `tracefs`

A few weeks later, Btrfs developer Qu Wenruo got back to me with some [extra debugging patches](https://lore.kernel.org/linux-btrfs/c7241ea4-fcc6-48d2-98c8-b5ea790d6c89@gmx.com/) and I decided to give it another shot.
I ran his patch on bare metal, but wasn't able to reproduce the bug with the debugging patch applied.
Such is life when debugging race conditions!

I also tried again to reproduce the issue in a VM.
I configured it to more closely match my actual system configuration: multiple disks with [dm-crypt](https://wiki.archlinux.org/title/dm-crypt/Device_encryption) full disk encryption, joined together in a Btrfs RAID 0 array.
And I made them emulated NVME drives instead of VirtIO.
That did the trick: I could now reproduce the issue in a VM, though it took around 30 runs of my reproducer instead of the ~10 it took in real life.
But this time I could still reproduce it with the debugging patch applied.

After a couple runs and tweaking the trace messages to make cross-referencing easier, I noticed something odd.
Looking at just the lines from the trace corresponding to the "corrupted" error message, I saw this:

```console
$ grep 'eb=15302115328' dmesg.log
BTRFS critical (device dm-0): corrupted leaf, root=258 block=15302115328 owner mismatch, have 13709377558419367261 expect [256, 18446744073709551360] eb=15302115328
iou-wrk--173727   15..... 2649295481us : alloc_extent_buffer: alloc_extent_buffer: alloc eb=15302115328 len=16384
kworker/-322      15..... 2649295735us : end_bbio_meta_read: read done, eb=15302115328 page_refs=3 eb level=0 fsid=b66a67f0-8273-4158-b7bf-988bb5683000
kworker/-5095     31..... 2649295941us : end_bbio_meta_read: read done, eb=15302115328 page_refs=8 eb level=0 fsid=b66a67f0-8273-4158-b7bf-988bb5683000
```

The only relevant operations seem to be allocating this `extent_buffer`, and then reading it ... twice.
Reading it once ought to be enough, I thought, so I looked more closely at the code that actually reads them in and managed to eyeball the bug.


## `read_extent_buffer_pages()`

Just like how multiple threads might try to allocate the same `extent_buffer` at the same time, they might also try to read it at the same time.
To ensure the read only happens once, a custom locking protocol is used:

```c
int read_extent_buffer_pages(struct extent_buffer *eb, /* ... */)
{
    if (test_bit(EXTENT_BUFFER_UPTODATE, &eb->bflags))
        return 0;

    /* ... */

    /* Someone else is already reading the buffer, just wait for it. */
    if (test_and_set_bit(EXTENT_BUFFER_READING, &eb->bflags))
        goto done;

    /* ... */
    bbio = btrfs_bio_alloc(INLINE_EXTENT_BUFFER_PAGES,
                   REQ_OP_READ | REQ_META, eb->fs_info,
                   end_bbio_meta_read, eb);
    /* ... */
    btrfs_submit_bio(bbio, mirror_num);

done:
    if (wait == WAIT_COMPLETE) {
        wait_on_bit_io(&eb->bflags, EXTENT_BUFFER_READING, TASK_UNINTERRUPTIBLE);
        if (!test_bit(EXTENT_BUFFER_UPTODATE, &eb->bflags))
            return -EIO;
    }

    return 0;
}

static void end_bbio_meta_read(struct btrfs_bio *bbio)
{
    /* ... */
    bool uptodate = !bbio->bio.bi_status;
    /* ... */

    if (uptodate) {
        set_extent_buffer_uptodate(eb);
    } else {
        clear_extent_buffer_uptodate(eb);
        set_bit(EXTENT_BUFFER_READ_ERR, &eb->bflags);
    }

    /* ... */
    clear_bit(EXTENT_BUFFER_READING, &eb->bflags);
    smp_mb__after_atomic();
    wake_up_bit(&eb->bflags, EXTENT_BUFFER_READING);
    /* ... */
}
```

The logic is intended to work like this:

<style>
.code-cols {
    display: flex;
    flex-flow: row wrap;
    align-items: stretch;
}
.code-cols > pre {
    flex: 1;
    margin: 0;
}
.code-cols > pre > code {
    box-sizing: border-box;
    min-height: 100%;
}
.code-cols > pre:nth-child(even) > code {
    background-color: var(--quote-bg);
}
</style>
<div id="race-1" class="code-cols">

```c
read_extent_buffer_pages()
{
    if (test_bit(UPTODATE))
        return 0;

    if (test_and_set_bit(READING))
        goto done;

    btrfs_submit_bio();

done:
    wait_on_bit_io(READING);
    return 0;
}

end_bbio_meta_read()
{
    set_bit(UPTODATE);
    clear_bit(READING);
    wake_up_bit(READING);
}
```

```c
read_extent_buffer_pages()
{
    if (test_bit(UPTODATE))
        return 0;

    if (test_and_set_bit(READING))
        goto done;

    btrfs_submit_bio();

done:
    wait_on_bit_io(READING);
    return 0;
}
```

</div>
<script type="postproc">
for (const code of document.querySelectorAll(".code-cols > pre > code")) {
    let text = code.textContent;
    const lines = text.split("\n");
    code.textContent = "";
    for (let i = 0; i < lines.length; ++i) {
        let line = lines[i];
        if (i != lines.length - 1) {
            line += "\n";
        }
        const span = document.createElement("span");
        span.classList.add("line", "line-" + i);
        span.textContent = line;
        code.append(span);
    }
}
</script>
<style>
pre .line {
    display: block;
}
#race-1 > pre:first-child .line-2 {
    animation: 10s infinite a-1;
}
#race-1 > pre:first-child .line-5 {
    animation: 10s infinite a-2;
}
#race-1 > pre:first-child .line-8 {
    animation: 10s infinite a-3;
}
#race-1 > pre:first-child .line-11 {
    animation: 10s infinite a-4;
}
#race-1 > pre:first-child .line-17 {
    animation: 10s infinite a-5;
}
#race-1 > pre:first-child .line-18 {
    animation: 10s infinite a-6;
}
#race-1 > pre:first-child .line-19 {
    animation: 10s infinite a-7;
}
#race-1 > pre:first-child .line-12 {
    animation: 10s infinite a-8;
}
#race-1 > pre:last-child .line-2 {
    animation: 10s infinite a-1;
}
#race-1 > pre:last-child .line-5 {
    animation: 10s infinite a-9;
}
#race-1 > pre:last-child .line-6 {
    animation: 10s infinite a-10;
}
#race-1 > pre:last-child .line-11 {
    animation: 10s infinite a-11;
}
#race-1 > pre:last-child .line-12 {
    animation: 10s infinite a-8;
}
@keyframes a-1 {
    0%, 20% { background: none; color: unset; }
    10% { background: highlight; color: highlighttext; }
}
@keyframes a-2 {
    10%, 30% { background: none; color: unset; }
    20% { background: highlight; color: highlighttext; }
}
@keyframes a-3 {
    20%, 40% { background: none; color: unset; }
    30% { background: highlight; color: highlighttext; }
}
@keyframes a-4 {
    30%, 40%, 50%, 60%, 70%, 80% { background: none; color: unset; }
    35%, 45%, 55%, 65%, 75% { background: highlight; color: highlighttext; }
}
@keyframes a-5 {
    40%, 60% { background: none; color: unset; }
    50% { background: highlight; color: highlighttext; }
}
@keyframes a-6 {
    50%, 70% { background: none; color: unset; }
    60% { background: highlight; color: highlighttext; }
}
@keyframes a-7 {
    60%, 80% { background: none; color: unset; }
    70% { background: highlight; color: highlighttext; }
}
@keyframes a-8 {
    80%, 90% { background: none; color: unset; }
    85% { background: highlight; color: highlighttext; }
}
@keyframes a-9 {
    10%, 40% { background: none; color: unset; }
    20%, 30% { background: highlight; color: highlighttext; }
}
@keyframes a-10 {
    30%, 50% { background: none; color: unset; }
    40% { background: highlight; color: highlighttext; }
}
@keyframes a-11 {
    40%, 50%, 60%, 70%, 80% { background: none; color: unset; }
    45%, 55%, 65%, 75% { background: highlight; color: highlighttext; }
}
</style>

Unfortunately, this locking protocol has a bug:

<div id="race-2" class="code-cols">

```c
if (test(UPTODATE))
    return 0;

if (test_and_set(READING))
    goto done;

btrfs_submit_bio();

done:
    wait_on(READING);
    return 0;

set(UPTODATE);
clear(READING);
wake_up(READING);
```

```c
if (test(UPTODATE))
    return 0;

if (test_and_set(READING))
    goto done;

btrfs_submit_bio();

done:
    wait_on(READING);
    return 0;
```

```c
if (test(UPTODATE))
    return 0;

if (test_and_set(READING))
    goto done;

btrfs_submit_bio();

done:
    wait_on(READING);
    return 0;
```

</div>
<style>
#race-2 > pre:nth-child(1) .line-0 {
    animation: 15s infinite b-1;
}
#race-2 > pre:nth-child(1) .line-3 {
    animation: 15s infinite b-2;
}
#race-2 > pre:nth-child(1) .line-6 {
    animation: 15s infinite b-3;
}
#race-2 > pre:nth-child(1) .line-9 {
    animation: 15s infinite b-4;
}
#race-2 > pre:nth-child(1) .line-12 {
    animation: 15s infinite b-5;
}
#race-2 > pre:nth-child(1) .line-13 {
    animation: 15s infinite b-6;
}
#race-2 > pre:nth-child(1) .line-14 {
    animation: 15s infinite b-7;
}
#race-2 > pre:nth-child(1) .line-10 {
    animation: 15s infinite b-8;
}
#race-2 > pre:nth-child(2) .line-0 {
    animation: 15s infinite b-1;
}
#race-2 > pre:nth-child(2) .line-3 {
    animation: 15s infinite b-9;
}
#race-2 > pre:nth-child(2) .line-6 {
    animation: 15s infinite b-10;
}
#race-2 > pre:nth-child(2) .line-9 {
    animation: 15s infinite b-11;
}
#race-2 > pre:nth-child(3) .line-0 {
    animation: 15s infinite b-12;
}
#race-2 > pre:nth-child(3) .line-1 {
    animation: 15s infinite b-13;
}
@keyframes b-1 {
    0%, 12% { background: none; color: unset; }
    6% { background: highlight; color: highlighttext; }
}
@keyframes b-2 {
    6%, 18% { background: none; color: unset; }
    12% { background: highlight; color: highlighttext; }
}
@keyframes b-3 {
    12%, 24% { background: none; color: unset; }
    18% { background: highlight; color: highlighttext; }
}
@keyframes b-4 {
    18%, 24%, 30%, 36%, 42%, 48% { background: none; color: unset; }
    21%, 27%, 33%, 39%, 45% { background: highlight; color: highlighttext; }
}
@keyframes b-5 {
    24%, 36% { background: none; color: unset; }
    30% { background: highlight; color: highlighttext; }
}
@keyframes b-6 {
    30%, 42% { background: none; color: unset; }
    36% { background: highlight; color: highlighttext; }
}
@keyframes b-7 {
    36%, 48% { background: none; color: unset; }
    42% { background: highlight; color: highlighttext; }
}
@keyframes b-8 {
    48%, 54% { background: none; color: unset; }
    51% { background: highlight; color: highlighttext; }
}
@keyframes b-9 {
    6%, 60% { background: none; color: unset; }
    12%, 54% { background: highlight; color: highlighttext; }
}
@keyframes b-10 {
    54%, 66% { background: none; color: unset; }
    60% { background: highlight; color: highlighttext; }
}
@keyframes b-11 {
    60%, 66%, 72%, 78%, 84%, 90%, 96% { background: none; color: unset; }
    63%, 69%, 75%, 81%, 87%, 93% { background: highlight; color: highlighttext; }
}
@keyframes b-12 {
    75%, 87% { background: none; color: unset; }
    81% { background: highlight; color: highlighttext; }
}
@keyframes b-13 {
    81%, 93% { background: none; color: unset; }
    87% { background: highlight; color: highlighttext; }
}
</style>

If the first thread starts *and finishes* the I/O between the second thread checking the `UPTODATE` bit and the `READING` bit, the second thread will start a totally unnecessary read even though we already read in the extent.
Worse, because the `UPTODATE` bit is already set, the third will return without waiting for the read to complete.
That thread will then think it's safe to access the `extent_buffer`'s pages, despite them currently being under I/O, leading to a data race!

The fix is to use [double-checked locking](https://en.wikipedia.org/wiki/Double-checked_locking): after setting the `READING` bit, check `UPTODATE` again so we don't kick off more useless (actively harmful, even) I/O.

<div id="race-3" class="code-cols">

```c
if (test(UPTODATE))
    return 0;

if (test_and_set(READING))
    goto done;

if (test(UPTODATE))
    goto wake;

btrfs_submit_bio();

done:
    wait_on(READING);
    return 0;

end_bbio:
    set(UPTODATE);
wake:
    clear(READING);
    wake_up(READING);
```

```c
if (test(UPTODATE))
    return 0;

if (test_and_set(READING))
    goto done;

if (test(UPTODATE))
    goto wake;

btrfs_submit_bio();

done:
    wait_on(READING);
    return 0;

end_bbio:
    set(UPTODATE);
wake:
    clear(READING);
    wake_up(READING);
```

```c
if (test(UPTODATE))
    return 0;

if (test_and_set(READING))
    goto done;

if (test(UPTODATE))
    goto wake;

btrfs_submit_bio();

done:
    wait_on(READING);
    return 0;

end_bbio:
    set(UPTODATE);
wake:
    clear(READING);
    wake_up(READING);
```

</div>
<style>
#race-3 > pre:nth-child(1) .line-0 {
    animation: 15s infinite c-1;
}
#race-3 > pre:nth-child(1) .line-3 {
    animation: 15s infinite c-2;
}
#race-3 > pre:nth-child(1) .line-6 {
    animation: 15s infinite c-3;
}
#race-3 > pre:nth-child(1) .line-9 {
    animation: 15s infinite c-4;
}
#race-3 > pre:nth-child(1) .line-12 {
    animation: 15s infinite c-5;
}
#race-3 > pre:nth-child(1) .line-16 {
    animation: 15s infinite c-6;
}
#race-3 > pre:nth-child(1) .line-18 {
    animation: 15s infinite c-7;
}
#race-3 > pre:nth-child(1) .line-19 {
    animation: 15s infinite c-8;
}
#race-3 > pre:nth-child(1) .line-13 {
    animation: 15s infinite c-9;
}
#race-3 > pre:nth-child(2) .line-0 {
    animation: 15s infinite c-1;
}
#race-3 > pre:nth-child(2) .line-3 {
    animation: 15s infinite c-10;
}
#race-3 > pre:nth-child(2) .line-6 {
    animation: 15s infinite c-11;
}
#race-3 > pre:nth-child(2) .line-7 {
    animation: 15s infinite c-12;
}
#race-3 > pre:nth-child(2) .line-18 {
    animation: 15s infinite c-13;
}
#race-3 > pre:nth-child(2) .line-19 {
    animation: 15s infinite c-14;
}
#race-3 > pre:nth-child(3) .line-0 {
    animation: 15s infinite c-13;
}
#race-3 > pre:nth-child(3) .line-1 {
    animation: 15s infinite c-14;
}
@keyframes c-1 {
    0%, 12% { background: none; color: unset; }
    6% { background: highlight; color: highlighttext; }
}
@keyframes c-2 {
    6%, 18% { background: none; color: unset; }
    12% { background: highlight; color: highlighttext; }
}
@keyframes c-3 {
    12%, 24% { background: none; color: unset; }
    18% { background: highlight; color: highlighttext; }
}
@keyframes c-4 {
    18%, 30% { background: none; color: unset; }
    24% { background: highlight; color: highlighttext; }
}
@keyframes c-5 {
    24%, 30%, 36%, 42%, 48%, 54% { background: none; color: unset; }
    27%, 33%, 39%, 45%, 51% { background: highlight; color: highlighttext; }
}
@keyframes c-6 {
    30%, 42% { background: none; color: unset; }
    36% { background: highlight; color: highlighttext; }
}
@keyframes c-7 {
    36%, 48% { background: none; color: unset; }
    42% { background: highlight; color: highlighttext; }
}
@keyframes c-8 {
    42%, 54% { background: none; color: unset; }
    48% { background: highlight; color: highlighttext; }
}
@keyframes c-9 {
    54%, 60% { background: none; color: unset; }
    57% { background: highlight; color: highlighttext; }
}
@keyframes c-10 {
    6%, 66% { background: none; color: unset; }
    12%, 60% { background: highlight; color: highlighttext; }
}
@keyframes c-11 {
    60%, 72% { background: none; color: unset; }
    66% { background: highlight; color: highlighttext; }
}
@keyframes c-12 {
    66%, 78% { background: none; color: unset; }
    72% { background: highlight; color: highlighttext; }
}
@keyframes c-13 {
    72%, 84% { background: none; color: unset; }
    78% { background: highlight; color: highlighttext; }
}
@keyframes c-14 {
    78%, 90% { background: none; color: unset; }
    84% { background: highlight; color: highlighttext; }
}
@keyframes c-15 {
    84%, 96% { background: none; color: unset; }
    90% { background: highlight; color: highlighttext; }
}
</style>

I submitted [a patch](https://lore.kernel.org/linux-btrfs/1ca6e688950ee82b1526bb3098852af99b75e6ba.1710551459.git.tavianator@tavianator.com/) that adds this missing check, as well as a couple [cleanup patches](https://lore.kernel.org/linux-btrfs/cover.1710769876.git.tavianator@tavianator.com/T/).
With that fix, I can run the reproducer overnight without triggering any more errors.


## Epilogue

You might be surprised that this race was not benign.
After all, we're reading some disk blocks into memory that already holds the contents of those same disk blocks.
It's still technically a data race to read and write memory at the same time, even if the writes don't modify the memory, but usually it would be unobservable in practice.

<div id="overwrite-1" class="overwrite">

```
uninitialized memory uninitialized memory uninitialized memory uninitialized memory uninitialized memory
```

```
metadata metadata metadata metadata metadata metadata metadata metadata metadata metadata metadata metad
```

```
metadata metadata metadata metadata metadata metadata metadata metadata metadata metadata metadata metad
```

</div>
<style>
.overwrite {
    position: relative;
    overflow: clip;
}
.overwrite > pre > code {
    overflow: hidden;
}
.overwrite > pre:nth-child(n + 2) {
    position: absolute;
    top: 0;
    margin: 0;
}
#overwrite-1 > pre:nth-child(2) > code {
    color: green;
    animation: typing-1 10s steps(80, end) infinite;
}
#overwrite-1 > pre:nth-child(3) > code {
    color: pink;
    animation: typing-2 10s steps(80, end) infinite;
}
@keyframes typing-1 {
    0%, 10% {
        width: 0;
        visibility: hidden;
    }
    30% {
        width: 100%;
        visibility: visible;
    }
}
@keyframes typing-2 {
    0%, 50% {
        width: 0;
        visibility: hidden;
    }
    70% {
        width: 100%;
        visibility: visible;
    }
}
</style>

The reason I could observe it was already mentioned above: full disk encryption.
When dm-crypt processes a disk read, it reads the *encrypted* contents into memory and then decrypts them in-place.

<div id="overwrite-2" class="overwrite">

```
uninitialized memory uninitialized memory uninitialized memory uninitialized memory uninitialized memory
```

```
encrypted gibberish encrypted gibberish encrypted gibberish encrypted gibber encrypted gibberish encrypt
```

```
metadata metadata metadata metadata metadata metadata metadata metadata metadata metadata metadata metad
```

```
encrypted gibberish encrypted gibberish encrypted gibberish encrypted gibber encrypted gibberish encrypt
```

```
metadata metadata metadata metadata metadata metadata metadata metadata metadata metadata metadata metad
```

</div>
<style>
#overwrite-2 > pre:nth-child(2) > code {
    color: lightblue;
    animation: typing-3 10s steps(80, end) infinite;
}
#overwrite-2 > pre:nth-child(3) > code {
    color: green;
    animation: typing-4 10s steps(80, end) infinite;
}
#overwrite-2 > pre:nth-child(4) > code {
    color: red;
    animation: typing-5 10s steps(80, end) infinite;
}
#overwrite-2 > pre:nth-child(5) > code {
    color: pink;
    animation: typing-6 10s steps(80, end) infinite;
}
@keyframes typing-3 {
    0%, 10% {
        width: 0;
        visibility: hidden;
    }
    25% {
        width: 100%;
        visibility: visible;
    }
}
@keyframes typing-4 {
    0%, 25% {
        width: 0;
        visibility: hidden;
    }
    40% {
        width: 100%;
        visibility: visible;
    }
}
@keyframes typing-5 {
    0%, 50% {
        width: 0;
        visibility: hidden;
    }
    65% {
        width: 100%;
        visibility: visible;
    }
}
@keyframes typing-6 {
    0%, 65% {
        width: 0;
        visibility: hidden;
    }
    80% {
        width: 100%;
        visibility: visible;
    }
}
</style>

It's obvious why this causes problems: sometimes the racing thread will see valid metadata, but sometimes it will see encrypted bytes that appear totally random.
I even captured a trace where the error messages show the extent being gradually filled in:

```
[  807.737576] BTRFS critical (device dm-0): corrupted node, root=266 block=3178470954007437077 owner mismatch, have 6155297726051334641 expect [256, 18446744073709551360] eb=ffff8ac915d022d0 start=12738904064
[  807.751913] BTRFS critical (device dm-0): corrupted leaf, root=266 block=12738904064 owner mismatch, have 6155297726051334641 expect [256, 18446744073709551360] eb=ffff8ac915d022d0 start=12738904064
[  807.800898] BTRFS critical (device dm-0): corrupted leaf, root=266 block=12738904064 owner mismatch, have 6155297726051334641 expect [256, 18446744073709551360] eb=ffff8ac915d022d0 start=12738904064
```

There you can see the *same block* switch from an internal node to a leaf, and the block number change from a random number to the start of the extent, over about 0.02 seconds.
