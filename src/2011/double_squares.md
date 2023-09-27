# Facebook Hacker Cup Qualification Round: Double Squares

<div class="infobar">

*fa-clock-o* *time-2011-01-10*
*fa-user* Tavian Barnes
[*fa-comments* Comments](#comments)

</div>

Facebook has decided to hold a programming competition, I guess.
They should definitely hire the winner, and get her to *rewrite their damn programming competition interface*.
But more on that later.

The first of the three qualification round problems was a simple little numerical problem: determine how many distinct ways a number can be written as the sum of two squares.
Though the event's tagline was "too hard for brute force, switching to [dp]," brute force is perfectly capable of answering this question for the given upper bound of 2<sup>31</sup> - 1.
Still, the [Facebook event]'s comments are filled with people complaining that their code takes hours on large numbers, which baffles me.

[dp]: https://en.wikipedia.org/wiki/Dynamic_programming
[Facebook event]: https://www.facebook.com/event.php?eid=148059031890072

My method was simple: for every `$i$` from 0 to `$\sqrt{x/2}$`, check if `$x - i^2$` is a perfect square.
Some C99 code that does this pretty fast is this:

```c
#include <stdbool.h>
#include <stdint.h>

bool
is_square(uint32_t x)
{
  /* Tricky modular check for the possibility of squareness */
  if ((x & 0x7) == 1
      || (x & 0x1F) == 4
      || (x & 0x7F) == 16
      || (x & 0xBF) == 0)
  {
    /* x is possibly square, do a full Newtonian method square
       root to check */
    uint32_t s = x;
    if (x > 0) {
      /* 18 is the fastest choice for loop iterations, and at
         least 16 must be used to avoid s*s overflowing later */
      for (int i = 0; i < 18; ++i) {
        s = (s + x/s)/2;
      }
      while (s*s > x) {
        --s;
      }
      while (s*s < x) {
        ++s;
      }
    }

    return s*s == x;
  } else {
    return false;
  }
}

uint32_t
ndoublesquares(uint32_t x)
{
  uint32_t count = 0;

  for (uint32_t i = 0; true; ++i) {
    uint32_t ii = i*i;
    uint32_t resid = x - ii;

    if (ii > resid) {
      break;
    }

    if (is_square(resid)) {
      ++count;
    }
  }

  return count;
}
```

If you feel like even more speed and don't mind using floating-point, you can use `s = sqrt(x);` in place of Newton's method to calculate the approximate square root.
For Facebook's test input on my machine, that drops the execution time from 0.012 seconds to 0.003 seconds.
Proving the modular check is left as an exercise :).

I had this written in about 20 minutes after the contest started, but because the contest has a terrible interface and I was too lazy to read all the contest rules in detail, I didn't get to submit it.
The contest was set to close a few days after it opened, so the first thing I did was download the input file for that question.
But it turns out that you're only given 6 minutes to submit a solution after you download the input file.
Furthermore, the countdown that would've indicated this to me doesn't work on Chrome, because apparently the 2nd most popular website in the world can't figure out cross-browser compatibility.
So by the time I submitted the output, I was told that the time had expired.
Apparently plenty of people did that very same thing, so Facebook later decided to lift the 6 minute restriction for this round.

---


## Comments

> [**Luis Argote**](http://argote.mx/)
> *fa-clock-o* *time-2011-01-10*
>
> Hello, nice answer, I went for something much more straightforward but did the same thing with the time...
> BTW, what are you using to display your source code in a box?
>
> > *fa-user* [**Tavian Barnes**](/)
> > *fa-clock-o* *time-2011-01-10*
> >
> > The plugin's called WP-Syntax.
