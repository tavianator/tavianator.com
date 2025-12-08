# Ray / Priority R-Tree Intersection

<div class="infobar">

*fa-regular fa-clock* *time-2011-08-06*
*fa-solid fa-user* Tavian Barnes

</div>


These animations, rendered with [Dimension], show the ray / bounding box intersections that occur when rendering a single pixel.
The first video shows the regular search, and the second shows the faster case of a cache hit, as described in the [previous post].
Each ray/box intersection takes up one second in these videos, which aptly illustrates the difference between the cache miss and cache hit cases.
For this pixel, the improvement is more than a factor of two.

[Dimension]: /dimension
[previous post]: priority_r_trees.md

<p style="text-align: center;">
    <strong>Query without caching:</strong><br>
    <iframe width="560" height="315" src="https://www.youtube.com/embed/ZEU0PxFg3QI" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</p>

<p style="text-align: center;">
    <strong>Query with cache hit:</strong><br>
    <iframe width="560" height="315" src="https://www.youtube.com/embed/B7fhFUs-oik" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</p>
