# Standards-compliant\* alloca()

<div class="infobar">

<fa:clock-o> 2014-07-31
<fa:user> Tavian Barnes
[<fa:reddit> Reddit](https://www.reddit.com/r/C_Programming/comments/2cdpmd/standardscompliant_alloca/)

</div>


The `alloca()` function in C is used to allocate a dynamic amount of memory on the stack.
Despite its [advantages] in some situations, it is non-standard and will probably remain so forever.

[`alloca()`]: https://man7.org/linux/man-pages/man3/alloca.3.html
[advantages]: https://www.gnu.org/software/libc/manual/html_node/Advantages-of-Alloca.html

There's a feature of C99 (made optional in C11) called `variable-length arrays` (VLAs for short) that works in many of the same situations. So instead of something like this:

```c
char *path = alloca(strlen(dir) + strlen(file) + 2);
sprintf(path, "%s/%s", dir, file);
```

you can write this and have a conforming program:

```c
char path[strlen(dir) + strlen(file) + 2];
sprintf(path, "%s/%s", dir, file);
```

But sometimes VLAs aren't quite as powerful as `alloca()`.
The most recent example I encountered was trying to allocate a struct with a [flexible array member] on the stack. Here's a simpler example:

[flexible array member]: https://www.google.ca/search?q=flexible+array+member


Imagine a library author has hidden the definition of a struct to ensure better forward-compatibility.
To allow clients to allocate the struct on the stack, she makes the size of the structure available in a global variable, intended to be used like this:

```c
// Library header
struct foo;
extern const size_t foo_size /* = sizeof(struct foo) */;

// Client code
void bar(void) {
    struct foo *foo = alloca(foo_size);
}
```

If we try to replace the `alloca()` with a VLA, we get this:

```c
// Client code
void bar(void) {
    char buffer[foo_size];
    struct foo *foo = (struct foo *)buffer;
}
```

Unfortunately that's not quite standards-compliant, because buffer likely has a weaker alignment requirement than foo.
Furthermore, char can't be replaced with any other type, because that would violate strict aliasing rules*.

C11 provides us with a solution: the `alignas` specifier. Using it, we can force the memory block to have the strictest possible alignment:

```c
#include <stdalign.h>

void bar(void) {
    alignas(max_align_t) char buffer[foo_size];
    struct foo *foo = (struct foo *)buffer;
}
```

The ugliness can be hidden inside a macro that's almost as convenient as `alloca()`:

```c
#if __STDC_VERSION__ < 201112L || defined(__STDC_NO_VLA__)
#error "C11 with VLAs is required"
#endif

#include <stdalign.h>

#define ALLOCA(var, size)             \
    ALLOCA2(var, size, __LINE__)
#define ALLOCA2(var, size, unique_id) \
    ALLOCA3(var, size, unique_id)
#define ALLOCA3(var, size, unique_id)                         \
    alignas(max_align_t) char alloca_buffer##unique_id[size]; \
    var = (void *)alloca_buffer##unique_id

void bar(void) {
    ALLOCA(struct foo *foo, foo_size);
}
```

Aside from the slightly uglier syntax, the only difference is in the lifetime of the allocation.
Traditionally, memory allocated with `alloca()` is freed at the end of the calling *function*, while VLAs are freed ad the end of the enclosing *block*.

<ins>*Reddit user [nooneofnote] points out that there is still an aliasing issue, because while `char *` can alias any other type, other types may not necessarily alias an array of `char`.
This trick does work in practice but is sadly not as compliant as I thought.</ins>

[nooneofnote]: http://www.reddit.com/user/nooneofnote
