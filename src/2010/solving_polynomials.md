# Solving Polynomials

<div class="infobar">

*fa-regular fa-clock* *time-2010-10-28*
*fa-solid fa-user* Tavian Barnes

</div>


A well known (if not by name) theorem is the [Abel–Ruffini theorem], which states that there is no algebraic expression for the roots of polynomials with degree higher than 4.

[Abel–Ruffini theorem]: http://en.wikipedia.org/wiki/Abel%E2%80%93Ruffini_theorem

A not-so-well-known fact is that for any polynomial `$P(x)$`, it is possible to find (with exact arithmetic) a set of ranges each containing exactly one root of `$P(x)$`.
One such algorithm is due to James Victor Uspensky in 1948.

Uspensky's algorithm requires all roots to have multiplicity 1; `$P(x)$` can be trivially replaced with `$P(x)/\gcd(P(x), P'(x))$` to eliminate duplicate roots, if necessary.
The algorithm relies on [Descartes' rule of signs], which states that the number of positive solutions (counting multiplicities) to a polynomial is equal to `$\mathrm{var}(P(x)) - 2 k$`, where `$\mathrm{var}(P(x))$` is the number of sign changes between consecutive non-zero coefficients of `$P(x)$`, and `$k$` is a non-negative integer.

[Descartes' rule of signs]: http://en.wikipedia.org/wiki/Descartes'_rule_of_signs

This clearly implies that if `$\mathrm{var}(P(x))$` is 0 or 1, then the polynomial must have exactly 0 or 1 root in `$(0, \infty)$`, respectively.
Otherwise, we can transform the polynomial and try again.
Expanding `$A(x) = P(x + 1)$`, we can test `$\mathrm{var}(A(x))$` to learn about the roots in `$(1, \infty)$`.
Expanding `$B(x) = (x + 1)^n P(1/(x + 1))$`, where `$n$` is the degree of the polynomial `$P(x)$`, we can similarly test `$\mathrm{var}(B(x))$` to learn about the roots in `$(0, 1)$`.
If `$A(0) = 0$`, then `$x = 1$` is a root of `$P(x)$`.

If we don't get conclusive information from one of the tests (i.e. `$\mathrm{var}(A(x)) > 1$` or `$\mathrm{var}(B(x)) > 1$`), apply the same two transformations (`$P(x) \mapsto P(x+1)$` and `$P(x) \mapsto (x+1)^n P(1/(x+1))$` to the offending polynomial(s).
Uspensky proves that this recursive procedure always terminates for square-free polynomials.
A reasonable bound on the recursion depth may also be shown.

From a CS perspective, the two transformations are easy to implement. If `$P(x) = \sum_{i=0}^n p_i x_i$`, then

```math
A(x) = \sum_{i=0}^n \left( \sum_{j=i}^n \binom{j}{i} p_j \right) x^i,
\quad B(x) = \sum_{i=0}^n \left( \sum_{j=i}{n} \binom{j}{i} p_{n-j} \right) x^i.
```

Another CS-related point is that one of the resultant intervals may have an infinite upper bound.
Cauchy provides a general upper bound `$1 + (\max_{i=0}^{n-1} |p_i|) / |p_n|$` which may be used to produce a finite upper bound.

A C implementation of this algorithm as a root-solver in my ray-tracer Dimension can be seen [here].

[here]: /cgit/dimension.git/tree/libdimension/math/polynomial.c
