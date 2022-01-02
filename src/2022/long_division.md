# Long division

<div class="infobar">

<fa:clock-o> 2022-01-02
<fa:user> Tavian Barnes

</div>


I have a confession to make: I never learned how to do long division.
That might seem strange for someone whose early childhood identity was basically, “the kid who's good at math.”
In fact, that's kind of why I didn't learn it—in grade three, I was doing well enough that they bumped me up to the fifth grade math class, skipping right over fourth grade where (I assume) it would have been taught.
(Funnily enough, my dad, a [math professor], thought the jump ahead was a bad idea.)

[math professor]: https://contacts.ucalgary.ca/info/math/profiles/101-152832

I did know how to divide by one-digit numbers, with a process that's apparently called [short division].
Since teachers were usually not cruel enough to assign things like 39483&div;123, I fumbled my way through the rest of elementary and high school without really having to admit that I couldn't do one of the four basic arithmetic operations.
Along the way, I started picking up computer programming, gradually shifting into my new identity, “the kid who's good at computers.”
One thing I liked about computers is they would do division for you.

[short division]: https://en.wikipedia.org/wiki/Short_division

As I got better at programming, I stumbled on a way to cash in my talents for a kind of nerd clout.
A teacher suggested I enter one of my programs in the local science fair, which some people took more seriously than I would have guessed.
Not just your stereotypical baking-soda-and-vinegar volcanoes, there were students experimenting with stem cells and studying black holes.
There were even science fair [nationals], as I was surprised to learn when my project won me a trip there.

[nationals]: https://youthscience.ca/science-fairs/cwsf/

[My project] simulated the orbits of planets according to [Newtonian gravity].
Initially I was just happy to work on it for its own sake (and to procratinate my actual schoolwork), but nationals were super fun and I wanted to make sure I went back the next year.
I figured that meant adding [more] [kinds] of physics, and making it more accurate.
I didn't quite know enough math to improve its accuracy [the good way], so I did it the bad way: [arbitrary-precision arithmetic].

[My project]: https://secure.youthscience.ca/virtualcwsf/projectdetails.php?id=577
[Newtonian gravity]: https://en.wikipedia.org/wiki/Newton%27s_law_of_universal_gravitation
[more]: https://en.wikipedia.org/wiki/Classical_electromagnetism
[kinds]: https://en.wikipedia.org/wiki/Rigid_body_dynamics
[the good way]: https://en.wikipedia.org/wiki/Runge%E2%80%93Kutta_methods
[arbitrary-precision arithmetic]: https://en.wikipedia.org/wiki/Arbitrary-precision_arithmetic


## *Loooonnnngggg* division

