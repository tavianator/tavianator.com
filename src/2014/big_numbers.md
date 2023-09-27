# Big Numbers

<div class="infobar">

*fa-clock-o* *time-2014-01-08*
*fa-user* Tavian Barnes
[*fa-comments* Comments](#comments)

</div>


Take a number, say, 264, and write it in binary:

```math
264 = 2^8 + 2^3.
```

Because we like binary so much, write the exponents in binary too:

```math
\begin{aligned}
264 &= 2^{2^3} + 2^{2 + 1} \\
&= 2^{2^{2 + 1}} + 2^{2 + 1}
\end{aligned}
```

and so on, until every number is 2 or less.
This is the *hereditary base-2* representation of 264.
Now, transform that number by increasing the base from 2 to 3, and subtracting one:

```math
\begin{aligned}
G_2(264) &= 3^{3^{3 + 1}} + 3^{3 + 1} - 1 \\
&= 3^{3^{3 + 1}} + 2 \cdot 3^3 + 2 \cdot 3^2 + 2 \cdot 3 + 2 \\
&\approx 4.4 \cdot 10^{38}.
\end{aligned}
```

And again:

```math
\begin{aligned}
G_3(G_2(264)) &= 4^{4^{4 + 1}} + 2 \cdot 4^4 + 2 \cdot 4^2 + 2 \cdot 4 + 2 \\
&\approx 3.2 \cdot 10^{616}.
\end{aligned}
```

Goodstein sequences are defined by these repeated applications of `$G_n$`.
The Goodstein sequence starting at `$m$` is `$m_1 = m$`, `$m_2 = G_2(m_1)$`, `$m_3 = G_3(m_2)$`, etc.


## Goodstein's theorem

[Goodstein's theorem] states that every Goodstein sequence eventually reaches zero.
Despite the deceivingly explosive initial increase (the next value for `$m = 264$` above is `$m_4 \approx 2.5 \cdot 10^{10921}$`), the surprising truth is that for all initial values of `$m$`, `$m_k = 0$` for some finite `$k$`.

[Goodstein's theorem]: https://en.wikipedia.org/wiki/Goodstein's_theorem

This counterintuitive theorem is actually fairly easy to prove.
We simply find an upper bound on the base `$b$` used in the hereditary base-`$b$` representations in the sequence.
Finding the upper bound is actually the easiest part:

```math
b < \infty
```

"But wait," you say, "that's obvious and unhelpful!"
Well, by using a particular kind of infinity, this upper bound becomes useful.
Precisely, we use `$\omega$`, the first transfinite [ordinal number].
For `$m = 264$` as before, the bounds look like this:

[ordinal number]: https://en.wikipedia.org/wiki/Ordinal_number

```math
\begin{array}{cclcl}
m_1 & = & 2^{2^{2 + 1}} + 2^{2 + 1} & \le & \omega^{\omega^{\omega + 1}} + \omega^{\omega + 1} \\
m_2 & = & 3^{3^{3 + 1}} + 2 \cdot 3^3 + 2 \cdot 3^2 + 2 \cdot 3 + 2 & \le & \omega^{\omega^{\omega + 1}} + \omega^\omega \cdot 2 + \omega^2 \cdot 2 + \omega \cdot 2 + 2 \\
m_3 & = & 4^{4^{4 + 1}} + 2 \cdot 4^4 + 2 \cdot 4^2 + 2 \cdot 4 + 1 & \le & \omega^{\omega^{\omega + 1}} + \omega^\omega \cdot 2 + \omega^2 \cdot 2 + \omega \cdot 2 + 1 \\
m_4 & = & 5^{5^{5 + 1}} + 2 \cdot 5^5 + 2 \cdot 5^2 + 2 \cdot 5 & \le & \omega^{\omega^{\omega + 1}} + \omega^\omega \cdot 2 + \omega^2 \cdot 2 + \omega \cdot 2 \\
m_5 & = & 6^{6^{6 + 1}} + 2 \cdot 6^6 + 2 \cdot 6^2 + 6 + 5 & \le & \omega^{\omega^{\omega + 1}} + \omega^\omega \cdot 2 + \omega^2 \cdot 2 + \omega + 5 \\
m_6 & = & 7^{7^{7 + 1}} + 2 \cdot 7^7 + 2 \cdot 7^2 + 7 + 4 & \le & \omega^{\omega^{\omega + 1}} + \omega^\omega \cdot 2 + \omega^2 \cdot 2 + \omega + 4 \\
\vdots
\end{array}
```

These upper bounds are well-defined using [ordinal arithmetic].
They are also strictly decreasing, and since the ordinals are [well-ordered], every such strictly-decreasing sequence must reach zero in a finite number of steps.
Note that we write `$\omega \cdot 2$` rather than `$2 \cdot \omega$` above because ordinal arithmetic is not commutative; in fact, `$2 \cdot \omega = \omega < \omega \cdot 2$`.

[ordinal arithmetic]: https://en.wikipedia.org/wiki/Ordinal_arithmetic
[well-ordered]: https://en.wikipedia.org/wiki/Well-order


## Independence

Despite being a theorem about natural numbers, Goodstein's theorem is independent of the [Peano axioms].
It's a natural, concrete example of [Gödel's incompleteness theorem] for those axioms.

[Peano axioms]: https://en.wikipedia.org/wiki/Peano_axioms
[Gödel's incompleteness theorem]: https://en.wikipedia.org/wiki/G%C3%B6del's_incompleteness_theorems#First_incompleteness_theorem

Kirby and Paris proved its independence by essentially showing that any proof of Goodstein's theorem requires induction over sets too large for Peano's axioms to handle.
They showed that Goodstein's theorem implies [Gentzen's theorem].

[Gentzen's theorem]: https://en.wikipedia.org/wiki/Gentzen%27s_consistency_proof


## The Goodstein function

How long are Goodstein sequences?
It turns out they are extremely long.
Let the Goodstein function `$\mathcal{G}(m)$` be the length of the Goodstein sequence starting at `$m_1 = m$`.

`$\mathcal{G}(12)$` is larger than [Graham's number].
`$\mathcal{G}(m)$` grows faster than the [Ackermann function] `$A(m, m)$`.
`$\mathcal{G}(m)$` grows faster than the iterated Ackermann function `$A^{A(m, m)}(m, m) = A(A(\cdots), A(\cdots))$`.
In fact, `$\mathcal{G}(m)$` grows faster than any function that can be proven to be [total] in Peano arithmetic.
That means `$\mathcal{G}(m)$` grows faster than any function that can be shown to even *exist* by induction over the natural numbers.

[Graham's number]: https://en.wikipedia.org/wiki/Graham%27s_number
[Ackermann function]: https://en.wikipedia.org/wiki/Ackermann_function
[total]: https://en.wikipedia.org/wiki/Total_function


## References

- [*Goodstein's theorem*](https://en.wikipedia.org/wiki/Goodstein's_theorem)
- [*Accessible independence results for Peano arithmetic*](https://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.107.3303), Laurie Kirby and Jeff Paris

---


## Comments

> [**Luqman**](http://luqmansahaf.blogspot.com/)
> *fa-clock-o* *time-2016-03-17*
>
> This is good explanation of ordinals: <http://www.sjsu.edu/faculty/watkins/ordinals.htm>
