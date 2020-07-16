# Java Generics Quirks

<div class="infobar">
    <i class="fa fa-clock-o" aria-hidden="true"></i> 2013-07-18
    <i class="fa fa-user" aria-hidden="true"></i> Tavian Barnes
</div>


Can you guess which of these statements are valid Java 7?
I know I can't! :)

Hint: Eclipse, `javac`, and the JLS disagree on these, so test-compiling won't help you.

```java
abstract class ListOfListOf<T> implements List<List<T>> {
}

class Quirks {
    static void quirks(List<List<Number>> list) {
        // Easy one to warm up with
        List<List<? extends Number>> warmUp = list;

        // These casts are type-safe
        ListOfListOf<Number> normalCast = (ListOfListOf<Number>) list;
        ListOfListOf<?> wildcardCast = (ListOfListOf<?>) list;

        // So are these ones
        List<? extends List<? extends Number>> wider = list;
        ListOfListOf<?> narrowingCast = (ListOfListOf<?>) wider;
    }
}
```

Answers:

- `List<List<? extends Number>>` [does not capture a `List<List<Number>>`](http://stackoverflow.com/questions/3546745/multiple-wildcards-on-a-generic-methods-makes-java-compiler-and-me-very-confu/3547372#3547372).
  In fact, it does not capture at all, so the assignment `warmUp = list` is <span style="font-weight: bold; color: red;">invalid</span>.
- `ListOfListOf<Number> normalCast = (ListOfListOf<Number>) list;`<br>
  Eclipse says <span style="font-weight: bold; color: green;">yes</span>, `javac` says <span style="font-weight: bold; color: green;">yes</span>.
- `ListOfListOf<?> wildcardCast = (ListOfListOf<?>) list;`<br>
  Eclipse says "<span style="font-weight: bold; color: red;">no way man</span>!"
  `javac` says "<span style="font-weight: bold; color: green;">sure</span>."
- `List<? extends List<? extends Number>> wider = list;`<br>
  Just a normal widening conversion. Eclipse and javac say "<span style="font-weight: bold; color: green;">whatever, man</span>."
- `ListOfListOf<?> narrowingCast = (ListOfListOf<?>) wider;`<br>
  Eclipse says "<span style="font-weight: bold; color: green;">no problem</span>," `javac` says "<span style="font-weight: bold; color: red;">I'm sorry, Dave. I'm afraid I can't do that</span>."

Ready to go again?

```java
class CanYouInferT<T extends Comparable<? super T>> {
}

class Quirks {
    static <T extends Comparable<? super T>> void canYouInferT() {
    }

    static void quirks() {
        // Note that Object is not Comparable, so what is T?
        canYouInferT();
        CanYouInferT<?> canYouInferT = new CanYouInferT<>();
    }
}
```

Answers: Eclipse is perfectly happy to infer, um, something for `T` in both cases.
`javac` chokes on `new CanYouInferT<>()`, but somehow still manages to infer something for the static call of `canYouInferT()`.

Does anyone know what the spec says about these corner cases?
