# You could have invented futexes

<div class="infobar">

<fa:clock-o> <time:2023-04-21>
<fa:user> Tavian Barnes
[<fa:github> GitHub](https://github.com/tavianator/futex)

</div>

The *futex* (**f**ast **u**serspace mu**tex**) is a Linux kernel feature designed for synchronization primitives (mutexes, condition variables, semaphores, etc.).
Like many topics in concurrency, they have a reputation for being tricky (for example, see the paper [*Futexes Are Tricky*](https://akkadia.org/drepper/futex.pdf)).
Despite that, they really are a well-motivated and simple but powerful API.
This post tries to explain that motivation, and even shows how to implement something similar yourself.


## Spinlocks

Let's say you've found yourself implementing the C standard library (my condolences; hopefully this doesn't happen to you too often).
If your libc has threads, it's also going to need locks.
The easiest one to implement is probably a [spinlock](https://en.wikipedia.org/wiki/Spinlock), so you start there:

```c
#include <stdatomic.h>

typedef atomic_flag spinlock_t;

#define SPINLOCK_INITIALIZER ATOMIC_FLAG_INIT

void spin_lock(spinlock_t *lock) {
    while (atomic_flag_test_and_set_explicit(lock, memory_order_acquire)) {
        // spin...
    }
}

void spin_unlock(spinlock_t *lock) {
    atomic_flag_clear(lock, memory_order_release);
}
```

This is not the best spinlock implementation (it could be more efficient with [TTAS](https://rigtorp.se/spinlock/), or more fair as a [ticket lock](https://en.wikipedia.org/wiki/Ticket_lock)), but it works.
Maybe you're not a memory ordering expert, but `acquire` sounds right for *acquiring* a lock, and `release` sounds right for *releasing* it, so that's probably correct (it is).

## Mutexes

Spinlocks are great when they don't actually have to spin.
But as soon as two threads are contending for the same lock, the one that loses the race starts spinning, at 100% CPU utilization, running up your power bill/killing your battery and contributing to global warming.
It would be better for the spinning thread to go to sleep, using 0% CPU, until the lock gets unlocked.

Okay, but how do you make a thread "go to sleep"?
You could literally `sleep(1)`, but that's way too much latency.
You could try `usleep(1)`, but then you're waking up a million times a second.
Ideally, we would go to sleep *indefinitely*, and get whoever unlocks the lock to wake us up.

There's a few ways to implement the "*go to sleep*" and "*wake another thread up*" operations, but they all involve system calls.
You might have heard that syscalls are slow, particularly since [Meltdown](https://www.brendangregg.com/blog/2018-02-09/kpti-kaiser-meltdown-performance.html)/<wbr>[Spectre](https://www.phoronix.com/review/3-years-specmelt), so you want to avoid them when you can.
That means

- `mutex_lock()` should avoid sleeping if possible, and
- `mutex_unlock()` should avoid waking anyone up if no one's asleep

Whether any threads are asleep is a third state (in addition to *locked* and *unlocked*), so we can't use an `atomic_flag` any more.

```c
typedef atomic_int mutex_t;

enum {
    UNLOCKED,
    LOCKED,
    SLEEPING,
};

#define MUTEX_INITIALIZER UNLOCKED
```

Moving from the `UNLOCKED` to the `LOCKED` state is cheap, so that's the first thing we try.
Otherwise, we move to the `SLEEPING` state, and wait to be woken up.

```c
void mutex_lock(mutex_t *mutex) {
    int old = UNLOCKED;
    if (atomic_compare_exchange_weak_explicit(
        mutex, &old, LOCKED,
        memory_order_acquire,  // Memory order if it succeeds
        memory_order_relaxed)) // Memory order if it fails
    {
        return;
    }

    while (true) {
        old = atomic_exchange_explicit(mutex, SLEEPING, memory_order_acquire);
        if (old == UNLOCKED) {
            return;
        }
        // 🐛
        go_to_sleep();
    }
}

void mutex_unlock(mutex_t *mutex) {
    int old = atomic_exchange_explicit(mutex, UNLOCKED, memory_order_release);
    if (old == SLEEPING) {
        wake_someone_up();
    }
}
```

You might have spotted a bug in this code: if one thread runs `wake_someone_up()` while another is at the line marked 🐛, before `go_to_sleep()` gets called, then no one will wake up (because no one is asleep yet).
Then when `go_to_sleep()` does get called, it might sleep forever, as no one else will wake it up.
This condition is known as a *lost wakeup*, and left untreated, would cause a deadlock.

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
</style>
<div id="race-1" class="code-cols">

```c
// mutex_lock()
old = exchange(mutex, SLEEPING, acquire);
if (old == UNLOCKED) {
    return;
}
// 🐛
go_to_sleep();
```

```c
// mutex_unlock()
old = exchange(mutex, UNLOCKED, release);
if (old == SLEEPING) {
    wake_someone_up();
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
#race-1 > pre:first-child .line-1 {
    animation: 10s infinite a-1;
}
#race-1 > pre:last-child .line-1 {
    animation: 10s infinite a-2;
}
#race-1 > pre:first-child .line-2 {
    animation: 10s infinite a-3;
}
#race-1 > pre:last-child .line-2 {
    animation: 10s infinite a-4;
}
#race-1 > pre:first-child .line-5 {
    animation: 10s infinite a-5;
}
#race-1 > pre:last-child .line-3 {
    animation: 10s infinite a-6;
}
#race-1 > pre:first-child .line-6 {
    animation: 10s infinite a-7;
}
@keyframes a-1 {
    0%, 30% { background: none; color: unset; }
    10%, 20% { background: highlight; color: highlighttext; }
}
@keyframes a-2 {
    10%, 40% { background: none; color: unset; }
    20%, 30% { background: highlight; color: highlighttext; }
}
@keyframes a-3 {
    20%, 50% { background: none; color: unset; }
    30%, 40% { background: highlight; color: highlighttext; }
}
@keyframes a-4 {
    30%, 60% { background: none; color: unset; }
    40%, 50% { background: highlight; color: highlighttext; }
}
@keyframes a-5 {
    40%, 70% { background: none; color: unset; }
    50%, 60% { background: highlight; color: highlighttext; }
}
@keyframes a-6 {
    50%, 70% { background: none; color: unset; }
    60% { background: highlight; color: highlighttext; }
}
@keyframes a-7 {
    60%, 70%, 80%, 90% { background: none; color: unset; }
    65%, 75%, 85% { background: highlight; color: highlighttext; }
}
</style>

It's not obvious how to fix this.
We could try to detect the race and avoid sleeping, but that just moves the race window, rather than closing it completely.

<div id="race-2" class="code-cols">

```c
// mutex_lock()
old = exchange(mutex, SLEEPING, acquire);
if (old == UNLOCKED) {
    return;
}
if (load(mutex, relaxed) == SLEEPING) {
    // 🐛
    go_to_sleep();
}
```

```c
// mutex_unlock()
old = exchange(mutex, UNLOCKED, release);
if (old == SLEEPING) {
    wake_someone_up();
}
```

</div>
<style>
#race-2 > pre:first-child .line-1 {
    animation: 10s infinite b-1;
}
#race-2 > pre:first-child .line-2 {
    animation: 10s infinite b-2;
}
#race-2 > pre:first-child .line-5 {
    animation: 10s infinite b-3;
}
#race-2 > pre:first-child .line-6 {
    animation: 10s infinite b-4;
}
#race-2 > pre:last-child .line-1 {
    animation: 10s infinite b-5;
}
#race-2 > pre:last-child .line-2 {
    animation: 10s infinite b-6;
}
#race-2 > pre:last-child .line-3 {
    animation: 10s infinite b-7;
}
#race-2 > pre:first-child .line-7 {
    animation: 10s infinite b-8;
}
@keyframes b-1 {
    0%, 20% { background: none; color: unset; }
    10% { background: highlight; color: highlighttext; }
}
@keyframes b-2 {
    10%, 30% { background: none; color: unset; }
    20% { background: highlight; color: highlighttext; }
}
@keyframes b-3 {
    20%, 40% { background: none; color: unset; }
    30% { background: highlight; color: highlighttext; }
}
@keyframes b-4 {
    30%, 80% { background: none; color: unset; }
    40%, 70% { background: highlight; color: highlighttext; }
}
@keyframes b-5 {
    40%, 60% { background: none; color: unset; }
    50% { background: highlight; color: highlighttext; }
}
@keyframes b-6 {
    50%, 70% { background: none; color: unset; }
    60% { background: highlight; color: highlighttext; }
}
@keyframes b-7 {
    60%, 80% { background: none; color: unset; }
    70% { background: highlight; color: highlighttext; }
}
@keyframes b-8 {
    70%, 80%, 90%, 100% { background: none; color: unset; }
    75%, 85%, 95% { background: highlight; color: highlighttext; }
}
</style>

If you had an *atomic* version of

```c
if (atomic_load_explicit(mutex, memory_order_relaxed) == SLEEPING) {
    go_to_sleep();
}
```

so that the wakeup could not possibly happen between the `if` and the `go_to_sleep()`, that would fix the bug.
That's what a futex is!

## Futexes

A minimal futex API looks something like this:

```c
// Atomically check if `*futex == value`, and if so, go to sleep
void futex_wait(atomic_int *futex, int value);

// Wake up a thread currently waiting on `futex`
void futex_wake(atomic_int *futex);
```

Your mutex implementation could use them like this:

```c
void mutex_lock(mutex_t *mutex) {
    ...

    while (true) {
        old = atomic_exchange_explicit(mutex, SLEEPING, memory_order_acquire);
        if (old == UNLOCKED) {
            return;
        }
        futex_wait(mutex, SLEEPING);
    }
}

void mutex_unlock(mutex_t *mutex) {
    int old = atomic_exchange_explicit(mutex, UNLOCKED, memory_order_release);
    if (old == SLEEPING) {
        futex_wake(mutex, 1);
    }
}
```

This implementation is finally bug-free (I hope, anyway; after all, *futexes are tricky*).
You could implement `futex_wait()` and `futex_wake()` using the `futex()` system call, but it's instructive to implement them a different way: with [signals](https://en.wikipedia.org/wiki/Signal_(IPC)).
`futex_wait()` will go to sleep until a signal arrives, and `futex_wake()` will send a signal to the waiting thread(s).
To do this, we'll keep track of the waiting threads on a *wait queue*:

```c
// A single waiting thread
struct waiter {
    // The waiting thread
    pthread_t thread;
    // The futex it's waiting on
    atomic_int *futex;
    // A linked list of waiters.
    struct waiter *prev, *next;
};

// A wait queue
struct waitq {
    // Lock that protects the wait queue (can't be a mutex,
    // since we're implementing mutexes)
    spinlock_t lock;
    // A circular linked list of waiters
    struct waiter list;
};

// The global wait queue
struct waitq waitq = {
    .lock = SPINLOCK_INITIALIZER,
    .list = {
        .prev = &waitq.list,
        .next = &waitq.list,
    },
};
```

`futex_wait()` adds the calling thread to the wait queue and sleeps until a signal arrives with [`sigwait()`](https://pubs.opengroup.org/onlinepubs/9699919799/functions/sigwait.html).

```c
void futex_wait(atomic_int *futex, int value) {
    spin_lock(&waitq.lock);

    struct waiter *head = &waitq.list;
    struct waiter waiter = {
        .thread = pthread_self(),
        .futex = futex,
        .prev = head,
        .next = head->next,
    };

    // Insert the waiter into the list
    waiter.prev->next = &waiter;
    waiter.next->prev = &waiter;

    // Block the signal in the current thread so we can wait for it
    sigset_t old_mask, mask;
    sigemptyset(&mask);
    sigaddset(&mask, SIGCONT);
    pthread_sigmask(SIG_BLOCK, &mask, &old_mask);

    while (atomic_load_explicit(futex, memory_order_relaxed) == value) {
        // Unlock the wait queue before we sleep
        spin_unlock(&waitq.lock);
        // Sleep until we receive SIGCONT
        int sig;
        sigwait(&mask, &sig);
        // Re-lock the wait queue
        spin_lock(&waitq.lock);
    }

    // Remove ourselves from the wait queue
    waiter.prev->next = waiter.next;
    waiter.next->prev = waiter.prev;

    // Restore the old signal mask
    pthread_sigmask(SIG_SETMASK, &old_mask, NULL);

    spin_unlock(&waitq.lock);
}
```

`futex_wake()` walks the wait queue, signalling any threads waiting on the same futex:

```c
void futex_wake(atomic_int *futex) {
    spin_lock(&waitq.lock);

    struct waiter *head = &waitq.list;
    for (struct waiter *waiter = head->next; waiter != head; waiter = waiter->next) {
        if (waiter->futex == futex) {
            pthread_kill(waiter->thread, SIGCONT);
            break;
        }
    }

    spin_unlock(&waitq.lock);
}
```

You might think this has the same race condition as before, that if `pthread_kill()` happens right before `sigwait()`, the wakeup will be lost.
But in fact, because we blocked `SIGCONT` first, it will remain pending, and `sigwait()` will return immediately.

<div id="race-3" class="code-cols">

```c
// futex_wait()
while (load(futex, relaxed) == value) {
    spin_unlock(&waitq.lock);
    int sig;
    sigwait(&mask, &sig);
    spin_lock(&waitq.lock);
}
```

```c
// futex_wake()
spin_lock(&waitq.lock);
...
pthread_kill(waiter->thread, SIGCONT);
...
spin_unlock(&waitq.lock);
```

</div>
<style>
#race-3 > pre:first-child .line-1 {
    animation: 10s infinite c-1;
}
#race-3 > pre:first-child .line-2 {
    animation: 10s infinite c-2;
}
#race-3 > pre:first-child .line-3 {
    animation: 10s infinite c-3;
}
#race-3 > pre:last-child .line-1 {
    animation: 10s infinite c-4;
}
#race-3 > pre:last-child .line-2 {
    animation: 10s infinite c-5;
}
#race-3 > pre:last-child .line-3 {
    animation: 10s infinite c-6;
}
#race-3 > pre:last-child .line-4 {
    animation: 10s infinite c-7;
}
#race-3 > pre:last-child .line-5 {
    animation: 10s infinite c-8;
}
#race-3 > pre:first-child .line-4 {
    animation: 10s infinite c-8;
}
#race-3 > pre:first-child .line-5 {
    animation: 10s infinite c-9;
}
#race-3 > pre:first-child .line-6 {
    animation: 10s infinite c-10;
}
@keyframes c-1 {
    0%, 20%, 70%, 90% { background: none; color: unset; }
    10%, 80% { background: highlight; color: highlighttext; }
}
@keyframes c-2 {
    10%, 30% { background: none; color: unset; }
    20% { background: highlight; color: highlighttext; }
}
@keyframes c-3 {
    20%, 60% { background: none; color: unset; }
    30%, 50% { background: highlight; color: highlighttext; }
}
@keyframes c-4 {
    00%, 30% { background: none; color: unset; }
    10%, 20% { background: highlight; color: highlighttext; }
}
@keyframes c-5 {
    20%, 40% { background: none; color: unset; }
    30% { background: highlight; color: highlighttext; }
}
@keyframes c-6 {
    30%, 50% { background: none; color: unset; }
    40% { background: highlight; color: highlighttext; }
}
@keyframes c-7 {
    40%, 60% { background: none; color: unset; }
    50% { background: highlight; color: highlighttext; }
}
@keyframes c-8 {
    50%, 70% { background: none; color: unset; }
    60% { background: highlight; color: highlighttext; }
}
@keyframes c-9 {
    60%, 80% { background: none; color: unset; }
    70% { background: highlight; color: highlighttext; }
}
@keyframes c-10 {
    80%, 100% { background: none; color: unset; }
    90% { background: highlight; color: highlighttext; }
}
</style>

## Scaling

The above implementation works, but the single wait could cause a lot of unnecessary contention if many threads are waiting on different futexes.
We could reduce that contention by having multiple wait queues, and using a hash function to assign each futex to a (hopefully) different wait queue.

```c
struct waitq table[TABLE_SIZE];

// Use the address of the futex to pick a wait queue
struct waitq *get_waitq(atomic_int *futex) {
    size_t i = hash((uintptr_t)futex);
    return &table[i % TABLE_SIZE];
}
```

That's basically what the [actual futex implementation](https://github.com/torvalds/linux/blob/master/kernel/futex/core.c) does.
It's also what WebKit's [ParkingLot](https://webkit.org/blog/6161/locking-in-webkit/) does, and in general it's a very useful trick for reducing contention.