In order to show off as much as possible, I implemented arbitrary-precision arithmetic myself, without those [fancy] [libraries] that do everything for you.
Unfortunately, one of the things I had to implement was (you guessed it) division.
At this point I had already finished all of high school math (which even included [*polynomial long division*](https://en.wikipedia.org/wiki/Polynomial_long_division)), and I still didn't really know how to divide two numbers.
Sadly, my first attempt is lost to time, as I hadn't yet heard of revision control, but it looked something like this:

[fancy]: https://gmplib.org/
[libraries]: https://www.mpfr.org/

```python
# My original implementation was in C++, but I'll use Python for exposition
def slow_divide(num, denom):
    guess = 0
    while (guess + 1) * denom <= num:
        guess += 1
    return guess
```

This is an algorithm you might use if long division just doesn't take *long* enough for you.
I knew it took “exponential time,” but I didn't really have a feeling for what that meant until I ran this code for the first time.
My project sat there for hours without making any progress.
I had to find a faster way.


## The division algorithm

Like any reasonable programmer might do to find an algorithm for division, I typed “division algorithm” into Google.
It led me straight to the [Division Algorithm], which is famously not an algorithm.
Rather, it's a common name for the mathematical theorem that the quotient and remainer are unique when dividing two integers.
Specifically, given two integers `$n$` (numerator) and `$d$` (denominator), one can find the unique integers `$q$` (quotient) and `$r$` (remainder) such that `$n = q d + r$` and `$0 \le r < |d|$`.

[Division Algorithm]: https://web.archive.org/web/20090317063313/http://en.wikipedia.org:80/wiki/Division_algorithm

That's great and all, but it doesn't really tell you *how* to find them.
I remember that at the time, this unfortunate name gave me a lot of trouble finding actual algorithms for division.
Luckily Wikipedia has since renamed some articles so that [division algorithm](https://en.wikipedia.org/wiki/Division_algorithm) now refers to actual algorithms.


## Short divison

As lost as I was implementing division in full generality, I did know how to divide by one-digit numbers well enough to implement that.
Short division is pretty easy, enough that you can even do it in your head with some practice.
On paper it looks like this:

<style type="text/css">
table.division {
    width: 100%;
}
table.division tbody tr {
    background: none;
}
table.division td {
    border: none;
    padding: 0;
}
table.division td:nth-child(2) {
    width: 33%;
}
</style>
<table class="division">
<tbody>
<tr>
<td>

Say we want to compute `$61320 \div 7$`:

</td>
<td>

```math
7 \overline{\smash{)}61320}
```

</td>
</tr>
<tr>
<td>

We work from left to right, starting with `$6 \div 7 = 0$`, remainder `$6$`.

</td>
<td>

```math
\begin{aligned}
& \;\, 0 \\[-4pt]
7 & \overline{\smash{)}\cancel{6}_{6}1320}
\end{aligned}
```

</td>
</tr>
<tr>
<td>

Take the remainder from the last step and write it in front of the next digit.
In this case not much changed, and we calculate `$61 \div 7 = 8$`, remainder `$5$`.

</td>
<td>

```math
\begin{aligned}
& \;\, 08 \\[-4pt]
7 & \overline{\smash{)}\cancel{6}_{6}\cancel{1}_{5}320}
\end{aligned}
```

</td>
</tr>
<tr>
<td>

`$53 \div 7 = 7$`, remainder `$4$`.

</td>
<td>

```math
\begin{aligned}
& \;\, 087 \\[-4pt]
7 & \overline{\smash{)}\cancel{6}_{6}\cancel{1}_{5}\cancel{3}_{4}20}
\end{aligned}
```

</td>
</tr>
<tr>
<td>

...

</td>
<td>

```math
\begin{aligned}
& \;\, 0876 \\[-4pt]
7 & \overline{\smash{)}\cancel{6}_{6}\cancel{1}_{5}\cancel{3}_{4}\cancel{2}_{0}0}
\end{aligned}
```

</td>
</tr>
<tr>
<td>

And, finally,

</td>
<td>

```math
\begin{aligned}
& \;\, 08760 \\[-4pt]
7 & \overline{\smash{)}\cancel{6}_{6}\cancel{1}_{5}\cancel{3}_{4}\cancel{2}_{0}\cancel{0}}
\end{aligned}
```

</td>
</tr>
</tbody>
</table>

Indeed, we can check that `$8760 \times 7 = 61320$`.

Why does this work?
Let's start with a single-digit numerator `$n_1$` divided by a single digit denominator `$d$`.
The “division algorithm” tells us that there is a unique quotient `$q_1$` and remainder `$r_1$` such that `$n_1 = q_1 d + r_1$`.
(In the example above, `$6 = 0 \times 7 + 6$`.)

Now let's extend it to a two-digit numerator `$10 n_1 + n_2$`.
We can plug in the above expression for `$n_1$` to get

```math
\begin{aligned}
10 n_1 + n_2 & = 10 (q_1 d + r_1) + n_2 \\
& = (10 q_1) d + 10 r_1 + n_2.
\end{aligned}
```

Again, the division algorithm tells us we can find `$q_2$` and `$r_2$` such that `$10 r_1 + n_2 = q_2 d + r_2$`.
(In the above example, `$61 = 8 \times 7 + 5$`.)
It follows that

```math
\begin{aligned}
10 n_1 + n_2 & = (10 q_1) d + q_2 d + r_2 \\
& = (10 q_1 + q_2) d + r_2.
\end{aligned}
```

We can continue this process to extract the digits of the quotient and remainder for longer and longer numerators:

```math
\begin{aligned}
100 n_1 + 10 n_2 + n_3 & = (100 q_1 + 10 q_2 + q_3) d + r_3, \\
1000 n_1 + 100 n_2 + 10 n_3 + n_4 & = (1000 q_1 + 100 q_2 + 10 q_3 + q_4) d + r_4, \\
\end{aligned}
```

etc.

In code, it could look something like this:

```python
def short_divide(num, denom):
    # Initialize the quotient and remainder to zero
    quot = 0
    rem = 0

    # Loop over the digits of the numerator
    for digit in str(num):
        # Write the remainder in front of the next digit of the numerator
        chunk = 10 * rem + int(digit)

        # Perform a two-digit by one-digit division to find the next quotient
        # digit.  If using the built-in division operator `//` feels like
        # cheating, imagine we used a look-up table or something instead.
        quot *= 10
        quot += chunk // denom

        # Compute the remainder for the next iteration
        rem = chunk % denom

    return quot

>>> short_divide(61320, 7)
8760
```


## Long division

Now that we have an algorithm for dividing by one-digit numbers, what do we have to change to make it work for bigger denominators?
Embarassingly enough, nothing:

```python
>>> short_divide(61320, 73)
840
>>> 840 * 73
61320
```

None of the correctness of the math above relied on the denominator having only one digit.
Long division is just short division with extra writing!
All this time I'd thought I didn't know long division, I actually did, if I'd thought about it for a few minutes.

I will say that the division in `chunk // denom` feels more like cheating now that our denominators are larger.
We can't really use a look-up table any more to evaluate it.
But we could use a different algorithm for it—say, the terrible, exponential, count-up-from-zero algorithm I started with:

```python
def long_divide(num, denom):
    quot = 0
    rem = 0

    for digit in str(num):
        chunk = 10*rem + int(digit)
        temp = slow_divide(chunk, denom)

        quot *= 10
        quot += temp

        rem = chunk - temp * denom

    return quot

>>> long_divide(61320, 73)
840
```

`slow_divide()` is fine in this case: since we're only using it to compute a single digit, it won't ever have to loop more than 10 times.


## Binary search

If we were serious numericists implementing division for a real arbitrary-precision arithmetic package, we'd be using a much larger base than 10, maybe `$2^{32}$` or `$2^{64}$` or something.
Suddenly `slow_divide()` seems pretty slow again.
But as usual in computer science, we could speed up the linear scan using binary search:

```python
def binsearch_divide(num, denom):
    low = 0
    high = num

    while low < high:
        mid = (low + high) // 2
        if (mid + 1) * denom <= num:
            low = mid + 1
        else:
            high = mid

    return low
```

Actually, this is a perfectly fine general-purpose division algorithm (as long as I got the edge cases right):

```python
>>> binsearch_divide(61320, 73)
840
```

It is slightly slower than long division since we have to do full-width multiplications, but on the other hand, it's easier to see why the approach is correct and efficient.
I'm always hearing about plans to teach computer science concepts to kids in grade school, and I'm normally hesitant about such things, but maybe teaching “binary search division” alongside long division would be a good way to introduce students to algorithmic thinking.
