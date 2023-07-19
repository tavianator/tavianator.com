# `spawn()` of Satan

<div class="infobar">

<fa:clock-o> 2018-09-21
<fa:user> Tavian Barnes
[<fa:reddit> Reddit](https://www.reddit.com/r/programming/comments/9hrxig/spawn_of_satan/)

</div>


The "[Unix philosophy]" is all about small programs that do one thing well, but easily work together to accomplish complicated things.
The summary I'm most familiar with is Peter H. Salus's

[Unix philosophy]: https://en.wikipedia.org/wiki/Unix_philosophy

> - Write programs that do one thing and do it well.
> - Write programs to work together.
> - Write programs to handle text streams, because that is a universal interface.

The Unix creators themselves, Ken Thompson and Dennis Ritchie, listed as their first design consideration

> - Make it easy to write, test, and run programs.

One could reasonably assume, then, that it would be easy to *write* a program that *runs* other programs, in the programming language of Unix (C).
Maybe something like this:

```c
pid_t pid = spawn("echo", "Hello", "World!", NULL);
```

But anyone familiar with Unix programming knows that's not how it works.
Rather than creating new processes from scratch, you first create an exact copy of yourself with `fork()`, then use `exec()` to replace that copy with what you wanted to execute.

```c
pid_t pid = fork();
if (pid < 0) {
	perror("fork()");
} else if (pid == 0) {
	// Child
	execlp("echo", "echo", "Hello", "World!", NULL);
	// If exec() returns, it failed
	perror("execlp()");
} else {
	// Parent
}
```


## The good

`fork()` and `exec()` seem like weird primitives to provide at first.
With most things in life, we think about creating them by building them up out of their constituents, not by first copying something else and then molding the copy into what you wanted.
But despite the apparent strangeness, `fork()` and `exec()` are actually pretty convenient once you want to do anything slightly more complicated than just launch a new process.

Want to run the new process in a new working directory?
Or launch it with reduced privileges?
Maybe redirect its standard streams to files or pipe it to another process?
With the `fork()`/`exec()` model, that's all easy: just do whatever you want to do after `fork()` and before `exec()`.

```c
...
} else if (pid == 0) {
	// This is something like the shell command
	//     cd ~; grep -ri 'password' >passwords 2>/dev/null
	// (error checking omitted)
	const char *home = getpwuid(getuid())->pw_dir;
	chdir(home);
	dup2(open("passwords", O_WRONLY), STDOUT_FILENO);
	dup2(open("/dev/null", O_WRONLY), STDERR_FILENO);
	execlp("grep", "grep", "-ri", "password", NULL);
} ...
```

If you had some API that combined everything into one call, you'd need parameters for every possible thing you might want to customize about the new process. Windows, for example, has
[at](https://docs.microsoft.com/en-us/windows/desktop/api/processthreadsapi/nf-processthreadsapi-createprocessw)
[least](https://docs.microsoft.com/en-us/windows/desktop/api/processthreadsapi/nf-processthreadsapi-createprocessasuserw)
[four](https://docs.microsoft.com/en-us/windows/desktop/api/winbase/nf-winbase-createprocesswithtokenw)
[variants](https://docs.microsoft.com/en-us/windows/desktop/api/winbase/nf-winbase-createprocesswithlogonw)
of the `CreateProcess()` function, each taking 10+ arguments.


## The bad

Even once you're used to the strangeness of `fork()`, it does have a few real downsides.
For one, it's slow.
Though we're long passed the days when the entire memory of the forking process had to be copied, a modern copy-on-write `fork()` implementation still has to copy metadata like page tables that grows with the size of the process's address space.
This makes `fork()` slow for big processes, and that work is often wasted if the forked process is just going to `exec()` soon.
There is an alternative, `vfork()`, which doesn't do any unnecessary copying, but it's [difficult] to use safely.
`vfork()` creates something more like a new thread than a new process, where the child shares memory with the parent.
The child must then be arduously careful to avoid corrupting the parent's state, negating many of the "good" things above about `fork()`.

[difficult]: https://ewontfix.com/7/

Another downside to `fork()` is that it's basically impossible to use safely from a multithreaded program.
`fork()` copies just the calling thread, potentially in the middle of operations by other threads.
If, for example, another thread had locked a mutex (maybe within some implementation detail of a C library function like `malloc()`), it will remain locked in the child process, easily leading to deadlock.
POSIX provides `pthread_atfork()` as an attempt to mitigate this, but its [man page] notes

[man page]: https://man7.org/linux/man-pages/man3/pthread_atfork.3.html

> The intent of `pthread_atfork()` was to provide a mechanism whereby the application (or a library) could ensure that mutexes and other process and thread state would be restored to a consistent state.
> In practice, this task is generally too difficult to be practicable.
>
> After a `fork(2)` in a multithreaded process returns in the child, the child should call only async-signal-safe functions (see `signal-safety(7)`) until such time as it calls `execve(2)` to execute a new program.

`fork()` is also basically impossible to implement on systems without an MMU, since the parent and child should share pointer values that refer to different objects in memory.


## The ugly

There is an attempt to mitigate these issues called `posix_spawn()`.
Like other such APIs, it supports a laundry list of configuration options for flexibility in launching the new process.
The above example might be rewritten like this using `posix_spawn()`:

```c
#include <spawn.h>

// Error checking omitted
posix_spawn_file_actions_t actions;
posix_spawn_file_actions_init(&actions);
posix_spawn_file_actions_addopen(&actions, STDOUT_FILENO, "passwords", O_WRONLY, 0);
posix_spawn_file_actions_addopen(&actions, STDERR_FILENO, "/dev/null", O_WRONLY, 0);

const char *home = getpwuid(getuid())->pw_dir;
// No posix_spawn() API to do this in the child, so do it in the parent
chdir(home);

char *argv[] = {"grep", "-ri", "password", NULL};
extern char **environ;

pid_t pid;
int ret = posix_spawnp(&pid, "grep", &actions, NULL, argv, environ);
if (ret != 0) {
	errno = ret;
	perror("posix_spawnp()");
}
```

Spawning processes is inherently complex, but `posix_spawn()` is unnecessarily complicated and verbose while still being too limited and incomplete for many use cases.
The API looks like this:

```c
int posix_spawn(pid_t *pid, const char *path,
                const posix_spawn_file_actions_t *file_actions,
                const posix_spawnattr_t *attrp,
                char *const argv[], char *const envp[]);
int posix_spawnp(pid_t *pid, const char *file,
                 const posix_spawn_file_actions_t *file_actions,
                 const posix_spawnattr_t *attrp,
                 char *const argv[], char *const envp[]);
```

`posix_spawnp()` is like `posix_spawn()` but it resolves the executable on your `PATH`, like `execvp()` vs. `execv()`.
But these functions already take a fair few parameters, including an attributes object (`posix_spawnattr_t`) with its own flags.
Surely, whether to search the `PATH` could have been controlled with a flag like `POSIX_SPAWN_USEPATH` instead.

The calling convention is unfamiliar and inconsistent with the rest of POSIX.
`posix_spawn()` returns 0 on success, and a (positive) error code on failure.
In contrast, `fork()` returns the new process ID on success, or -1 on failure, with the error code in `errno`.
This convention would save one function parameter, and make error handling more uniform with the rest of POSIX.

The two types `posix_spawn_file_actions_t` and `posix_spawnattr_t` both control various things about the new process.
We could save another parameter, and a whole lot of typing, by merging these into one type with a shorter name.
In my opinion, this would be a better interface:

```c
pid_t posix_spawn(const char *file, const posix_spawn_t *attrs,
                  char *const argv[], char *const envp[]);
```

Its use would look something like this:

```c
posix_spawn_t attrs;
posix_spawn_init(&attrs);
posix_spawn_setflags(&attrs, POSIX_SPAWN_USEPATH);

const char *home = getpwuid(getuid())->pw_dir;
posix_spawn_addchdir(&attrs, home);
posix_spawn_addopen(&attrs, STDOUT_FILENO, "passwords", O_WRONLY, 0);
posix_spawn_addopen(&attrs, STDERR_FILENO, "/dev/null", O_WRONLY, 0);

char *argv[] = {"grep", "-ri", "password", NULL};
pid_t pid = posix_spawn("grep", &attrs, argv, NULL);
if (pid < 0) {
	perror("posix_spawn()");
}
```


## Lies

The `posix_spawn()` specification has a section *Asynchronous Error Notification* that says

> A library implementation of `posix_spawn()` or `posix_spawnp()` may not be able to detect all possible errors before it forks the child process. …
>
> Thus, no special macros are available to isolate asynchronous `posix_spawn()` or `posix_spawnp()` errors.
> Instead, errors detected by the `posix_spawn()` or `posix_spawnp()` operations in the context of the child process before the new process image executes are reported by setting the child's exit status to 127.

Many important error conditions can only be detected by this special 127 error code.
This includes things like non-existent executables, failures in any of the file actions, and overlong argument lists.
None of these conditions can be distinguished from each other, and furthermore none of them can be distinguished from a successfully launched program returning 127 for some other reason.

The standard states that nothing could be done about this because no more information is available from `wait()` and they didn't want to extend it just for `posix_spawn()`.
But `wait()` is not the only available method of interprocess communication!
Rich Felker, author of the musl C standard library, [realized] it could easily be easily achieved with pipes, something like this:

[realized]: https://www.openwall.com/lists/musl/2012/12/31/16

```c
int ret;

int pipefd[2];
if (pipe2(pipefd, O_CLOEXEC) != 0) {
	return errno;
}

*pid = fork();
if (*pid < 0) {
	ret = errno;
	close(pipefd[1]);
	close(pipefd[0]);
} else if (*pid == 0) {
	// Child
	close(pipefd[0]);

	execve(path, argv, envp);

	// exec() failed, write errno to the pipe
	ret = errno;
	while (write(pipefd[1], &ret, sizeof(ret)) < sizeof(ret));
	close(pipefd[1]);
	_Exit(127);
} else {
	// Parent
	close(pipefd[1]);

	// Read errno from the pipe
	if (read(pipefd[0], &ret, sizeof(ret)) == sizeof(ret)) {
		// Error occurred, clean up the process
		int wstatus;
		waitpid(*pid, &wstatus, 0);
	} else {
		// No error
		ret = 0;
	}
	close(pipefd[0]);
}

return ret;
```


## Omissions

Several potentially convenient things are missing from the specification.
Most frustrating for me is the lack of `posix_spawn_file_actions_add[f]chdir()`, though there is now a proposal to add it to the next version (at my [suggestion]).

[suggestion]: http://lists.gnu.org/archive/html/bug-findutils/2018-09/msg00002.html

Another thing notably missing from POSIX is the `execvpe()` function, an `exec()` that lets you specify both the argument vector and environment variables while following the `PATH`.
This would be helpful for implementing `posix_spawnp()`.
Luckily there's a cheeky way to emulate it:

```c
int execvpe(const char *file, char *const argv[], char *const envp[]) {
	extern char **environ;
	environ = envp; // Yeah, just clobber the global variable
	return execvp(file, argv);
}
```

For more general use, one would need to be more careful about things like thread safety and restoring the original environment on failure.
But it's good enough for `posix_spawnp()` since we've already `fork()`ed.


## Redemption

I'm not just venting frustration — I've decided to do something about all this by writing a replacement `spawn()`-type [API] [here].
It's part of [`bfs`], but it should be fairly self-contained.
If there's enough interest I could separate it out into its own project.

[API]: https://github.com/tavianator/bfs/blob/main/src/xspawn.h
[here]: https://github.com/tavianator/bfs/blob/main/src/xspawn.c
[`bfs`]: https://github.com/tavianator/bfs
