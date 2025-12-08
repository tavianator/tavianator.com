# Solving Cubic Polynomials

<div class="infobar">

*fa-regular fa-clock* *time-2010-11-17*
*fa-solid fa-user* Tavian Barnes

</div>


Although a closed form solution exists for the roots of polynomials of degree ≤ 4, the general formulae for cubics (and quartics) is ugly.
Various simplifications can be made; commonly, the cubic `$a_3 x^3 + a_2 x^2 + a_1 x + a_0$` is transformed by substituting `$x = t - a_2 / 3 a_3$`, giving

```math
t^3 + p t + q = 0,
```

where

```math
\begin{aligned}
p &= \frac{1}{a_3} \left( a_1 - \frac{a_2^2}{3 a_3} \right) \\
q &= \frac{1}{a_3} \left( a_0 - \frac{a_2 a_1}{3 a_3} - \frac{2 a_2^3}{27 a_3^2} \right).
\end{aligned}
```

Several strategies exist for solving this depressed cubic, but most involve dealing with complex numbers, even when we only want to find real roots.
Fortunately, there are a couple ways to find solutions with only real arithmetic. First, we need to know the value of the discriminant `$\Delta = 4 p^3 + 27 q^2$`.

If `$\Delta < 0$`, then there are three real roots; this is the tough case.
Luckily, we can use the uncommon trigonometric identity `$4 \cos^3(\theta) - 3 \cos(\theta) - \cos(3 \theta) = 0$` to calculate the roots with trig functions.
Making another substitution, `$t = 2 \sqrt{-p/3} \cos(\theta)$`, gives us

```math
4 \cos^3(\theta) - 3 \cos(\theta) - \frac{3 q}{2 p} \sqrt{\frac{-3}{p}} = 0,
```

so

```math
\cos(3 \theta) = \frac{3 q}{2 p} \sqrt{\frac{-3}{p}}.
```

Thus the three roots are:

```math
t_n = 2 \sqrt{\frac{-p}{3}} \cos \left( \frac{1}{3} \cos^{-1} \left( \frac{3 q}{2 p} \sqrt{\frac{-3}{p}} \right) - \frac{2 \pi n}{3} \right),
```

for `$n \in \{0, 1, 2\}$`.
We can save a cosine calculation by noting that `$t_2 = -t_0 |_{q = -q}$` and `$t_1 = -(t_0 + t_2)$`.
When generated in this way, the roots are ordered from smallest to largest (`$t_0 < t_1 < t_2$`).

For the `$\Delta > 0$` case, there is a single real root.
We can apply the general cubic formula and avoid dealing with complex numbers, provided we choose the signs right.
In this case,

```math
t = -\mathrm{sgn}(q) \left( C - \frac{p}{3 C} \right), \text{ where } C = \sqrt[3]{\sqrt{\frac{\Delta}{108}} + \frac{|q|}{2}}.
```

When `$\Delta = 0$`, there is a root of at least multiplicity 2, and we can avoid calculating any radicals.
If `$p = 0$`, the only root is `$t_0 = 0$`; otherwise, the duplicate root is `$-3 q /2 p$` and the simple root is `$3 q / p$`.

My C implementation of this solution method can be seen in the `dmnsn_solve_cubic()` function [here].

[here]: /cgit/dimension.git/tree/libdimension/math/polynomial.c#n322
