# Translucent typedefs in C

<div class="infobar">

*fa-clock-o* *time-2023-09-27*
*fa-user* Tavian Barnes

</div>

As part of [`bfs`](projects/bfs.md), I wrote a dynamic string library somewhat similar to [SDS](https://github.com/antirez/sds).
Dynamic strings store their capacity and length right before the string itself in memory, using a flexible array member.

```c
struct dstring {
    size_t capacity;
    size_t length;
    char data[];
};
```

Dynamic string functions take and return pointers to the `data` array directly.

```c
char *dstralloc(void) {
    struct dstring *header = calloc(sizeof(*header) + 1, 1);
    return header ? header->data : NULL;
}

size_t dstrlen(const char *dstr) {
    const struct dstring *header = dstr - offsetof(struct dstring, data);
    return header->length;
}

int dstrcat(char **dstr, const char *src) {
    ...
```

This has the huge advantage that dynamic strings are API-compatible with regular C strings,

```c
// Pretend I checked for errors
char *dstr = dstralloc();
dstrcat(&dstr, "Hello ");
dstrcat(&dstr, "world!");
assert(strcmp(dstr, "Hello world!") == 0);
```

while providing useful features like `$O(1)$` `dstrlen()` and support for embedded NUL (`\0`) bytes.

Unfortunately, this compatibility only works one way: if you pass a non-dynamic string to a `dstr*()` function, you'll get garbage:

```c
// Returns whatever is before the string constant in memory
dstrlen("Hello world!");
```

[Sanitizers may not even detect this error!](https://godbolt.org/z/9cfzv1Y8d)
So it would be nice if we could catch it at compile time.


## Transparency

As a start, let's make a typedef so it's clear which strings are supposed to be dynamic in the API.

```c
typedef char dchar;

dchar *dstralloc(void);
size_t dstrlen(const dchar *dstr);
int dstrcat(dchar **dstr, const char *src);
...
```

This works as documentation, but it doesn't add any additional type-safety because `typedef`s are *transparent*: the compiler sees right through them, treating `char *` and `dchar *` as exactly the same type.

```c
dchar *dstr = dstralloc();
char *str = dstr;   // No warning (good)
len = dstrlen(str); // No warning (bad)
len = dstrlen("");  // No warning (bad)
strcmp(str, dstr);  // No warning (good)
```


## Opacity

On the other side of the spectrum would be *opaque* type aliases: a `dchar` type that is genuinely diferent (but somehow compatible with) `char`.
C doesn't support opaque type aliases in general, but in this case we can literally just use a different type.

```c
typedef unsigned char dchar;

dchar *dstr = dstralloc();
char *str = dstr;   // Warning (annoying)
len = dstrlen(str); // Warning (good)
len = dstrlen("");  // Warning (good)
strcmp(str, dstr);  // Warning (annoying)
```

This adds some desirable warnings, but it also adds a warning every time we use a dynamic string as a regular `char *`.
Ideally, we'd be somewhere between these two extremes, allowing conversions from `dchar *` to `char *`, but warning in the other direction.


## Translucency

We could call this a "translucent" typedef, since it's between *transparent* and *opaque*.
(Even better might be a "one-way" type alias, like a [one-way mirror](https://en.wikipedia.org/wiki/One-way_mirror), since it should be transparent in only one direction.)

The established terminology here is [*subtyping*](https://en.wikipedia.org/wiki/Subtyping): we want `dchar *` to be a subtype of `char *`, so that every `dchar *` is-a `char *`, but not every `char *` is-a `dchar *`.
Unfortunately, C doesn't have any notion of subtyping, and even C++ doesn't have it for primitive types.

... or at least, *standard* C doesn't.
There is a widely-supported C extension that sort of acts like subtyping: aligned types.

```c
typedef __attribute__((aligned(2))) char dchar;
```

An *alignment* of 2 means that a `dchar *` must point to an address that is a multiple of 2.
Standard C does have a notion of [alignment](https://en.cppreference.com/w/c/language/object#Alignment), but the standard [`alignas()` specifier](https://en.cppreference.com/w/c/language/_Alignas) can't be applied to a typedef, so I had to use the GNU-style attribute instead.

Every multiple of 2 is-a multiple of 1, but not every multiple of 1 is-a multiple of 2, so this acts like our desired subtyping relationship!
Clang's `-Walign-mismatch` will even check it for us.

```
foo.c:13:17: warning: passing 1-byte aligned argument to 2-byte aligned parameter 1 of
'dstrlen' may result in an unaligned pointer access [-Walign-mismatch]
  len = dstrlen(str);
                ^
foo.c:14:17: warning: passing 1-byte aligned argument to 2-byte aligned parameter 1 of
'dstrlen' may result in an unaligned pointer access [-Walign-mismatch]
  len = dstrlen("");
                ^
2 warnings generated.
```

There we go: warnings exactly where I wanted them, and nowhere else.
Not the most easily-understandable warnings, I admit, but good enough for me.


## Safety

`malloc()` returns pointers [suitably aligned for any fundamental type](https://en.cppreference.com/w/c/memory/malloc), which is typically much higher than 2, so the alignment annotation should be safe.
To be extra careful, you could write

```c
struct dstring {
    size_t capacity;
    size_t length;
    alignas(dchar) char data[];
};

static_assert(alignof(max_align_t) >= alignof(dchar),
              "malloc() doesn't guarantee enough alignment");
```

Careful readers will note that I said "should be safe" instead of "is safe" above.
That's because another popular compiler, GCC, [considers `dstr[1]` to be undefined behaviour](https://godbolt.org/z/a5qWPaccb):

```
foo.c:24:16: runtime error: load of misaligned address 0x0000010e72c1 for type 'dchar',
which requires 2 byte alignment
0x0000010e72c1: note: pointer points here
 00 00 00  48 65 6c 6c 6f 20 77 6f  72 6c 64 21 00 00 00 00  00 00 00 00 00 00 00 00
              ^
```

`dstr[1]` is [equivalent to](https://en.cppreference.com/w/c/language/operator_member_access#Subscript) `*(dstr + 1)`, and `dstr + 1` is not a properly aligned `dchar *`.
Clang doesn't seem to care, but GCC does, so when I [implemented this](https://github.com/tavianator/bfs/commit/dccb52556730ff060bcccbe764cef4b13b3d5712#diff-319350914e95c33f8e1b87ee6071a82a38e0644230a70c81a43b7d333dc37ceb) in `bfs` I restricted it to Clang.
I'm still a little scared, since Clang still thinks `alignof(__typeof__(dstr[1])) == 2`, so I may move it to a separate compile-only build mode before the next release.
