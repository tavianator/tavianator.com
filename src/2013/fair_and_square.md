# Fair and Square, or How to Count to a Googol

<div class="infobar">

*fa-regular fa-clock* *time-2013-04-15*
*fa-solid fa-user* Tavian Barnes
[*fa-solid fa-comment* Comments](#comments)
[*fa-brands fa-reddit* Reddit](https://www.reddit.com/r/programming/comments/1ce2ku/my_solution_for_fair_and_square_google_code_jam/)

</div>


[Fair and Square] is a problem from the qualification round of [Google Code Jam 2013].
The gist of the problem is to find out how many integers in a given range are both a palindrome, and the square of a palindrome.
Such numbers are called "fair and square." A number is a palindrome iff its value is the same when written forwards or backwards, in base 10.

[Fair and Square]: https://codingcompetitions.withgoogle.com/codejam/round/0000000000432dfc/0000000000433335
[Google Code Jam 2013]: https://codingcompetitions.withgoogle.com/codejam/archive/2013

The small input has very modest bounds on size: the interval `$[A, B]$` is bounded by `$1 \le A \le B \le 1000$`.
It's perfectly reasonable to check for each integer in that range whether it is a palindrome, and whether it is a perfect square of a palindrome.
This has complexity `$10^3 \approx 2^{10}$`.
But we know that harder inputs are coming, so lets be a little smart.

Rather than check whether each number is a perfect square, we can enumerate all the perfect squares in `$[A, B]$` by squaring each integer in `$\left[ \lceil\sqrt{A}\rceil, \lfloor\sqrt{B}\rfloor \right] $`.
This essentially reduces the size of our search space to its square root, or `$\sqrt{10^3} \approx 2^5$`.
Here is an implementation of this algorithm in Python:

```python
#!/usr/bin/env python3

def isqrt(n):
  """Returns floor(sqrt(n))."""
  if n == 0:
    return 0

  lg = (n.bit_length() + 1)//2

  x = 1 << lg
  while True:
    r = (x + n//x)//2
    if y >= x:
      break
    x = y

  return x

def is_palindrome(n):
  """Return whether n is a base-10 palindrome."""
  sn = str(n)
  # sn[::-1] is tricky slice syntax that reverses sn
  return sn == sn[::-1]

def palindromes(m, n):
  """Generates all the palindromic integers in range(m, n)."""
  for i in range(m, n):
    if is_palindrome(i):
      yield i

# T is the number of test cases
T = int(input())

for i in range(T):
  line = input().split(' ')
  # A and B are the bounds
  A = int(line[0])
  B = int(line[1])

  # m and n are the square roots of the bounds
  m = isqrt(A - 1) + 1  # ceil(sqrt(A))
  n = isqrt(B)          # floot(sqrt(B))

  count = 0
  for j in palindromes(m, n + 1):
    if is_palindrome(j*j):
      count += 1

  print('Case #%d: %d' % (i + 1, count))
```

The definition of `isqrt()` is based on [this excellent StackOverflow answer].
I encourage you to work out for yourself why it necessarily converges to `$\lfloor\sqrt{n}\rfloor$`.

[this excellent StackOverflow answer]: https://stackoverflow.com/questions/1623375/writing-your-own-square-root-function#1624602


## But can we go faster?

Of course we can! The first "large" input for this problem has the much weaker bound `$1 \le A \le B \le 10^{14}$` on the size of the interval.
Our current algorithm has complexity `$\sqrt{10^{14}} = 10^7 \approx 2^{23}$` on this input.
But we're still wasting a lot of time iterating over integers that are not palindromes.
It's easy to generate only the palindromes in an interval by incrementing only the left "half" of a number, and "mirroring" it to get the full palindrome.
For example, from 10, 11, 12, ..., we can generate the palindromes 101, 111, 121, ..., as well as 1001, 1111, 1221, etc.
Since we're now enumerating numbers with half the length, our search space is reduced to its square root again: `$\sqrt{10^7} \approx 2^{12}$`.

Here's a new implementation of `palindromes(m, n)` that uses this algorithm:

```python
def palindromes(m, n):
  sm = str(m)

  q, r = divmod(len(sm), 2)
  # Note here that r = len(sm)%2.  If r is 0, we duplicate the middle digit and
  # generate palindromes like 1221.  If r is 1, we don't duplicate the middle
  # digit, instead generating palindromes like 12321.

  # lh is the "left half" of the palindrome we are generating
  lh = int(sm[:(q + r)])

  while True:
    slh = str(lh)

    # Check for rollover (99 becoming 100, for example)
    if len(slh) != q + r:
      if r == 0:
        # We go from generating numbers like 9999 to 10001, i.e. with an odd
        # length
        r = 1
      else:
        # We go from generating numbers like 99999 to 100001, i.e. with an even
        # length
        q, r = q + 1, 0
        # We don't want lh to increase in length yet
        lh = lh//10
        slh = slh[:-1]

    # wh is the "whole" palindrome, made by mirroring lh
    if r == 0:
      # slh[::-1] is the same tricky slice syntax for reversing a string
      wh = int(slh + slh[::-1])
    else:
      # More tricky slice syntax: slh[-2::-1] reverses slh, except for the last
      # character
      wh = int(slh + slh[-2::-1])

    if wh >= n:
      # We hit the upper bound
      return
    elif wh >= m:
      yield w

    # Increment the left half and go again
    lh += 1
```


## How about even faster?

The next large input has a gargantuan input size restriction of `$1 \le A \le B \le 10^{100}$`.
That's right, the size of the interval is bounded by a googol.

Our tricks so far have only decreased the size of the search space to its 4<sup>th</sup> root.
But `$\sqrt[4]{10^{100}} = 10^{25} \approx 2^{83}$` is clearly still infeasible.
We need to shrink our search space even more, so lets look at the result space.
The square roots of the "fair and square" numbers look like this: 1, 2, 3, 11, 22, 101, 111, 121, 202, 212, 1001, 1111, 2002, etc.

Notice how all the numbers are composed of only the digits 0, 1, and 2 (except for the number 3 itself).
If this result always holds, then we've reduced our search space to `$3^{25} \approx 2^{40}$`, which is just barely feasible.


## Can we prove it?

Consider the square of a palindrome `$n$` whose digits are `$a b c \cdots c b a$`:

```math
\begin{array}{cccccccccccccc} {} & {} & {} & {} & {} & {} & {} & a & b & c & \cdots & c & b & a \\
\times & {} & {} & {} & {} & {} & {} & a & b & c & \cdots & c & b & a \\
\hline \\[-2.0ex]
{} & {} & {} & {} & {} & {} & {} & \boldsymbol{a^2} & a \cdot b & a \cdot c & \cdots & a \cdot c & a \cdot b & a^2 \\
{} & {} & {} & {} & {} & {} & b \cdot a & \boldsymbol{b^2} & b \cdot c & \cdots & b \cdot c & b^2 & b \cdot a & {} \\
{} & {} & {} & {} & {} & c \cdot a & c \cdot b & \boldsymbol{c^2} & \cdots & c^2 & c \cdot b & c \cdot a & {} & {} \\
{} & {} & {} & {} & ⋰ & ⋰ & ⋰ & \vdots & ⋰ & ⋰ & ⋰ & {} & {} & {} \\
{} & {} & {} & c \cdot a & c \cdot b & c^2 & \cdots & \boldsymbol{c^2} & c \cdot b & c \cdot a & {} & {} & {} & {} \\
{} & {} & b \cdot a & b^2 & b \cdot c & \cdots & b \cdot c & \boldsymbol{b^2} & b \cdot a & {} & {} & {} & {} & {} \\
+ & a^2 & a \cdot b & a \cdot c & \cdots & a \cdot c & a \cdot b & \boldsymbol{a^2} & {} & {} & {} & {} & {} & {} \\
\hline
\end{array}
```

Imagine if a carry `$\alpha$` occurred while calculating the bolded middle column.
In order for the result to be a palindrome, an equivalent (mod 10) carry `$\beta$` must have occurred in the opposite column.
Since that column has an identical copy on the left, that column must also produce a carry `$\beta$`.
If we continue to carry out this logic, we are eventually forced to have a carry `$\omega$` over the rightmost column, which is impossible, or into a new column on the left, which would make the result a non-palindrome.

```math
\begin{array}{cccccccccccccc} {} & {} & {} & {} & {} & {} & {} & a & b & c & \cdots & c & b & a \\
\times & {} & {} & {} & {} & {} & {} & a & b & c & \cdots & c & b & a \\
\hline \\[-2.0ex]
\boldsymbol{\omega?} & {} & \cdots & {} & \boldsymbol\beta & {} & \boldsymbol\alpha & {} & \boldsymbol\beta & {} & \cdots & {} & {} & \boldsymbol{\omega?} \\
{} & {} & {} & {} & {} & {} & {} & a^2 & a \cdot b & a \cdot c & \cdots & a \cdot c & a \cdot b & a^2 \\
{} & {} & {} & {} & {} & {} & b \cdot a & b^2 & b \cdot c & \cdots & b \cdot c & b^2 & b \cdot a & {} \\
{} & {} & {} & {} & {} & c \cdot a & c \cdot b & c^2 & \cdots & c^2 & c \cdot b & c \cdot a & {} & {} \\
{} & {} & {} & {} & ⋰ & ⋰ & ⋰ & \vdots & ⋰ & ⋰ & ⋰ & {} & {} & {} \\
{} & {} & {} & c \cdot a & c \cdot b & c^2 & \cdots & c^2 & c \cdot b & c \cdot a & {} & {} & {} & {} \\
{} & {} & b \cdot a & b^2 & b \cdot c & \cdots & b \cdot c & b^2 & b \cdot a & {} & {} & {} & {} & {} \\
+ & a^2 & a \cdot b & a \cdot c & \cdots & a \cdot c & a \cdot b & a^2 & {} & {} & {} & {} & {} & {} \\
\hline
\end{array}
```

Thus, we know that the sum `$a^2 + b^2 + c^2 + \cdots + c^2 + b^2 + a^2$` must not produce a carry, so it must be less than 10.
Since `$1^2 + 3^2 = 10$`, it is impossible for n to contain any digits greater than 2, except in the case that `$n = 3$`.

We could stop now, implement the `$3^{25} \approx 2^{40}$` complexity search, maybe multi-thread it, and be done.
But we can do better!


## A stronger result

Now that we know `$a^2 + b^2 + c^2 + \cdots + c^2 + b^2 + a^2 < 10$` is a necessary condition for `$n^2$` to be fair and square, is it also sufficient?
Yes!
Since that sum has more terms in it than any other column, and the pairwise products `$a \cdot b$`, `$a \cdot c$`, `$b \cdot c$`, etc. are bounded by at least one of `$a^2$`, `$b^2$`, `$c^2$`, etc., that column must have the largest value.
Feel free to prove this rigorously if my hand-waving doesn't convince you :)

Enumerating all palindromes which avoid a carry in that column will thus give us exactly the set of fair and square numbers.
These numbers must obey one of the following rules.
Let `$n$` be the square root of a fair and square number, and `$l$` be its size in digits.

- If `$l$` is even,
  - `$n$` starts with a 1, contains at most eight 1s, and all other digits are 0
  - OR, `$n$` starts and ends with a 2, and contains no other digits except 0s
- If `$l$` is odd,
  - `$n$` starts with a 1, contains at most nine 1s, and all other digits are 0
  - OR, `$n$` starts with a 1, has a 2 as its middle digit, contains at most four 1s, and all other digits are 0
  - OR, `$n$` starts and ends with a 2, and has either a 0 or a 1 as its middle digit, with all other digits being 0s

As we see in the [next section], there are `$O(l^3)$` fair and square numbers of length `$l$`, so it is possible to compute and store all fair and square numbers `$\le 10^{100}$`.
It's then straightforward to count the number of them which lie in a given interval.

[next section]: #a-non-enumerative-approach

```python
#!/usr/bin/env python3

import itertools

def fair_square_roots(n):
  """Generates all candidate square roots of length <= 2*n + 1."""
  yield 1
  yield 2
  yield 3

  for h in range(n):
    # There are between one and five 1s on the left half of the palindrome
    for n_ones in range(1, 5):
      # Get all possible locations for the 1s
      for ones in itertools.combinations(range(h), n_ones - 1):
        # Put a 1 at each chosen location, and a 0 everywhere else
        a = ['0'] * h
        for i in ones:
          a[i] = '1'

        s = '1' + ''.join(a)
        rs = s[::-1]

        # Generate some candidates
        yield int(s + rs)
        yield int(s + '0' + rs)
        yield int(s + '1' + rs)

        # If we have two or fewer 1s, we can afford a 2 as the middle digit
        if n_ones <= 2:
          yield int(s + '2' + rs)

    # The cases starting with 2 are simpler
    s = '2' + '0'*h
    rs = s[::-1]
    yield int(s + rs)
    yield int(s + '0' + rs)
    yield int(s + '1' + rs)

square = lambda x: x*x

# We want all fair and square numbers with length <= 101, so we get the square
# roots bounded by length <= 2*25 + 1 = 51
fair_squares = list(map(square, fair_square_roots(25)))

T = int(input())

for i in range(1, T + 1):
  line = input().split(' ')
  A = int(line[0])
  B = int(line[1])

  count = 0
  for fs in fair_squares:
    if A <= fs <= B:
      count += 1
  print('Case #%d: %d' % (i, count))
```


## A non-enumerative approach

Here is an algorithm that computes the number of candidates directly, without enumerating them:

```python
def n_fair_and_square(l):
  """
  Returns the number of fair and square numbers with a square root of length l.
  """
  if l == 1:
    # 1, 4, and 9
    return 3

  # h is the number of "free" digits we have -- half the number of digits, not
  # counting the first digit
  h = l//2 - 1

  # First consider the number of values starting with 1

  # There are 1 + h + (h choose 2) + (h choose 3) ways to place at most 3 1s in
  # positions 1..h
  n = 1 + (5*h + h**3)//6

  if l%2 == 1:
    # We can set the middle digit to 0 or 1 as well
    n *= 2

    # We can set the middle digit to 2 also, but then we're limited to at most
    # one 1 in positions 1..h
    n += 1 + h

    # There are two solutions starting with 2: 200...000...002, and
    # 200...010...002
    n += 2
  else:
    # There is one solution starting with 2: 2000...0002
    n += 1

  return n
```

Unfortunately, that's doesn't directly help us solve the challenge, because we don't just care about the number of fair and square numbers of a certain length -- they also have to be within some exact numerical bounds.
However, I feel like this function could be modified in some way to account for those bounds.

---


## Comments

> **Zoli**
> *fa-regular fa-clock* *time-2013-05-06*
>
> Really nice analysis of the problem!
> Unfortunately during the competition I did not realize the part that the square root can only contain 0s, 1s, 2s or 3, so my algorithm was not fast enough for the large dataset.
>
> Since you seem to understand algorithm problems quite well, could you please give me some pointers on how I should get better at these kind of problems?
> Should I read lots of algorithm books or compete on TopCoder or other competitions, or what do you suggest?
> How long did it take for you to analyze this problem quite thoroughly?
>
> > *fa-solid fa-user* [**Tavian Barnes**](/)
> > *fa-regular fa-clock* *time-2013-05-30*
> >
> > It took me the day to get that problem done (and it was the only one I did), and about another to write this up.
> >
> > There's certainly a lot of benefit to practice, and I'd definitely recommend trying out TopCoder / Project Euler / old Code Jam problems to get more acquainted with these kinds of problems.
> > But mostly I'd recommend just reading about lots of algorithms in your spare time, so you start to see the patterns and tricks used to make great algorithms.
