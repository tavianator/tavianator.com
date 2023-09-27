# Java autoboxing performance

<div class="infobar">

*fa-clock-o* *time-2015-07-11*
*fa-user* Tavian Barnes
[*fa-comments* Comments](#comments)
[*fa-reddit* Reddit](https://www.reddit.com/r/programming/comments/3cxl8s/java_autoboxing_performance/)

</div>


In Java, primitives (`int`, `double`, `char`) are not `Object`s.
But since a lot of Java code requires `Object`s, the language provides *boxed* versions of all primitive types (`Integer`, `Double`, `Character`).
Autoboxing allows you to write code like

```java
Character boxed = 'a';
char unboxed = boxed;
```

which is desugared into

```java
Character boxed = Character.valueOf('a');
char unboxed = boxed.charValue();
```

Unfortunately, the Java Virtual Machine can't always see through this process, so avoiding unnecessary boxing is often key to getting good performance.
That's why specialized types like `OptionalInt` and `IntStream` exist, for example.
In this post, I'm going to outline one of the reasons that autoboxing is hard for the JVM to eliminate.


## The scenario

For a motivating example, lets say we want a generic Levenshtein distance computation that works on any type of data that can be viewed as a sequence:

[Levenshtein distance]: https://en.wikipedia.org/wiki/Levenshtein_distance

```java
public class Levenshtein<T, U> {
    private final Function<T, List<U>> asList;

    public Levenshtein(Function<T, List<U>> asList) {
        this.asList = asList;
    }

    public int distance(T a, T b) {
        // Wagner-Fischer algorithm, with two active rows

        List<U> aList = asList.apply(a);
        List<U> bList = asList.apply(b);

        int bSize = bList.size();
        int[] row0 = new int[bSize + 1];
        int[] row1 = new int[bSize + 1];

        for (int i = 0; i <= bSize; ++i) {
            row0[i] = i;
        }

        for (int i = 0; i < bSize; ++i) {
            U ua = aList.get(i);
            row1[0] = row0[0] + 1;

            for (int j = 0; j < bSize; ++j) {
                U ub = bList.get(j);
                int subCost = row0[j] + (ua.equals(ub) ? 0 : 1);
                int delCost = row0[j + 1] + 1;
                int insCost = row1[j] + 1;
                row1[j + 1] = Math.min(subCost, Math.min(delCost, insCost));
            }

            int[] temp = row0;
            row0 = row1;
            row1 = temp;
        }

        return row0[bSize];
    }
}
```

As long as your objects can be viewed as a `List<U>`, this class can compute the edit distance between them.
Now we're probably going to want to compute the distance between `Strings`, so we need a way to view a `String` as a `List`:

```java
public class StringAsList extends AbstractList<Character> {
    private final String str;

    public StringAsList(String str) {
        this.str = str;
    }

    @Override
    public Character get(int index) {
        return str.charAt(index); // Autoboxing!    }

    @Override
    public int size() {
        return str.length();
    }
}

...

Levenshtein<String, Character> lev = new Levenshtein<>(StringAsList::new);
lev.distance("autoboxing is fast", "autoboxing is slow"); // 4
```

Because of [the way Java generics are implemented], we can't have a `List<char>`, so we settle for a `List<Character>` and all the boxing that entails.
*(As a side note, this limitation may be [lifted] in Java 10.)*

[the way Java generics are implemented]: https://stackoverflow.com/q/2721546/502399
[lifted]: https://openjdk.java.net/jeps/218


## Benchmarking

To see what kind of performance we're getting, we need to benchmark the `distance()` method.
Microbenchmarking is very hard to get right in Java, but luckily OpenJDK ships a tool called [JMH] (Java Microbenchmark Harness) that does most of the hard work for us.
If you're interested, I recommend reading the documentation and [samples]; it's fascinating stuff.
Here's the benchmark:

[JMH]: https://openjdk.java.net/projects/code-tools/jmh/
[samples]: https://hg.openjdk.java.net/code-tools/jmh/file/tip/jmh-samples/src/main/java/org/openjdk/jmh/samples/

```java
@State(Scope.Benchmark)
public class MyBenchmark {
    private Levenshtein<String, Character> lev = new Levenshtein<>(StringAsList::new);

    @Benchmark
    @BenchmarkMode(Mode.AverageTime)
    @OutputTimeUnit(TimeUnit.NANOSECONDS)
    public int timeLevenshtein() {
        return lev.distance("autoboxing is fast", "autoboxing is slow");
    }
}
```

*(Returning the value from the method allows JMH to do some [gymnastics] to convince the runtime that the value is used, preventing [dead-code elimination] from screwing with the results.)*

[gymnastics]: https://hg.openjdk.java.net/code-tools/jmh/file/tip/jmh-core/src/main/java/org/openjdk/jmh/infra/Blackhole.java
[dead-code elimination]: https://hg.openjdk.java.net/code-tools/jmh/file/tip/jmh-samples/src/main/java/org/openjdk/jmh/samples/JMHSample_08_DeadCode.java

And here are the results:

```
$ java -jar target/benchmarks.jar -f 1 -wi 8 -i 8
# JMH 1.10.2 (released 3 days ago)
# VM invoker: /usr/lib/jvm/java-8-openjdk/jre/bin/java
# VM options:
# Warmup: 8 iterations, 1 s each
# Measurement: 8 iterations, 1 s each
# Timeout: 10 min per iteration
# Threads: 1 thread, will synchronize iterations
# Benchmark mode: Average time, time/op
# Benchmark: com.tavianator.boxperf.MyBenchmark.timeLevenshtein

# Run progress: 0.00% complete, ETA 00:00:16
# Fork: 1 of 1
# Warmup Iteration   1: 1517.495 ns/op
# Warmup Iteration   2: 1503.096 ns/op
# Warmup Iteration   3: 1402.069 ns/op
# Warmup Iteration   4: 1480.584 ns/op
# Warmup Iteration   5: 1385.345 ns/op
# Warmup Iteration   6: 1474.657 ns/op
# Warmup Iteration   7: 1436.749 ns/op
# Warmup Iteration   8: 1463.526 ns/op
Iteration   1: 1446.033 ns/op
Iteration   2: 1420.199 ns/op
Iteration   3: 1383.017 ns/op
Iteration   4: 1443.775 ns/op
Iteration   5: 1393.142 ns/op
Iteration   6: 1393.313 ns/op
Iteration   7: 1459.974 ns/op
Iteration   8: 1456.233 ns/op


Result "timeLevenshtein":
  1424.461 ±(99.9%) 59.574 ns/op [Average]
  (min, avg, max) = (1383.017, 1424.461, 1459.974), stdev = 31.158
  CI (99.9%): [1364.887, 1484.034] (assumes normal distribution)


# Run complete. Total time: 00:00:16

Benchmark                    Mode  Cnt     Score    Error  Units
MyBenchmark.timeLevenshtein  avgt    8  1424.461 ± 59.574  ns/op
```


## Analysis

In order to see what's happening on the hot path(s) of your code, JMH integrates with the Linux tool [perf] to show you the JIT-compiled assembly of the hottest code regions.
*(To view the assembly, you'll need the hsdis plugin for your platform. If you're running Arch, I have [packaged it for you] on the AUR.)*
Simply add `-prof perfasm` to the JMH command line to see the results:

[perf]: https://perf.wiki.kernel.org/index.php/Main_Page
[packaged it for you]: https://aur.archlinux.org/packages/java8-openjdk-hsdis/

```x86asm
$ java -jar target/benchmarks.jar -f 1 -wi 8 -i 8 -prof perfasm
...
cmp    $0x7f,%eax
jg     0x00007fde989a6148  ;*if_icmpgt
                           ; - java.lang.Character::valueOf@3 (line 4570)
                           ; - com.tavianator.boxperf.StringAsList::get@8 (line 14)
                           ; - com.tavianator.boxperf.StringAsList::get@2 (line 5)
                           ; - com.tavianator.boxperf.Levenshtein::distance@121 (line 32)
cmp    $0x80,%eax
jae    0x00007fde989a6103  ;*aaload
                           ; - java.lang.Character::valueOf@10 (line 4571)
                           ; - com.tavianator.boxperf.StringAsList::get@8 (line 14)
                           ; - com.tavianator.boxperf.StringAsList::get@2 (line 5)
                           ; - com.tavianator.boxperf.Levenshtein::distance@121 (line 32)
...
```

There's a lot of output, but sections like the above indicate that the boxing hasn't been optimized out.
And what's the deal with the comparisons to `0x7f`/`0x80`? The answer is in the source for `Character.valueOf()`:

```java
    private static class CharacterCache {
        private CharacterCache(){}

        static final Character cache[] = new Character[127 + 1];

        static {
            for (int i = 0; i < cache.length; i++)
                cache[i] = new Character((char)i);
        }
    }

    public static Character valueOf(char c) {
        if (c <= 127) { // must cache
            return CharacterCache.cache[(int)c];
        }
        return new Character(c);
    }
```

It turns out the Java Language Standard mandates that `Character.valueOf()` reuse cached `Character` instances for the first 127 `char`s.
The goal is to reduce allocations and garbage collections, but it seems like premature optimization to me.
And here it's impeding other optimizations!
The JVM can't tell that `Character.valueOf(c).charValue() == c`, because it doesn't know the contents of the `cache` array.
So instead it grabs a `Character` from the cache and reads its value, just to end up with the same value it started with.


## The workaround

The workaround is pretty simple:

```diff
@@ -11,7 +11,7 @@ public class StringAsList extends AbstractList<Character> {
 
     @Override
     public Character get(int index) {
-        return str.charAt(index); // Autoboxing!
+        return new Character(str.charAt(index));
     }
 
     @Override
```

By replacing the autoboxing with explicit boxing, avoiding `Character.valueOf()` altogether, the code becomes much easier for the JVM to reason about:

```java
    private final char value;

    public Character(char value) {
        this.value = value;
    }

    public char charValue() {
        return value;
    }
```

Even though we've "added" an allocation, the JVM sees right through it and simply grabs the `char` directly out of the `String`.
The performance boost is noticeable:

```
$ java -jar target/benchmarks.jar -f 1 -wi 8 -i 8
...
# Run complete. Total time: 00:00:16

Benchmark                    Mode  Cnt     Score    Error  Units
MyBenchmark.timeLevenshtein  avgt    8  1221.151 ± 58.878  ns/op
```

A full 14% faster. `-prof perfasm` confirms that `char` values are loaded right out of the `String` and compared in registers:

```x86asm
movzwl 0x10(%rsi,%rdx,2),%r11d  ;*caload
                                ; - java.lang.String::charAt@27 (line 648)
                                ; - com.tavianator.boxperf.StringAsList::get@9 (line 14)
                                ; - com.tavianator.boxperf.StringAsList::get@2 (line 5)
                                ; - com.tavianator.boxperf.Levenshtein::distance@121 (line 32)
cmp    %r11d,%r10d
je     0x00007faa8d404792  ;*if_icmpne
                           ; - java.lang.Character::equals@18 (line 4621)
                           ; - com.tavianator.boxperf.Levenshtein::distance@137 (line 33)
```


## Conclusion

Boxing is still a weak area for HotSpot, and I'd like to see it become better.
It should take more advantage of the semantics of boxed types to eliminate boxing in more cases, removing the need for these workarounds.

All the code used for these benchmarks is available on *fa-github* [GitHub](https://github.com/tavianator/boxperf).

---


## Comments

> **pron**
> *fa-clock-o* *time-2015-07-11*
>
> There is some ongoing work on improving "box elision": <http://mail.openjdk.java.net/pipermail/valhalla-dev/2014-November/000380.html>
