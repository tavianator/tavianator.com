# The Approximating and Eliminating Search Algorithm

<div class="infobar">

*fa-clock-o* *time-2016-03-15*
*fa-user* Tavian Barnes
[*fa-reddit* Reddit](https://www.reddit.com/r/programming/comments/4ao6no/the_approximating_and_eliminating_search_algorithm/)

</div>


[Nearest neighbour search] is a very natural problem: given a target point and a set of candidates, find the closest candidate to the target.
For points in the standard k-dimensional Euclidean space, k-d trees and related data structures offer a good solution.
But we're not always so lucky.

[Nearest neighbour search]: https://en.wikipedia.org/wiki/Nearest_neighbor_search
[k-d trees]: https://en.wikipedia.org/wiki/K-d_tree

More generally, we may be working with "points" in an exotic space that doesn't nicely decompose into separate dimensions like `$\mathbb{R}^n$` does.
As long as we have some concept of distance, it still makes sense to ask what the nearest neighbour of a point is.
If our notion of distance is completely unconstrained, we may not be able to better than exhaustive search.
But if the distance function is a [metric], we can use that to our advantage.

[metric]: https://en.wikipedia.org/wiki/Metric_(mathematics)

To be a distance metric, a function `$d(x, y)$` has to satisfy these three laws:

- `$d(x, y) = 0$` if and only if `$x = y$`
- `$d(x, y) = d(y, x)$`
- `$d(x, z) \le d(x, y) + d(y, z)$` for all `$y$`

The last condition is known as the [triangle inequality], and it's the key to performing nearest neighbour searches efficiently.
Many common distance functions happen to be metrics, such as [Euclidean distance], [Manhattan distance], [Hamming distance], and [Levenshtein distance].

[triangle inequality]: https://en.wikipedia.org/wiki/Triangle_inequality
[Euclidean distance]: https://en.wikipedia.org/wiki/Euclidean_distance
[Manhattan distance]: https://en.wikipedia.org/wiki/Taxicab_geometry
[Hamming distance]: https://en.wikipedia.org/wiki/Hamming_distance
[Levenshtein distance]: https://en.wikipedia.org/wiki/Levenshtein_distance

For searching in general metric spaces, many nice data structures such as [vantage point trees] and [BK-trees] exist.
But I'd like to talk about another, less popular but supremely interesting one: the Approximating and Eliminating Search Algorithm (AESA).

[vantage point trees]: https://en.wikipedia.org/wiki/Vantage-point_tree
[BK-trees]: https://en.wikipedia.org/wiki/BK-tree


## Background

AESA is a bazooka of an algorithm; it takes `$O(n^2)$` time and memory to pre-process the set of candidate points, and `$O(n)$` time to answer a nearest neighbour query.
The remarkable thing about it is it reduces the number of distance computations per query to `$O(1)$` on average.
That bears repeating: the distance function is invoked an expected constant number of times, totally independent of the number of candidates! This is very useful when your distance function is expensive to compute, like Levenshtein distance is.
Variants of the algorithm reduce both the quadratic pre-processing time and the linear per-query overhead, and I'll talk about these variants in future posts, but for now let's go over the basic AESA.

The idea is to pre-compute the distance between every single pair of candidates (hence `$O(n^2)$`).
These pre-computed distances are used to derive successively better and better lower bounds from the target to each candidate. It looks like this:

<p style="text-align: center;">
<svg style="display:block; margin:auto; font-family:serif;" width="320" height="400" viewBox="-160 -200 320 400">
    <circle cx="0" cy="0" r="5" fill="var(--fg)" />
    <text x="10" y="0" dominant-baseline="central" fill="var(--fg)" style="font-style:italic;">t</text>
    <circle cx="0" cy="0" r="150" stroke="var(--icons)" stroke-width="3" fill="none" />
    <circle cx="90" cy="-120" r="5" fill="var(--fg)" />
    <text x="85" y="-115" dominant-baseline="hanging" text-anchor="end" fill="var(--fg)" style="font-style:italic;">a</text>
    <circle cx="90" cy="-120" r="60" stroke="var(--icons)" stroke-width="3" fill="none" />
    <line x1="0" y1="0" x2="54" y2="-72" stroke="var(--fg)" stroke-width="3" />
    <text x="32" y="-31" dominant-baseline="central" fill="var(--fg)">lower bound</text>
    <line x1="90" y1="-120" x2="126" y2="-168" stroke="var(--fg)" stroke-width="3" />
    <circle cx="126" cy="-168" r="5" fill="var(--fg)" />
    <text x="131" y="-173" fill="var(--fg)" style="font-style:italic;">c</text>
    <circle cx="-45" cy="-60" r="5" fill="var(--fg)" />
    <text x="-55" y="-60" dominant-baseline="central" text-anchor="end" fill="var(--fg)" style="font-style:italic;">b</text>
</svg>
</p>

Here, `$t$` is the target point, `$b$` is the best match so far, `$a$` is the "active" candidate, and `$c$` is another candidate being considered.
By calculating `$d(t, a)$`, and using the pre-computed value of `$d(a, c)$`, we can eliminate `$c$` as a possibility without even computing `$d(t, c)$`.

Formally, the lower bound is obtained by rearranging the triangle inequality:

```math
\begin{aligned}
d(t,c) & \ge \phantom| d(t,a) - d(c,a) \phantom| \\
d(c,t) & \ge \phantom| d(c,a) - d(t,a) \phantom| \\
d(t,c) & \ge | d(t,a) - d(a,c) |
\end{aligned}
```

If this lower bound is larger than the distance to the best candidate we've found so far, `$c$` cannot possibly be the nearest neighbour.
AESA uses the algorithm design paradigm of best-first [branch and bound], using the lower bounds to both prune candidates, and as a heuristic to select the next active candidate.

[branch and bound]: https://en.wikipedia.org/wiki/Branch_and_bound


## Implementation

A simple Python implementation looks like this:

```python
import math

class Aesa:
    def __init__(self, candidates, distance):
        """
        Initialize an AESA index.

        candidates: The list of candidate points.
        distance: The distance metric.
        """

        self.candidates = candidates
        self.distance = distance

        # Pre-compute all pairs of distances
        self.precomputed = [[distance(x, y) for y in candidates] for x in candidates]

    def nearest(self, target):
        """Return the nearest candidate to 'target'."""

        size = len(self.candidates)

        # All candidates start out alive
        alive = list(range(size))
        # All lower bounds start at zero
        lower_bounds = [0] * size

        best_dist = math.inf

        # Loop until no more candidates are alive
        while alive:
            # *Approximating*: select the candidate with the best lower bound
            active = min(alive, key=lambda i: lower_bounds[i])
            # Compute the distance from target to the active candidate
            # This is the only distance computation in the whole algorithm
            active_dist = self.distance(target, self.candidates[active])

            # Update the best candidate if the active one is closer
            if active_dist < best_dist:
                best = active
                best_dist = active_dist

            # *Eliminating*: remove candidates whose lower bound exceeds the best
            old_alive = alive
            alive = []

            for i in old_alive:
                # Compute the lower bound relative to the active candidate
                lower_bound = abs(active_dist - self.precomputed[active][i])
                # Use the highest lower bound overall for this candidate
                lower_bounds[i] = max(lower_bounds[i], lower_bound)
                # Check if this candidate remains alive
                if lower_bounds[i] < best_dist:
                    alive.append(i)

        return self.candidates[best]
```


## Evaluation

Let's run a little experiment to see how many times it really calls the distance metric.

```python
from random import random

dimensions = 3
def random_point():
    return [random() for i in range(dimensions)]

count = 0
def euclidean_distance(x, y):
    global count
    count += 1

    s = 0
    for i in range(len(x)):
        d = x[i] - y[i]
        s += d*d
    return math.sqrt(s)

points = [random_point() for n in range(1000)]
aesa = Aesa(points, euclidean_distance)

print('{0} calls during pre-computation'.format(count))
count = 0

aesa.nearest(random_point())

print('{0} calls during nearest neighbour search'.format(count))
count = 0

for i in range(1000):
    aesa.nearest(random_point())

print('{0} calls on average during nearest neighbour search'.format(count / 1000))
count = 0
```

On a typical run, this prints something like

```
1000000 calls during pre-computation
6 calls during nearest neighbour search
5.302 calls on average during nearest neighbour search
```

Raising the number of points to 10,000, pre-processing takes much longer, but the average number of distance metric evaluations stays at around 5.3!

```
100000000 calls during pre-computation
5 calls during nearest neighbour search
5.273 calls on average during nearest neighbour search
```


## Bibliography

Vidal (1986).
[An algorithm for finding nearest neighbours in (approximately) constant average time](http://www.sciencedirect.com/science/article/pii/0167865586900139).
Pattern Recognition Letters, Volume 4, Issue 3, July 1986, pp. 145–157.

Micó, Oncina, Vidal (1994).
[A new version of the Nearest-Neighbour Approximating and Eliminating Search Algorithm (AESA) with linear preprocessing time and memory requirements](https://www.researchgate.net/publication/222488611_A_new_version_of_the_Nearest-Neighbour_Approximating_and_Eliminating_Search_Algorithm_AESA_with_linear_preprocessing_time_and_memory_requirements).
Pattern Recognition Letters, Volume 15, Issue 1, January 1994, pp. 9–17.

Vilar (1995).
[Reducing the overhead of the AESA metric space nearest neighbour searching algorithm](http://www.sciencedirect.com/science/article/pii/002001909500161X).
Information Processing Letters, Volume 56, Issue 5, 8 December 1995, pp. 265–271.

Micó, Oncina, Carrasco (1996).
[A fast branch & bound nearest neighbour classifier in metric spaces](http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.500.1075&rep=rep1&type=pdf).
Pattern Recognition Letters, Volume 17, Issue 7, 10 June 1996, pp. 731–739.
