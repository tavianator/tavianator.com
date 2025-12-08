# Efficient Integer Exponentiation in C

<div class="infobar">

*fa-regular fa-clock* *time-2014-10-05*
*fa-solid fa-user* Tavian Barnes

</div>


It's surprisingly difficult to find a good code snippet for this on Google, so here's an efficient computation of integer powers in C, using [binary exponentiation]:

[binary exponentiation]: https://en.wikipedia.org/wiki/Exponentiation_by_squaring

```c
// Computes b**e (mod UINT32_MAX)
uint32_t
ipow(uint32_t b, uint32_t e)
{
  uint32_t ret;
  for (ret = 1; e; e >>= 1) {
    if (e & 1) {
      ret *= b;
    }
    b *= b;
  }
  return ret;
}
```

GCC 4.9.1 (and likely other versions) is smart enough to replace the `if (e & 1)` branch with a conditional move, generating very fast code.

Of course, this computes the result modulo `UINT32_MAX`.
To use a different modulus, just reduce after each multiplication:

```c
// Computes b**e (mod m)
uint32_t
ipowm(uint32_t b, uint32_t e, uint32_t m)
{
  uint32_t ret;
  b %= m;
  for (ret = m > 1; e; e >>= 1) {
    if (e & 1) {
      ret = (uint64_t)ret * b % m;
    }
    b = (uint64_t)b * b % m;
  }
  return ret;
}
```

(Note the `ret = m > 1` instead of `ret = 1`, to handle the case `e == 0 && m == 1`.)

Unfortunately, GCC isn't smart enough to realise the limited range of the operands and generates a full 64-bit multiply and divide for each `... * b % m` operation.
For extra performance, this bit of inline assembly for x86 and x86-64 gives about a 15% boost:

```c
// Computes a * b (mod m), as long as a / b is representable in 32 bits
static uint32_t
reduced_multiply(uint32_t a, uint32_t b, uint32_t m)
{
  uint32_t q, r;

  __asm__ ("mull %3\n\t"
           "divl %4"
           : "=a" (q), "=&d" (r)
           : "0" (a), "rm" (b), "rm" (m));

  return r;
}

// Computes b**e (mod m)
uint32_t
ipowm(uint32_t b, uint32_t e, uint32_t m)
{
  uint32_t ret;
  b %= m;
  for (ret = m > 1; e; e >>= 1) {
    if (e & 1) {
      ret = reduced_multiply(ret, b, m);
    }
    b = reduced_multiply(b, b, m);
  }

  return ret;
}
```
