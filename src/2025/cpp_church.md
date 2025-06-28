# Taking the C preprocessor to Church

<div class="infobar">

*fa-clock-o* *time-2025-06-26*
*fa-user* Tavian Barnes

</div>

<style>
.content hr {
    border: none;
    color: var(--fg);
    font-size: x-large;
    text-align: center;
}
.content hr:after {
    content: "❧";
}
</style>

Imagine this: the year is 1983.
C++ has introduced *function prototypes*, bringing type-checking to function calls for the first time.

```c++
int foo(int n);
...
foo(1, 2); // Error!
```

To support variadic functions like `printf()`, a new syntax is invented:

```c++
int printf(const char *format...);
```

---

It's now December 13, 1989.
Taylor Swift is born.
The next day, the first version of the C language standard is published.
It [borrows function prototypes from C++](https://en.wikipedia.org/wiki/C_(programming_language)#ANSI_C_and_ISO_C), but [changes the variadic function syntax](https://en.cppreference.com/w/cpp/language/variadic_arguments.html#Notes) to

```c
int printf(const char *format, ...);
```

(Note the comma.)

---

It's the year 1999.
Taylor Swift turns 10.
C programmers have noticed that variadic *functions* exist, but variadic *macros* do not.
So, while you can write

```c
#define my_printf printf
```

you can't write

```c
#define println(format, ...) \
	printf(format "\n", ...)
```

Not to fear, the 1999 C standard adds variadic macros, but it spells them kind of weirdly:

```c
#define println(format, ...) \
	printf(format "\n", __VA_ARGS__)
```

---

It's the year 2000.
Taylor Swift turns 11.
After narrowly surviving the Y2K problem, people begin to notice that you still can't write the `println()` macro above.
Sure, things like

```c
println("Hello %s!", "world");
```

work fine, but this is broken:

```c
println("Hello world!");
// Error: not enough arguments
```

Since the macro definition has a comma, uses must also include at least one comma, according to the letter of the law.
Some compilers allow you to omit the comma as an extension, but that still doesn't work:

```c
println("Hello world!");
// => printf("Hello world!" "\n", );
//
// Error: expected expression after `,'
```

If you're clever, you might figure out this contortion:

```c
// Ensure we pass at least one comma
#define println(...) \
	println_(__VA_ARGS__, )

#define println_(format, ...) \
	printf(format "%s", __VA_ARGS__ "\n")

println("Hello world!");
// => println_("Hello world!", );
// => printf("Hello world!" "%s", "\n");

println("Hello %s!", "world");
// => println_("Hello %s!", "world", );
// => printf("Hello %s!" "%s", "world", "\n");
```

But that kinda sucks.
At least GCC [implements an extension](https://gcc.gnu.org/git/?p=gcc.git;a=commit;h=5ef865d5709f9c917e1152ee5246906983e23725) which can suppress the comma when you want to:

```c
#define println(format, ...) \
	printf(format "\n", ##__VA_ARGS__)

println("Hello world!");
// => printf("Hello world!" "\n");

println("Hello %s!", "world");
// => printf("Hello %s!" "\n", "world");
```

---

The year is 2020.
Taylor Swift turns 31.
C++ finally standardizes [a way to write `println()` easily](https://en.cppreference.com/w/cpp/preprocessor/replace).
It's not the same as the GCC extension though; it looks like this:

```c++
#define println(format, ...) \
	printf(format "\n" __VA_OPT__(,) __VA_ARGS__)

println("Hello world!");
// => printf("Hello world!" "\n");
// (since __VA_ARGS__ is empty, `__VA_OPT__(,)` is removed)

println("Hello %s!", "world");
// => printf("Hello %s!" "\n", "world");
// (since __VA_ARGS__ is non-empty, `__VA_OPT__(,)` becomes `,`)
```

---

The year is 2024.
Taylor swift turns 35.
ISO publishes the 2023 [sic] version of the C language standard, which copies `__VA_OPT__` from C++.
At long last, we can write variadic macros in standard C that don't make our eyes bleed.

---

`__VA_OPT__` is actually more powerful than the `, ##__VA_ARGS__` extension.
To prove it, let's write an improved `ASSERT()` macro that takes an *optional* message with a format string and arguments.

```c
ASSERT(1 == 2);
// foo.c:1: assertion failed: `1 == 2`

ASSERT(1 == 2, "%s isn't %s", "one", "two");
// foo.c:4: one isn't two
```

We can implement this with a nifty helper macro

```c
IF(A)(B)(C)
// => B

IF()(B)(C)
// => C
```

This is basically the [Church encoding of if-then-else](https://en.wikipedia.org/wiki/Church_encoding#Church_Booleans).
It's implemented like this:

```c
#define IF(...) IF_AB ## __VA_OPT__(C)
// IF( )(B)(C) => IF_AB(B)(C)
// IF(A)(B)(C) => IF_ABC(B)(C)

#define IF_AB(...) REPEAT
// IF_AB(B)(C) => REPEAT(C)

#define IF_ABC(...) __VA_ARGS__ IGNORE
// IF_ABC(B)(C) => B IGNORE(C)

#define REPEAT(...) __VA_ARGS__
#define IGNORE(...)
```

We can use this in `ASSERT` like this:

```c
#define ASSERT(expr, ...) \
	((expr) ? (void)0 : IF(__VA_ARGS__) \
		(ABORTF(__VA_ARGS__)) \
		(ABORTF("assertion failed: `%s`", #expr)))

#define ABORTF(format, ...) \
	fprintf(stderr, "%s:%d: " format "\n", \
		__FILE__, __LINE__ __VA_OPT__(,) __VA_ARGS__)

ASSERT(1 == 2);
// => ((1 == 2)
//        ? (void)0
//        : ABORTF("assertion failed: `%s`", "1 == 2"));
//          => fprintf(stderr,
//                 "%s:%d: " "assertion failed: `%s`" "\n",
//                 __FILE__, __LINE__, "1 == 2")

ASSERT(1 == 2, "%s isn't %d", "one", "two");
// => ((1 == 2)
//        ? (void)0
//        : ABORTF("%s isn't %s", "one", "two")
//          => fprintf(stderr,
//                 "%s:%d: " "%s isn't %s" "\n",
//                 __FILE__, __LINE__, "one", "two")
```

---

It's possible to write a similar macro without `__VA_OPT__`, but it's much more convoluted:

```c
#define ASSERT(...) \
	ASSERT_(#__VA_ARGS__, __VA_ARGS__, "", )

#define ASSERT_(str, expr, format, ...) \
	((expr) ? (void)0 : ABORTF(format, sizeof(format) > 1 ? "" : str, __VA_ARGS__))

#define ABORTF(format, ...) \
	fprintf(stderr, \
		sizeof(format) > 1 \
			? "%s:%d: %s" format "%s%s" \
			: "%s:%d: assertion failed: `%s`%s", \
		__FILE__, __LINE__, __VA_ARGS__ "\n")

ASSERT(1 == 2);
// => ASSERT_("1 == 2", 1 == 2, "", )
// => ((1 == 2)
//        ? (void 0)
//        : ABORTF("", sizeof("") > 1 ? "" : "1 == 2", ));
//          => fprintf(stderr,
//                 sizeof("") > 1
//                     ? "%s:%d: %s" "" "%s%s"
//                     : "%s:%d: assertion failed: `%s`%s",
//                 __FILE__, __LINE__, sizeof("") > 1 ? "" : "1 == 2", "\n")
//          == fprintf(stderr,
//                 "%s:%d: assertion failed: `%s`%s",
//                 __FILE__, __LINE__, "1 == 2", "\n")


ASSERT(1 == 2, "%s isn't %s", "one", "two");
// => ASSERT_(
//        "1 == 2, \"%s isn't %s\", \"one\", \"two\"",
//        1 == 2, "%s isn't %s", "one", "two", "", )
// => ((1 == 2)
//        ? (void 0)
//        : ABORTF("%s isn't %s",
//              sizeof("%s isn't %s") > 1
//                  ? ""
//                  : "1 == 2, \"%s isn't %s\", \"one\", \"two\"",
//              "one", "two", "", ));
//          => fprintf(stderr,
//                 sizeof("%s isn't %s") > 1
//                     ? "%s:%d: %s" "" "%s%s"
//                     : "%s:%d: assertion failed: `%s`%s",
//                 __FILE__, __LINE__,
//                 sizeof("%s isn't %s") > 1
//                     ? ""
//                     : "1 == 2, \"%s isn't %s\", \"one\", \"two\"",
//                 "one", "two", "", "\n")
//          == fprintf(stderr,
//                 "%s:%d: %s" "%s isn't %s" "%s%s",
//                 __FILE__, __LINE__, "", "one", "two", "", "\n");
```
