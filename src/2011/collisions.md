# Collisions

<div class="infobar">

*fa-clock-o* *time-2011-12-06*
*fa-user* Tavian Barnes

</div>


This animation is of one of Dimension's test scenes, physically integrated with collision detection and gravity.
Each collision is perfectly elastic.
The 1000-sphere scene was integrated and collision-detected 100 times per frame.
The integration and rendering took 30 minutes on 12 cores, or 3 hours of CPU time.
You should watch in HD.

<p style="text-align: center;">
    <iframe width="560" height="315" src="https://www.youtube.com/embed/cgCFSRlhdDg" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</p>

Collisions were detected using a naïve `$O(n^2)$` algorithm, but rendering time (23 minutes wall-clock, 173 minutes CPU time) still dwarfed integration time (7 minutes).
