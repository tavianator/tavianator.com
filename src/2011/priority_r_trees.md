# Priority R-Trees

<div class="infobar">

*fa-regular fa-clock* *time-2011-07-31*
*fa-solid fa-user* Tavian Barnes

</div>


[PR-trees], as used by [Dimension], provide a bounding-volume hierarchy with the unique property of bounded query complexity.
Combined with intersection caching, they work as a very efficient BVH, comparable to [POV-Ray]'s performance.
This is a rendering (using Dimension) of the PR-tree generated for one of its test scenes: (you may want to watch in HD)

[PR-trees]: http://www.win.tue.nl/~mdberg/Papers/prtree.pdf
[Dimension]: /dimension
[POV-Ray]: http://povray.org/

<p style="text-align: center;">
<iframe width="560" height="315" src="https://www.youtube.com/embed/-dTj8e2Wq3Y" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</p>

Dimension uses a `$O(n \log n)$` bulk-loading algorithm to construct the PR-tree.
Because intersection (ray-object test) and containment (point-inside-object test) queries are pre-order traversals, it can then flatten the tree into an array of nodes.
Each node stores a bounding box, a distance to skip if the bounding box intersection fails, and an optional pointer to an object.

Intersection queries against PR-trees have a complexity that grows with the number of intersecting objects.
In fact, reminiscent of kD-trees, the complexity is `$O(n^{2/3} + t)$` in three dimensions, for a tree with n objects and a query that intersects t objects.
Thus, the non-intersecting case is already fast.
To optimize the intersecting case, note that a ray is very likely to intersect the same object that it did in the previous pixel.
Caching that object, and testing the cached object before the full search of the tree, allows everything behind that object to be ignored in the case of a cache hit.

Dimension's C PR-tree implementation can be seen [here].

[here]: https://github.com/tavianator/dimension/blob/master/libdimension/bvh/prtree.c
